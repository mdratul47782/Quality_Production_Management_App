// app/api/floor-dashboard/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/services/mongo";

import TargetSetterHeader from "@/models/TargetSetterHeader";
import { HourlyProductionModel } from "@/models/HourlyProduction-model";
import { HourlyInspectionModel } from "@/models/hourly-inspections";

export const dynamic = "force-dynamic";

// ---------- helpers ----------

function toNumberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// same formula you already use elsewhere
function computeBaseTargetPerHourFromHeader(header) {
  const manpowerPresent = toNumberOrZero(header.manpower_present);
  const smv = toNumberOrZero(header.smv);
  const planEffPercent = toNumberOrZero(header.plan_efficiency_percent);
  const planEffDecimal = planEffPercent / 100;

  const targetFromCapacity =
    manpowerPresent > 0 && smv > 0
      ? (manpowerPresent * 60 * planEffDecimal) / smv
      : 0;

  const workingHour = toNumberOrZero(header.working_hour);
  const targetFullDay = toNumberOrZero(header.target_full_day);
  const targetFromFullDay =
    workingHour > 0 ? targetFullDay / workingHour : 0;

  return targetFromCapacity || targetFromFullDay || 0;
}

// "2025-12-08" -> local Date(2025, 11, 8, 00:00)
function parseLocalDateFromYMD(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getDayRange(dateStr) {
  let base;

  if (dateStr.includes("T")) {
    base = new Date(dateStr);
  } else {
    base = parseLocalDateFromYMD(dateStr);
  }

  if (Number.isNaN(base.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }

  const start = new Date(base);
  start.setHours(0, 0, 0, 0);

  const end = new Date(base);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

// common key for segments (line + buyer + style)
function makeSegmentKey(line, buyer, style) {
  return `${line || ""}__${buyer || ""}__${style || ""}`;
}

// ==================================================================
// GET /api/floor-dashboard?factory=K-2&building=A-2&date=2025-12-11&line=Line-1|ALL
// ==================================================================
export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const factory = searchParams.get("factory");
    const building = searchParams.get("building");
    const date = searchParams.get("date");
    const line = searchParams.get("line"); // optional, "ALL" for all lines

    if (!factory || !building || !date) {
      return NextResponse.json(
        {
          success: false,
          message: "factory, building and date are required",
        },
        { status: 400 }
      );
    }

    // ============================================================
    // PRODUCTION PART (segment = line + buyer + style)
    // ============================================================

    const headerFilter = {
      factory,
      assigned_building: building,
      date,
    };
    if (line && line !== "ALL") {
      headerFilter.line = line;
    }

    const headers = await TargetSetterHeader.find(headerFilter).lean();

    // segAgg: key -> {
    //   line, buyer, style,
    //   production: {
    //     targetQty,
    //     achievedQty,
    //     varianceQty,
    //     currentHour,
    //     currentHourEfficiency,
    //     avgEffPercent,
    //     manpowerPresent,
    //     _produceMinSum,
    //     _availMinSum,
    //     _lastTotalEfficiency,
    //   }
    // }
    const segAgg = {};

    const headerIdToSegKey = {};
    const headerIdToContext = {};

    function ensureSeg(segKey, lineName, buyer, style) {
      if (!segAgg[segKey]) {
        segAgg[segKey] = {
          line: lineName,
          buyer,
          style,
          production: {
            targetQty: 0,
            achievedQty: 0,
            varianceQty: 0,
            currentHour: null,
            currentHourEfficiency: 0,
            avgEffPercent: 0,
            manpowerPresent: 0,
            _produceMinSum: 0,
            _availMinSum: 0,
            _lastTotalEfficiency: null,
          },
        };
      }
      return segAgg[segKey];
    }

    // 1) From headers -> base target per segment
    for (const h of headers) {
      const lineName = h.line;
      const buyer = h.buyer;
      const style = h.style;

      const segKey = makeSegmentKey(lineName, buyer, style);
      const seg = ensureSeg(segKey, lineName, buyer, style);

      const headerIdStr = h._id.toString();

      const mpPresent = toNumberOrZero(h.manpower_present);
      const smv = toNumberOrZero(h.smv);

      headerIdToSegKey[headerIdStr] = segKey;
      headerIdToContext[headerIdStr] = {
        manpower_present: mpPresent,
        smv,
      };

      if (mpPresent > 0) {
        // keep latest/any non-zero manpower for this segment
        seg.production.manpowerPresent = mpPresent;
      }

      // ✅ DO NOT REDUCE TARGET: use target_full_day as truth
      let targetFullDay = toNumberOrZero(h.target_full_day);

      // fallback only if not set
      if (!targetFullDay) {
        const baseTargetPerHourRaw = computeBaseTargetPerHourFromHeader(h);
        const workingHours = toNumberOrZero(h.working_hour);
        targetFullDay = Math.round(
          (Number.isFinite(baseTargetPerHourRaw)
            ? baseTargetPerHourRaw
            : 0) *
            (Number.isFinite(workingHours) ? workingHours : 0)
        );
      }

      seg.production.targetQty += targetFullDay;
    }

    const allHeaderIds = headers.map((h) => h._id);

    let hourlyRecs = [];

    if (allHeaderIds.length > 0) {
      hourlyRecs = await HourlyProductionModel.find({
        headerId: { $in: allHeaderIds },
      }).lean();
    }

    // 2) Hourly records -> achievedQty + current hr eff + weighted avg eff
    for (const rec of hourlyRecs) {
      const headerIdStr = rec.headerId.toString();
      const segKey = headerIdToSegKey[headerIdStr];
      if (!segKey) continue;

      const seg = segAgg[segKey];
      if (!seg) continue;

      const ctx = headerIdToContext[headerIdStr] || {};

      const mp = toNumberOrZero(ctx.manpower_present);
      const smv = toNumberOrZero(ctx.smv);
      const achieved = toNumberOrZero(rec.achievedQty);

      seg.production.achievedQty += achieved;

      if (mp > 0 && smv > 0) {
        const produceMin = achieved * smv;
        const availMin = mp * 60;

        seg.production._produceMinSum += produceMin;
        seg.production._availMinSum += availMin;
      }

      const hourNum = toNumberOrZero(rec.hour);
      if (
        seg.production.currentHour === null ||
        hourNum > seg.production.currentHour
      ) {
        seg.production.currentHour = hourNum;
        seg.production.currentHourEfficiency = toNumberOrZero(
          rec.hourlyEfficiency
        );
        seg.production._lastTotalEfficiency = toNumberOrZero(
          rec.totalEfficiency
        );
      }
    }

    // 3) Finalize variance + avg eff per segment
    Object.values(segAgg).forEach((seg) => {
      const p = seg.production;

      // ✅ plain difference, no reduction
      p.varianceQty = p.achievedQty - p.targetQty;

      if (p._availMinSum > 0) {
        p.avgEffPercent =
          (p._produceMinSum / p._availMinSum) * 100;
      } else if (
        typeof p._lastTotalEfficiency === "number" &&
        !Number.isNaN(p._lastTotalEfficiency)
      ) {
        p.avgEffPercent = p._lastTotalEfficiency;
      } else {
        p.avgEffPercent = 0;
      }

      delete p._produceMinSum;
      delete p._availMinSum;
      delete p._lastTotalEfficiency;
    });

    // ============================================================
    // QUALITY PART (per line, shared across segments of that line)
    // ============================================================
    const { start, end } = getDayRange(date);

    const qualityMatch = {
      factory,
      building,
      reportDate: { $gte: start, $lte: end },
    };
    if (line && line !== "ALL") {
      qualityMatch.line = line;
    }

    const qualityAggDocs = await HourlyInspectionModel.aggregate([
      { $match: qualityMatch },
      {
        $group: {
          _id: "$line",
          totalInspected: { $sum: "$inspectedQty" },
          totalPassed: { $sum: "$passedQty" },
          totalDefectivePcs: { $sum: "$defectivePcs" },
          totalDefects: { $sum: "$totalDefects" },
          maxHourIndex: { $max: "$hourIndex" }, // current quality hour
        },
      },
    ]);

    const qualityLineAgg = {};
    for (const doc of qualityAggDocs) {
      const lineName = doc._id;
      const totalInspected = toNumberOrZero(doc.totalInspected);
      const totalPassed = toNumberOrZero(doc.totalPassed);
      const totalDefectivePcs = toNumberOrZero(doc.totalDefectivePcs);
      const totalDefects = toNumberOrZero(doc.totalDefects);

      const rftPercent =
        totalInspected > 0 ? (totalPassed / totalInspected) * 100 : 0;
      const defectRatePercent =
        totalInspected > 0
          ? (totalDefectivePcs / totalInspected) * 100
          : 0;
      const dhuPercent =
        totalInspected > 0 ? (totalDefects / totalInspected) * 100 : 0;

      const currentHour =
        Number(doc.maxHourIndex ?? 0) > 0
          ? Number(doc.maxHourIndex)
          : null;

      qualityLineAgg[lineName] = {
        line: lineName,
        totalInspected,
        totalPassed,
        totalDefectivePcs,
        totalDefects,
        rftPercent,
        defectRatePercent,
        dhuPercent,
        currentHour,
      };
    }

    // ============================================================
    // MERGE: build segments array for frontend
    // ============================================================

    const segments = Object.values(segAgg).map((seg) => {
      const lineName = seg.line;

      const qual =
        qualityLineAgg[lineName] || {
          line: lineName,
          totalInspected: 0,
          totalPassed: 0,
          totalDefectivePcs: 0,
          totalDefects: 0,
          rftPercent: 0,
          defectRatePercent: 0,
          dhuPercent: 0,
          currentHour: null,
        };

      return {
        line: seg.line,
        buyer: seg.buyer,
        style: seg.style,
        quality: qual,
        production: seg.production,
      };
    });

    return NextResponse.json({
      success: true,
      factory,
      building,
      date,
      lineFilter: line || "ALL",
      lines: segments, // <-- your FloorDashboardPage uses json.lines
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { success: false, message: err.message || "Server error" },
      { status: 500 }
    );
  }
}
