// app/api/floor-dashboard/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/services/mongo";

import TargetSetterHeader from "@/models/TargetSetterHeader";
import { HourlyProductionModel } from "@/models/HourlyProduction-model";
import { HourlyInspectionModel } from "@/models/hourly-inspections";

// ---------- helpers ----------

function toNumberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Same base logic as your hourly board
// baseTargetPerHourRaw = (MP × 60 × PlanEff% / SMV)
// Day base target per header = round(baseTargetPerHourRaw) × working_hour
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

// ==================================================================
// GET /api/floor-dashboard?factory=K-2&building=A-2&date=2025-12-08&line=Line-1|ALL
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

    // ============================
    // PRODUCTION PART (target, eff%)
    // ============================
    const headerFilter = {
      factory, // 👈 very important
      assigned_building: building,
      date,
    };
    if (line && line !== "ALL") {
      headerFilter.line = line;
    }

    const headers = await TargetSetterHeader.find(headerFilter).lean();

    const headerIdToLine = {};
    const productionLineAgg = {};

    function ensureLineAgg(lineName) {
      if (!productionLineAgg[lineName]) {
        productionLineAgg[lineName] = {
          line: lineName,
          targetQty: 0, // base target (same logic as hourly board)
          achievedQty: 0,
          varianceQty: 0,
          currentHour: null,
          currentHourEfficiency: 0,
          _effSum: 0,
          _effCount: 0,
        };
      }
      return productionLineAgg[lineName];
    }

    // 1) From headers -> base target per line
    for (const h of headers) {
      const lineName = h.line;
      const agg = ensureLineAgg(lineName);

      headerIdToLine[h._id.toString()] = lineName;

      const baseTargetPerHourRaw = computeBaseTargetPerHourFromHeader(h);
      const baseTargetPerHourRounded = Math.round(baseTargetPerHourRaw);
      const workingHours = toNumberOrZero(h.working_hour);

      const headerBaseTarget =
        (Number.isFinite(baseTargetPerHourRounded)
          ? baseTargetPerHourRounded
          : 0) *
        (Number.isFinite(workingHours) ? workingHours : 0);

      agg.targetQty += headerBaseTarget;
    }

    const allHeaderIds = headers.map((h) => h._id);
    let hourlyRecs = [];

    // 2) Hourly records -> achievedQty + eff  (strictly filtered by factory)
    if (allHeaderIds.length > 0) {
      hourlyRecs = await HourlyProductionModel.find({
        factory, // 👈 filter by factory so K-1 never sees K-2 data
        productionDate: date, // "YYYY-MM-DD"
        headerId: { $in: allHeaderIds },
      }).lean();
    }

    for (const rec of hourlyRecs) {
      const lineName = headerIdToLine[rec.headerId.toString()];
      if (!lineName) continue;

      const agg = ensureLineAgg(lineName);

      agg.achievedQty += toNumberOrZero(rec.achievedQty);
      agg._effSum += toNumberOrZero(rec.hourlyEfficiency);
      agg._effCount += 1;

      if (agg.currentHour === null || rec.hour > agg.currentHour) {
        agg.currentHour = rec.hour;
        agg.currentHourEfficiency = toNumberOrZero(rec.hourlyEfficiency);
      }
    }

    // 3) Finalize variance + avg eff
    Object.values(productionLineAgg).forEach((agg) => {
      agg.varianceQty = agg.achievedQty - agg.targetQty;
      agg.avgEffPercent =
        agg._effCount > 0 ? agg._effSum / agg._effCount : 0;

      delete agg._effSum;
      delete agg._effCount;
    });

    // ============================
    // QUALITY PART (RFT, DHU, Defect Rate, current hour)
    // ============================
    const { start, end } = getDayRange(date);

    const qualityMatch = {
      factory, // 👈 also filter by factory here
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

    // ============================
    // MERGE LINES (union of prod + quality)
    // ============================
    const lineNames = new Set([
      ...Object.keys(productionLineAgg),
      ...Object.keys(qualityLineAgg),
    ]);

    const lines = Array.from(lineNames)
      .sort()
      .map((ln) => {
        const prod = productionLineAgg[ln] || {
          line: ln,
          targetQty: 0,
          achievedQty: 0,
          varianceQty: 0,
          currentHour: null,
          currentHourEfficiency: 0,
          avgEffPercent: 0,
        };

        const qual = qualityLineAgg[ln] || {
          line: ln,
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
          line: ln,
          quality: qual,
          production: prod,
        };
      });

    return NextResponse.json({
      success: true,
      factory,
      building,
      date,
      lineFilter: line || "ALL",
      lines,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { success: false, message: err.message || "Server error" },
      { status: 500 }
    );
  }
}
