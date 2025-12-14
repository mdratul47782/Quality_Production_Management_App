// app/api/floor-compare/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/services/mongo";

import TargetSetterHeader from "@/models/TargetSetterHeader";
import { HourlyProductionModel } from "@/models/HourlyProduction-model";
import { HourlyInspectionModel } from "@/models/hourly-inspections";

export const dynamic = "force-dynamic";

// ---------- constants ----------
const BUILDINGS = ["A-2", "B-2", "A-3", "B-3", "A-4", "B-4", "A-5", "B-5"];
const LINES = Array.from({ length: 15 }).map((_, i) => `Line-${i + 1}`);

// ---------- helpers ----------
function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function clampPercent(v) {
  const n = toNum(v, 0);
  return Math.max(0, Math.min(100, n));
}
function parseLocalDateFromYMD(dateStr) {
  const [y, m, d] = String(dateStr || "").split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function getRangeBounds(fromStr, toStr) {
  const from = parseLocalDateFromYMD(fromStr);
  const to = parseLocalDateFromYMD(toStr);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Invalid from/to date");
  }
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
function listDateStrings(fromStr, toStr) {
  const a = parseLocalDateFromYMD(fromStr);
  const b = parseLocalDateFromYMD(toStr);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);

  const out = [];
  const cur = new Date(a);
  while (cur.getTime() <= b.getTime()) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function lineSortKey(lineName = "") {
  const m = String(lineName).match(/(\d+)/);
  return m ? Number(m[1]) : 9999;
}
function buildingSortKey(b = "") {
  const idx = BUILDINGS.indexOf(String(b));
  return idx === -1 ? 999 : idx;
}

function makeSegmentKey(building, line, buyer, style) {
  return `${building || ""}__${line || ""}__${buyer || ""}__${style || ""}`;
}
function makeBuildingLineKey(building, line) {
  return `${building || ""}__${line || ""}`;
}

// =====================================================================
// GET /api/floor-compare?factory=K-2&from=2025-11-25&to=2025-12-14
//    &building= (optional)  &groupBy=line|building|segment  &line=ALL|Line-1
// =====================================================================
export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);

    const factory = searchParams.get("factory");
    const building = searchParams.get("building") || ""; // "" => ALL floors
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const groupBy = (searchParams.get("groupBy") || "line").toLowerCase(); // line|building|segment
    const lineFilter = searchParams.get("line") || "ALL";

    if (!factory || !from || !to) {
      return NextResponse.json(
        { success: false, message: "factory, from, to are required" },
        { status: 400 }
      );
    }

    const fromD = parseLocalDateFromYMD(from);
    const toD = parseLocalDateFromYMD(to);
    if (fromD.getTime() > toD.getTime()) {
      return NextResponse.json(
        { success: false, message: "from date must be <= to date" },
        { status: 400 }
      );
    }

    const { start, end } = getRangeBounds(from, to);
    const dates = listDateStrings(from, to);

    // -----------------------------------------
    // 1) Headers -> Targets + context
    // -----------------------------------------
    const headerFilter = {
      factory,
      date: { $gte: from, $lte: to }, // YYYY-MM-DD lexical ok
    };
    if (building) headerFilter.assigned_building = building;
    if (lineFilter && lineFilter !== "ALL") headerFilter.line = lineFilter;

    const headers = await TargetSetterHeader.find(headerFilter).lean();

    const headerIdToCtx = {}; // headerId -> ctx
    const headerIds = [];

    // production aggregates
    const prodAgg = {}; // key -> row
    const prodSeries = {}; // date -> totals

    for (const d of dates) {
      prodSeries[d] = { targetQty: 0, achievedQty: 0, produceMin: 0, availMin: 0 };
    }

    function ensureProd(key, meta) {
      if (!prodAgg[key]) {
        prodAgg[key] = {
          key,
          building: meta.building || "",
          line: meta.line || "",
          buyer: meta.buyer || "",
          style: meta.style || "",
          targetQty: 0,
          achievedQty: 0,
          produceMin: 0,
          availMin: 0,
        };
      }
      return prodAgg[key];
    }

    // 1a) targets from headers
    for (const h of headers) {
      const headerIdStr = String(h._id);
      headerIds.push(h._id);

      const ctx = {
        date: h.date,
        building: h.assigned_building || "",
        line: h.line || "",
        buyer: h.buyer || "",
        style: h.style || "",
        mp: toNum(h.manpower_present, 0),
        smv: toNum(h.smv, 0),
      };
      headerIdToCtx[headerIdStr] = ctx;

      let key = ctx.line;
      if (groupBy === "building") key = ctx.building;
      if (groupBy === "segment") key = makeSegmentKey(ctx.building, ctx.line, ctx.buyer, ctx.style);

      const row = ensureProd(key, ctx);
      const t = toNum(h.target_full_day, 0);
      row.targetQty += t;

      if (prodSeries[ctx.date]) prodSeries[ctx.date].targetQty += t;
    }

    // -----------------------------------------
    // 2) HourlyProduction -> achieved + weighted eff
    // -----------------------------------------
    if (headerIds.length > 0) {
      const hourly = await HourlyProductionModel.find({
        headerId: { $in: headerIds },
      }).lean();

      for (const rec of hourly) {
        const ctx = headerIdToCtx[String(rec.headerId)];
        if (!ctx) continue;

        // extra safety filters
        if (building && ctx.building !== building) continue;
        if (lineFilter && lineFilter !== "ALL" && ctx.line !== lineFilter) continue;

        let key = ctx.line;
        if (groupBy === "building") key = ctx.building;
        if (groupBy === "segment") key = makeSegmentKey(ctx.building, ctx.line, ctx.buyer, ctx.style);

        const row = ensureProd(key, ctx);

        const achieved = toNum(rec.achievedQty, 0);
        row.achievedQty += achieved;

        const d = rec.productionDate || ctx.date;
        if (!prodSeries[d]) {
          prodSeries[d] = { targetQty: 0, achievedQty: 0, produceMin: 0, availMin: 0 };
        }
        prodSeries[d].achievedQty += achieved;

        const mp = toNum(ctx.mp, 0);
        const smv = toNum(ctx.smv, 0);
        if (mp > 0 && smv > 0) {
          const produceMin = achieved * smv;
          const availMin = mp * 60;

          row.produceMin += produceMin;
          row.availMin += availMin;

          prodSeries[d].produceMin += produceMin;
          prodSeries[d].availMin += availMin;
        }
      }
    }

    // overall production summary
    const prodOverall = {
      totalTargetQty: 0,
      totalAchievedQty: 0,
      totalVarianceQty: 0,
      avgEffPercent: 0,
      _produceMin: 0,
      _availMin: 0,
    };

    Object.values(prodAgg).forEach((r) => {
      prodOverall.totalTargetQty += r.targetQty;
      prodOverall.totalAchievedQty += r.achievedQty;
      prodOverall._produceMin += r.produceMin;
      prodOverall._availMin += r.availMin;
    });
    prodOverall.totalVarianceQty = prodOverall.totalAchievedQty - prodOverall.totalTargetQty;
    prodOverall.avgEffPercent =
      prodOverall._availMin > 0 ? (prodOverall._produceMin / prodOverall._availMin) * 100 : 0;

    // series (production + placeholder quality)
    const series = dates.map((d) => {
      const p = prodSeries[d] || { targetQty: 0, achievedQty: 0, produceMin: 0, availMin: 0 };
      const eff = p.availMin > 0 ? (p.produceMin / p.availMin) * 100 : 0;
      return {
        date: d,
        production: {
          targetQty: p.targetQty,
          achievedQty: p.achievedQty,
          varianceQty: p.achievedQty - p.targetQty,
          effPercent: eff,
        },
        quality: {
          totalInspected: 0,
          rftPercent: 0,
          dhuPercent: 0,
          defectRatePercent: 0,
        },
      };
    });

    // -----------------------------------------
    // 3) QUALITY (range)
    // -----------------------------------------
    const qualityMatch = {
      factory,
      reportDate: { $gte: start, $lte: end },
    };
    if (building) qualityMatch.building = building;
    if (lineFilter && lineFilter !== "ALL") qualityMatch.line = lineFilter;

    // group:
    // - line: "$line"
    // - building: "$building"
    // - segment mode: group by building+line (buyer/style not available in inspection)
    let qualityGroupStage = { _id: "$line" };
    if (groupBy === "building") qualityGroupStage = { _id: "$building" };
    if (groupBy === "segment") {
      qualityGroupStage = {
        _id: { building: "$building", line: "$line" },
      };
    }

    const qualityAggDocs = await HourlyInspectionModel.aggregate([
      { $match: qualityMatch },
      {
        $group: {
          ...qualityGroupStage,
          totalInspected: { $sum: "$inspectedQty" },
          totalPassed: { $sum: "$passedQty" },
          totalDefectivePcs: { $sum: "$defectivePcs" },
          totalDefects: { $sum: "$totalDefects" },
        },
      },
    ]);

    const qualAgg = {}; // key -> totals
    const qualOverall = {
      totalInspected: 0,
      totalPassed: 0,
      totalDefectivePcs: 0,
      totalDefects: 0,
      rftPercent: 0,
      defectRatePercent: 0,
      dhuPercent: 0,
    };

    for (const doc of qualityAggDocs) {
      let key = doc._id || "";

      if (groupBy === "segment" && doc._id && typeof doc._id === "object") {
        key = makeBuildingLineKey(doc._id.building, doc._id.line);
      }

      const totalInspected = toNum(doc.totalInspected, 0);
      const totalPassed = toNum(doc.totalPassed, 0);
      const totalDefectivePcs = toNum(doc.totalDefectivePcs, 0);
      const totalDefects = toNum(doc.totalDefects, 0);

      const rft = totalInspected > 0 ? (totalPassed / totalInspected) * 100 : 0;
      const defectRate = totalInspected > 0 ? (totalDefectivePcs / totalInspected) * 100 : 0;
      const dhu = totalInspected > 0 ? (totalDefects / totalInspected) * 100 : 0;

      qualAgg[key] = {
        totalInspected,
        totalPassed,
        totalDefectivePcs,
        totalDefects,
        rftPercent: rft,
        defectRatePercent: defectRate,
        dhuPercent: dhu,
      };

      qualOverall.totalInspected += totalInspected;
      qualOverall.totalPassed += totalPassed;
      qualOverall.totalDefectivePcs += totalDefectivePcs;
      qualOverall.totalDefects += totalDefects;
    }

    if (qualOverall.totalInspected > 0) {
      qualOverall.rftPercent = (qualOverall.totalPassed / qualOverall.totalInspected) * 100;
      qualOverall.defectRatePercent =
        (qualOverall.totalDefectivePcs / qualOverall.totalInspected) * 100;
      qualOverall.dhuPercent = (qualOverall.totalDefects / qualOverall.totalInspected) * 100;
    }

    // daily quality series (always overall)
    const qualitySeriesDocs = await HourlyInspectionModel.aggregate([
      { $match: qualityMatch },
      {
        $group: {
          _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$reportDate" } } },
          totalInspected: { $sum: "$inspectedQty" },
          totalPassed: { $sum: "$passedQty" },
          totalDefectivePcs: { $sum: "$defectivePcs" },
          totalDefects: { $sum: "$totalDefects" },
        },
      },
    ]);

    const qualSeriesMap = {};
    for (const doc of qualitySeriesDocs) {
      const d = doc?._id?.date;
      if (!d) continue;

      const totalInspected = toNum(doc.totalInspected, 0);
      const totalPassed = toNum(doc.totalPassed, 0);
      const totalDefectivePcs = toNum(doc.totalDefectivePcs, 0);
      const totalDefects = toNum(doc.totalDefects, 0);

      qualSeriesMap[d] = {
        totalInspected,
        rftPercent: totalInspected > 0 ? (totalPassed / totalInspected) * 100 : 0,
        defectRatePercent: totalInspected > 0 ? (totalDefectivePcs / totalInspected) * 100 : 0,
        dhuPercent: totalInspected > 0 ? (totalDefects / totalInspected) * 100 : 0,
      };
    }

    for (const s of series) {
      const q = qualSeriesMap[s.date];
      if (q) {
        s.quality.totalInspected = q.totalInspected;
        s.quality.rftPercent = q.rftPercent;
        s.quality.defectRatePercent = q.defectRatePercent;
        s.quality.dhuPercent = q.dhuPercent;
      }
    }

    // -----------------------------------------
    // 4) MERGE rows (production + quality)
    // -----------------------------------------
    const keySet = new Set([...Object.keys(prodAgg), ...Object.keys(qualAgg)]);
    const rows = Array.from(keySet)
      .filter(Boolean)
      .map((key) => {
        const p =
          prodAgg[key] || {
            key,
            building: "",
            line: "",
            buyer: "",
            style: "",
            targetQty: 0,
            achievedQty: 0,
            produceMin: 0,
            availMin: 0,
          };

        const avgEff = p.availMin > 0 ? (p.produceMin / p.availMin) * 100 : 0;

        // quality mapping:
        // - segment => building+line
        // - building => building
        // - line => line
        let qKey = key;
        if (groupBy === "segment") qKey = makeBuildingLineKey(p.building, p.line);

        const q =
          qualAgg[qKey] || {
            totalInspected: 0,
            totalPassed: 0,
            totalDefectivePcs: 0,
            totalDefects: 0,
            rftPercent: 0,
            defectRatePercent: 0,
            dhuPercent: 0,
          };

        return {
          key,
          building: p.building || "",
          line: p.line || "",
          buyer: p.buyer || "",
          style: p.style || "",
          production: {
            targetQty: p.targetQty,
            achievedQty: p.achievedQty,
            varianceQty: p.achievedQty - p.targetQty,
            avgEffPercent: avgEff,
          },
          quality: {
            totalInspected: q.totalInspected,
            rftPercent: q.rftPercent,
            defectRatePercent: q.defectRatePercent,
            dhuPercent: q.dhuPercent,
          },
        };
      });

    // sort
    rows.sort((a, b) => {
      if (groupBy === "building") return buildingSortKey(a.key) - buildingSortKey(b.key);

      if (groupBy === "segment") {
        const bd = buildingSortKey(a.building) - buildingSortKey(b.building);
        if (bd !== 0) return bd;

        const ld = lineSortKey(a.line) - lineSortKey(b.line);
        if (ld !== 0) return ld;

        // keep stable with buyer/style
        const bs = String(a.buyer || "").localeCompare(String(b.buyer || ""));
        if (bs !== 0) return bs;
        return String(a.style || "").localeCompare(String(b.style || ""));
      }

      // line mode
      return lineSortKey(a.key) - lineSortKey(b.key);
    });

    // buildings present (for UI)
    const buildingsPresent = Array.from(
      new Set(
        rows
          .map((r) => r.building)
          .filter(Boolean)
      )
    ).sort((a, b) => buildingSortKey(a) - buildingSortKey(b));

    return NextResponse.json({
      success: true,
      params: { factory, building, from, to, groupBy, line: lineFilter },
      meta: {
        buildings: building ? [building] : buildingsPresent.length ? buildingsPresent : BUILDINGS,
        lines: LINES,
      },
      summary: {
        production: {
          totalTargetQty: prodOverall.totalTargetQty,
          totalAchievedQty: prodOverall.totalAchievedQty,
          totalVarianceQty: prodOverall.totalVarianceQty,
          avgEffPercent: clampPercent(prodOverall.avgEffPercent),
          daysCount: dates.length,
          avgTargetPerDay: dates.length ? prodOverall.totalTargetQty / dates.length : 0,
          avgAchievedPerDay: dates.length ? prodOverall.totalAchievedQty / dates.length : 0,
        },
        quality: {
          totalInspected: qualOverall.totalInspected,
          totalPassed: qualOverall.totalPassed,
          totalDefectivePcs: qualOverall.totalDefectivePcs,
          totalDefects: qualOverall.totalDefects,
          rftPercent: clampPercent(qualOverall.rftPercent),
          defectRatePercent: clampPercent(qualOverall.defectRatePercent),
          dhuPercent: clampPercent(qualOverall.dhuPercent),
        },
      },
      series,
      rows,
    });
  } catch (err) {
    console.error("GET /api/floor-compare error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
