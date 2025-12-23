// app/api/floor-summary/route.js
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

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

// Same logic as floor-dashboard
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
  const targetFromFullDay = workingHour > 0 ? targetFullDay / workingHour : 0;

  return targetFromCapacity || targetFromFullDay || 0;
}

// "2025-12-08" -> local Date(2025,11,8)
function parseLocalDateFromYMD(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getDayRange(dateStr) {
  let base;
  if (dateStr.includes("T")) base = new Date(dateStr);
  else base = parseLocalDateFromYMD(dateStr);

  if (Number.isNaN(base.getTime())) throw new Error(`Invalid date: ${dateStr}`);

  const start = new Date(base);
  start.setHours(0, 0, 0, 0);

  const end = new Date(base);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

// --------- ranking/marks (Excel-like) ----------
function denseRanks(items, getValue, direction = "desc") {
  const arr = (items || [])
    .map((it) => ({ key: it.__key, v: Number(getValue(it)) }))
    .filter((x) => Number.isFinite(x.v));

  arr.sort((a, b) => {
    if (a.v === b.v) return 0;
    return direction === "asc" ? a.v - b.v : b.v - a.v;
  });

  const rankMap = new Map();
  let rank = 0;
  let prev = null;

  for (const row of arr) {
    if (prev === null || row.v !== prev) rank += 1;
    prev = row.v;
    rankMap.set(row.key, rank);
  }
  return rankMap;
}

function marksByRank(rank, thresholds) {
  // thresholds = [{ maxRank: 2, marks: 25 }, ...]
  if (!rank || rank <= 0) return 0;
  for (const t of thresholds) {
    if (rank <= t.maxRank) return t.marks;
  }
  return 0;
}

function computeBestSelection(rows, labelKey) {
  // active = has some production/quality activity; inactive get 0 marks (like your L6/L12 rows)
  const normalized = (rows || []).map((r) => {
    const label = r?.[labelKey] || "";
    const target = toNumberOrZero(r?.production?.targetQty);
    const achieved = toNumberOrZero(r?.production?.achievedQty);
    const avgEff = toNumberOrZero(r?.production?.avgEffPercent);
    const inspected = toNumberOrZero(r?.quality?.totalInspected);
    const defectRate = toNumberOrZero(r?.quality?.defectRatePercent);

    const totalMp = toNumberOrZero(r?.manpower?.total);
    const absentMp = toNumberOrZero(r?.manpower?.absent);
    const absenteeism = totalMp > 0 ? (absentMp / totalMp) * 100 : 0;

    const planPercent = target > 0 ? (achieved / target) * 100 : 0;

    return {
      __key: String(label),
      [labelKey]: label,
      active: target > 0 || achieved > 0 || inspected > 0,

      // metrics (what your Excel shows)
      amountHitRatePercent: clampPercent(planPercent),
      efficiencyHitRatePercent: clampPercent(avgEff),
      absenteeismPercent: clampPercent(absenteeism),
      rejectionPercent: clampPercent(defectRate),

      // keep some tie-break helpers
      __achieved: achieved,
      __target: target,
    };
  });

  const activeRows = normalized.filter((r) => r.active);
  const inactiveRows = normalized.filter((r) => !r.active);

  // ---- Excel-like thresholds (match your screenshot style) ----
  // Amount hit rate: rank<=2 =>25, rank<=5 =>10, rank<=10 =>5
  const AMOUNT_MARKS = [
    { maxRank: 2, marks: 25 },
    { maxRank: 5, marks: 10 },
    { maxRank: 10, marks: 5 },
  ];

  // Efficiency hit rate: rank<=2 =>10, rank<=5 =>4, rank<=10 =>2
  const EFF_MARKS = [
    { maxRank: 2, marks: 10 },
    { maxRank: 5, marks: 4 },
    { maxRank: 10, marks: 2 },
  ];

  // Absenteeism (LOW is best): rank<=6 =>15, rank<=9 =>10, else =>4
  const ABS_MARKS = [
    { maxRank: 6, marks: 15 },
    { maxRank: 9, marks: 10 },
    { maxRank: Number.POSITIVE_INFINITY, marks: 4 },
  ];

  // Rejection (LOW is best): rank<=4 =>25, else =>20
  const REJ_MARKS = [
    { maxRank: 4, marks: 25 },
    { maxRank: Number.POSITIVE_INFINITY, marks: 20 },
  ];

  // ranks (dense ranks so ties behave like Excel)
  const rankAmount = denseRanks(activeRows, (r) => r.amountHitRatePercent, "desc");
  const rankEff = denseRanks(activeRows, (r) => r.efficiencyHitRatePercent, "desc");
  const rankAbs = denseRanks(activeRows, (r) => r.absenteeismPercent, "asc");
  const rankRej = denseRanks(activeRows, (r) => r.rejectionPercent, "asc");

  const withMarksActive = activeRows.map((r) => {
    const ra = rankAmount.get(r.__key) || 0;
    const re = rankEff.get(r.__key) || 0;
    const rab = rankAbs.get(r.__key) || 0;
    const rr = rankRej.get(r.__key) || 0;

    const amountMarks = marksByRank(ra, AMOUNT_MARKS);
    const efficiencyMarks = marksByRank(re, EFF_MARKS);
    const absenteeismMarks = marksByRank(rab, ABS_MARKS);
    const rejectionMarks = marksByRank(rr, REJ_MARKS);

    const totalMarks = amountMarks + efficiencyMarks + absenteeismMarks + rejectionMarks;

    return {
      ...r,
      marks: {
        amountMarks,
        efficiencyMarks,
        absenteeismMarks,
        rejectionMarks,
        totalMarks,
      },
    };
  });

  const withMarksInactive = inactiveRows.map((r) => ({
    ...r,
    marks: {
      amountMarks: 0,
      efficiencyMarks: 0,
      absenteeismMarks: 0,
      rejectionMarks: 0,
      totalMarks: 0,
    },
  }));

  // sort like your “Place”: totalMarks desc, then absenteeism asc, then rejection asc, then efficiency desc, then hit desc
  const sorted = [...withMarksActive, ...withMarksInactive].sort((a, b) => {
    if (b.marks.totalMarks !== a.marks.totalMarks) return b.marks.totalMarks - a.marks.totalMarks;

    // tie-breakers (this makes your 40/40/40 style ties stable)
    if (a.absenteeismPercent !== b.absenteeismPercent) return a.absenteeismPercent - b.absenteeismPercent;
    if (a.rejectionPercent !== b.rejectionPercent) return a.rejectionPercent - b.rejectionPercent;
    if (b.efficiencyHitRatePercent !== a.efficiencyHitRatePercent)
      return b.efficiencyHitRatePercent - a.efficiencyHitRatePercent;
    if (b.amountHitRatePercent !== a.amountHitRatePercent)
      return b.amountHitRatePercent - a.amountHitRatePercent;

    // last tie-break
    if (b.__achieved !== a.__achieved) return b.__achieved - a.__achieved;
    return String(a[labelKey]).localeCompare(String(b[labelKey]));
  });

  const placed = sorted.map((r, idx) => ({
    [labelKey]: r[labelKey],
    active: r.active,

    amountHitRatePercent: r.amountHitRatePercent,
    amountMarks: r.marks.amountMarks,

    efficiencyHitRatePercent: r.efficiencyHitRatePercent,
    efficiencyMarks: r.marks.efficiencyMarks,

    absenteeismPercent: r.absenteeismPercent,
    absenteeismMarks: r.marks.absenteeismMarks,

    rejectionPercent: r.rejectionPercent,
    rejectionMarks: r.marks.rejectionMarks,

    totalMarks: r.marks.totalMarks,
    place: idx + 1,
  }));

  return {
    bestLabel: placed?.[0]?.[labelKey] || "",
    rows: placed,
  };
}

// ==================================================================
// GET /api/floor-summary?factory=K-2&date=2025-12-09&building=A-2(optional)
// ==================================================================
export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const factory = searchParams.get("factory");
    const building = searchParams.get("building"); // "" => all buildings
    const date = searchParams.get("date");

    if (!factory || !date) {
      return NextResponse.json(
        { success: false, message: "factory এবং date লাগবে" },
        { status: 400 }
      );
    }

    // ============================
    // 1) TARGET HEADER (per line)
    // ============================
    const headerFilter = { factory, date };
    if (building) headerFilter.assigned_building = building;

    const headers = await TargetSetterHeader.find(headerFilter).lean();

    const headerMap = {};
    const productionLineAgg = {};
    const productionBuildingAgg = {};

    // NEW: manpower aggregation (for absenteeism %)
    const manpowerLineAgg = {};
    const manpowerBuildingAgg = {};

    function ensureLineAgg(lineName) {
      if (!productionLineAgg[lineName]) {
        productionLineAgg[lineName] = {
          line: lineName,
          targetQty: 0,
          achievedQty: 0,
          varianceQty: 0,
          currentHour: null,
          currentHourEfficiency: 0,
          avgEffPercent: 0,
          // minute-based eff calc for line
          produceMinutesTotal: 0,
          availableMinutesTotal: 0,
          hourProduce: {},
          hourAvailable: {},
        };
      }
      return productionLineAgg[lineName];
    }

    function ensureBuildingProdAgg(buildingName) {
      const key = buildingName || "UNKNOWN";
      if (!productionBuildingAgg[key]) {
        productionBuildingAgg[key] = {
          building: key,
          targetQty: 0,
          achievedQty: 0,
          varianceQty: 0,
          currentHour: null,
          currentHourEfficiency: 0,
          avgEffPercent: 0,
          // minute-based eff calc
          produceMinutesTotal: 0,
          availableMinutesTotal: 0,
          hourProduce: {},
          hourAvailable: {},
        };
      }
      return productionBuildingAgg[key];
    }

    function ensureLineMp(lineName) {
      if (!manpowerLineAgg[lineName]) {
        manpowerLineAgg[lineName] = { total: 0, present: 0, absent: 0 };
      }
      return manpowerLineAgg[lineName];
    }

    function ensureBuildingMp(buildingName) {
      const key = buildingName || "UNKNOWN";
      if (!manpowerBuildingAgg[key]) {
        manpowerBuildingAgg[key] = { total: 0, present: 0, absent: 0 };
      }
      return manpowerBuildingAgg[key];
    }

    const factoryProductionAgg = {
      totalTargetQty: 0,
      totalAchievedQty: 0,
      totalVarianceQty: 0,
      produceMinutesTotal: 0,
      availableMinutesTotal: 0,
      hourProduce: {},
      hourAvailable: {},
      currentHour: null,
      currentHourEfficiency: 0,
      avgEffPercent: 0,
    };

    // 1.a) Base target + manpower from headers
    for (const h of headers) {
      const lineName = h.line;
      const buildingName = h.assigned_building || "UNKNOWN";

      const agg = ensureLineAgg(lineName);
      const bAgg = ensureBuildingProdAgg(buildingName);

      // manpower sum (absenteeism%)
      const mpLine = ensureLineMp(lineName);
      const mpBuild = ensureBuildingMp(buildingName);

      mpLine.total += toNumberOrZero(h.total_manpower);
      mpLine.present += toNumberOrZero(h.manpower_present);
      mpLine.absent += toNumberOrZero(h.manpower_absent);

      mpBuild.total += toNumberOrZero(h.total_manpower);
      mpBuild.present += toNumberOrZero(h.manpower_present);
      mpBuild.absent += toNumberOrZero(h.manpower_absent);

      const baseTargetPerHour = computeBaseTargetPerHourFromHeader(h);
      const workingHours = toNumberOrZero(h.working_hour);

      const headerBaseTarget =
        Number.isFinite(baseTargetPerHour) && Number.isFinite(workingHours)
          ? Math.round(baseTargetPerHour * workingHours)
          : 0;

      agg.targetQty += headerBaseTarget;
      bAgg.targetQty += headerBaseTarget;
      factoryProductionAgg.totalTargetQty += headerBaseTarget;

      headerMap[h._id.toString()] = h;
    }

    const allHeaderIds = headers.map((h) => h._id);
    let hourlyRecs = [];

    // ============================
    // 2) HOURLY PRODUCTION RECORDS
    // ============================
    if (allHeaderIds.length > 0) {
      hourlyRecs = await HourlyProductionModel.find({
        factory,
        productionDate: date,
        headerId: { $in: allHeaderIds },
      }).lean();
    }

    for (const rec of hourlyRecs) {
      const header = headerMap[rec.headerId.toString()];
      if (!header) continue;

      const lineName = header.line;
      const buildingName = header.assigned_building || "UNKNOWN";

      const agg = ensureLineAgg(lineName);
      const bAgg = ensureBuildingProdAgg(buildingName);

      const achieved = toNumberOrZero(rec.achievedQty);
      const hour = toNumberOrZero(rec.hour);

      const mp = toNumberOrZero(header.manpower_present);
      const smv = toNumberOrZero(header.smv);

      // line-wise qty
      agg.achievedQty += achieved;

      // line-wise minutes-based efficiency
      if (mp > 0 && smv > 0) {
        const produceMinutes = achieved * smv;
        const availableMinutes = mp * 60;

        agg.produceMinutesTotal += produceMinutes;
        agg.availableMinutesTotal += availableMinutes;

        if (!agg.hourProduce[hour]) {
          agg.hourProduce[hour] = 0;
          agg.hourAvailable[hour] = 0;
        }
        agg.hourProduce[hour] += produceMinutes;
        agg.hourAvailable[hour] += availableMinutes;
      }

      // building-wise qty
      bAgg.achievedQty += achieved;

      if (mp > 0 && smv > 0) {
        const produceMinutes = achieved * smv;
        const availableMinutes = mp * 60;

        bAgg.produceMinutesTotal += produceMinutes;
        bAgg.availableMinutesTotal += availableMinutes;

        if (!bAgg.hourProduce[hour]) {
          bAgg.hourProduce[hour] = 0;
          bAgg.hourAvailable[hour] = 0;
        }
        bAgg.hourProduce[hour] += produceMinutes;
        bAgg.hourAvailable[hour] += availableMinutes;
      }

      // factory totals
      factoryProductionAgg.totalAchievedQty += achieved;

      if (mp > 0 && smv > 0) {
        const produceMinutes = achieved * smv;
        const availableMinutes = mp * 60;

        factoryProductionAgg.produceMinutesTotal += produceMinutes;
        factoryProductionAgg.availableMinutesTotal += availableMinutes;

        if (!factoryProductionAgg.hourProduce[hour]) {
          factoryProductionAgg.hourProduce[hour] = 0;
          factoryProductionAgg.hourAvailable[hour] = 0;
        }
        factoryProductionAgg.hourProduce[hour] += produceMinutes;
        factoryProductionAgg.hourAvailable[hour] += availableMinutes;
      }
    }

    // finalize per-line variance + avgEff (minutes-based)
    Object.values(productionLineAgg).forEach((agg) => {
      agg.varianceQty = agg.achievedQty - agg.targetQty;

      agg.avgEffPercent =
        agg.availableMinutesTotal > 0
          ? (agg.produceMinutesTotal / agg.availableMinutesTotal) * 100
          : 0;

      const hourKeys = Object.keys(agg.hourProduce).map((h) => Number(h));
      if (hourKeys.length > 0) {
        const maxHour = Math.max(...hourKeys);
        const prodMin = agg.hourProduce[maxHour] || 0;
        const availMin = agg.hourAvailable[maxHour] || 0;

        agg.currentHour = maxHour;
        agg.currentHourEfficiency = availMin > 0 ? (prodMin / availMin) * 100 : 0;
      } else {
        agg.currentHour = null;
        agg.currentHourEfficiency = 0;
      }

      delete agg.produceMinutesTotal;
      delete agg.availableMinutesTotal;
      delete agg.hourProduce;
      delete agg.hourAvailable;
    });

    // finalize building-wise
    Object.values(productionBuildingAgg).forEach((agg) => {
      agg.varianceQty = agg.achievedQty - agg.targetQty;

      agg.avgEffPercent =
        agg.availableMinutesTotal > 0
          ? (agg.produceMinutesTotal / agg.availableMinutesTotal) * 100
          : 0;

      const hourKeys = Object.keys(agg.hourProduce).map((h) => Number(h));
      if (hourKeys.length > 0) {
        const maxHour = Math.max(...hourKeys);
        const prodMin = agg.hourProduce[maxHour] || 0;
        const availMin = agg.hourAvailable[maxHour] || 0;

        agg.currentHour = maxHour;
        agg.currentHourEfficiency = availMin > 0 ? (prodMin / availMin) * 100 : 0;
      } else {
        agg.currentHour = null;
        agg.currentHourEfficiency = 0;
      }

      delete agg.produceMinutesTotal;
      delete agg.availableMinutesTotal;
      delete agg.hourProduce;
      delete agg.hourAvailable;
    });

    // finalize factory
    factoryProductionAgg.totalVarianceQty =
      factoryProductionAgg.totalAchievedQty - factoryProductionAgg.totalTargetQty;

    factoryProductionAgg.avgEffPercent =
      factoryProductionAgg.availableMinutesTotal > 0
        ? (factoryProductionAgg.produceMinutesTotal / factoryProductionAgg.availableMinutesTotal) *
          100
        : 0;

    const factoryHourKeys = Object.keys(factoryProductionAgg.hourProduce).map((h) => Number(h));
    if (factoryHourKeys.length > 0) {
      const maxHour = Math.max(...factoryHourKeys);
      const prodMin = factoryProductionAgg.hourProduce[maxHour] || 0;
      const availMin = factoryProductionAgg.hourAvailable[maxHour] || 0;

      factoryProductionAgg.currentHour = maxHour;
      factoryProductionAgg.currentHourEfficiency = availMin > 0 ? (prodMin / availMin) * 100 : 0;
    }

    // ============================
    // 3) QUALITY (line + factory)
    // ============================
    const { start, end } = getDayRange(date);

    const qualityMatch = { factory, reportDate: { $gte: start, $lte: end } };
    if (building) qualityMatch.building = building;

    const qualityAggDocs = await HourlyInspectionModel.aggregate([
      { $match: qualityMatch },
      {
        $group: {
          _id: "$line",
          totalInspected: { $sum: "$inspectedQty" },
          totalPassed: { $sum: "$passedQty" },
          totalDefectivePcs: { $sum: "$defectivePcs" },
          totalDefects: { $sum: "$totalDefects" },
          maxHourIndex: { $max: "$hourIndex" },
        },
      },
    ]);

    const qualityLineAgg = {};
    const factoryQualityAgg = {
      totalInspected: 0,
      totalPassed: 0,
      totalDefectivePcs: 0,
      totalDefects: 0,
      rftPercent: 0,
      defectRatePercent: 0,
      dhuPercent: 0,
      currentHour: null,
    };

    for (const doc of qualityAggDocs) {
      const lineName = doc._id;
      const totalInspected = toNumberOrZero(doc.totalInspected);
      const totalPassed = toNumberOrZero(doc.totalPassed);
      const totalDefectivePcs = toNumberOrZero(doc.totalDefectivePcs);
      const totalDefects = toNumberOrZero(doc.totalDefects);

      const rftPercent = totalInspected > 0 ? (totalPassed / totalInspected) * 100 : 0;
      const defectRatePercent =
        totalInspected > 0 ? (totalDefectivePcs / totalInspected) * 100 : 0;
      const dhuPercent = totalInspected > 0 ? (totalDefects / totalInspected) * 100 : 0;

      const currentHour = Number(doc.maxHourIndex ?? 0) > 0 ? Number(doc.maxHourIndex) : null;

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

      factoryQualityAgg.totalInspected += totalInspected;
      factoryQualityAgg.totalPassed += totalPassed;
      factoryQualityAgg.totalDefectivePcs += totalDefectivePcs;
      factoryQualityAgg.totalDefects += totalDefects;

      if (
        currentHour != null &&
        (factoryQualityAgg.currentHour == null || currentHour > factoryQualityAgg.currentHour)
      ) {
        factoryQualityAgg.currentHour = currentHour;
      }
    }

    if (factoryQualityAgg.totalInspected > 0) {
      factoryQualityAgg.rftPercent =
        (factoryQualityAgg.totalPassed / factoryQualityAgg.totalInspected) * 100;
      factoryQualityAgg.defectRatePercent =
        (factoryQualityAgg.totalDefectivePcs / factoryQualityAgg.totalInspected) * 100;
      factoryQualityAgg.dhuPercent =
        (factoryQualityAgg.totalDefects / factoryQualityAgg.totalInspected) * 100;
    }

    // building-wise quality aggregation
    const qualityBuildingAgg = {};
    const qualityAggByBuildingDocs = await HourlyInspectionModel.aggregate([
      { $match: qualityMatch },
      {
        $group: {
          _id: "$building",
          totalInspected: { $sum: "$inspectedQty" },
          totalPassed: { $sum: "$passedQty" },
          totalDefectivePcs: { $sum: "$defectivePcs" },
          totalDefects: { $sum: "$totalDefects" },
          maxHourIndex: { $max: "$hourIndex" },
        },
      },
    ]);

    for (const doc of qualityAggByBuildingDocs) {
      const buildingName = doc._id || "UNKNOWN";
      const totalInspected = toNumberOrZero(doc.totalInspected);
      const totalPassed = toNumberOrZero(doc.totalPassed);
      const totalDefectivePcs = toNumberOrZero(doc.totalDefectivePcs);
      const totalDefects = toNumberOrZero(doc.totalDefects);

      const rftPercent = totalInspected > 0 ? (totalPassed / totalInspected) * 100 : 0;
      const defectRatePercent =
        totalInspected > 0 ? (totalDefectivePcs / totalInspected) * 100 : 0;
      const dhuPercent = totalInspected > 0 ? (totalDefects / totalInspected) * 100 : 0;

      const currentHour = Number(doc.maxHourIndex ?? 0) > 0 ? Number(doc.maxHourIndex) : null;

      qualityBuildingAgg[buildingName] = {
        building: buildingName,
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
    // 4) MERGED line list
    // ============================
    const lineNames = new Set([
      ...Object.keys(productionLineAgg),
      ...Object.keys(qualityLineAgg),
    ]);

    const lines = Array.from(lineNames)
      .sort()
      .map((ln) => {
        const prod =
          productionLineAgg[ln] || {
            line: ln,
            targetQty: 0,
            achievedQty: 0,
            varianceQty: 0,
            currentHour: null,
            currentHourEfficiency: 0,
            avgEffPercent: 0,
          };

        const qual =
          qualityLineAgg[ln] || {
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

        const mp = manpowerLineAgg[ln] || { total: 0, present: 0, absent: 0 };

        return {
          line: ln,
          production: {
            ...prod,
            avgEffPercent: clampPercent(prod.avgEffPercent),
            currentHourEfficiency: clampPercent(prod.currentHourEfficiency),
          },
          quality: {
            ...qual,
            rftPercent: clampPercent(qual.rftPercent),
            defectRatePercent: clampPercent(qual.defectRatePercent),
            dhuPercent: clampPercent(qual.dhuPercent),
          },
          manpower: {
            ...mp,
            absenteeismPercent:
              mp.total > 0 ? clampPercent((toNumberOrZero(mp.absent) / toNumberOrZero(mp.total)) * 100) : 0,
          },
        };
      });

    // merged building list
    const buildingNames = new Set([
      ...Object.keys(productionBuildingAgg),
      ...Object.keys(qualityBuildingAgg),
    ]);

    const buildingsArr = Array.from(buildingNames)
      .filter((b) => b && b !== "UNKNOWN")
      .sort()
      .map((b) => {
        const prod =
          productionBuildingAgg[b] || {
            building: b,
            targetQty: 0,
            achievedQty: 0,
            varianceQty: 0,
            currentHour: null,
            currentHourEfficiency: 0,
            avgEffPercent: 0,
          };

        const qual =
          qualityBuildingAgg[b] || {
            building: b,
            totalInspected: 0,
            totalPassed: 0,
            totalDefectivePcs: 0,
            totalDefects: 0,
            rftPercent: 0,
            defectRatePercent: 0,
            dhuPercent: 0,
            currentHour: null,
          };

        const mp = manpowerBuildingAgg[b] || { total: 0, present: 0, absent: 0 };

        return {
          building: b,
          production: {
            ...prod,
            avgEffPercent: clampPercent(prod.avgEffPercent),
            currentHourEfficiency: clampPercent(prod.currentHourEfficiency),
          },
          quality: {
            ...qual,
            rftPercent: clampPercent(qual.rftPercent),
            defectRatePercent: clampPercent(qual.defectRatePercent),
            dhuPercent: clampPercent(qual.dhuPercent),
          },
          manpower: {
            ...mp,
            absenteeismPercent:
              mp.total > 0 ? clampPercent((toNumberOrZero(mp.absent) / toNumberOrZero(mp.total)) * 100) : 0,
          },
        };
      });

    // ============================
    // 4.5) BEST LINE / BEST FLOOR (Excel-like marks)
    // ============================
    const bestLineSelection = computeBestSelection(lines, "line");
    const bestBuildingSelection = computeBestSelection(buildingsArr, "building");

    // ============================
    // 5) RESPONSE
    // ============================
    return NextResponse.json({
      success: true,
      factory,
      building: building || "",
      date,
      summary: {
        production: {
          totalTargetQty: factoryProductionAgg.totalTargetQty,
          totalAchievedQty: factoryProductionAgg.totalAchievedQty,
          totalVarianceQty: factoryProductionAgg.totalVarianceQty,
          avgEffPercent: clampPercent(factoryProductionAgg.avgEffPercent),
          currentHour: factoryProductionAgg.currentHour,
          currentHourEfficiency: clampPercent(factoryProductionAgg.currentHourEfficiency),
        },
        quality: {
          totalInspected: factoryQualityAgg.totalInspected,
          totalPassed: factoryQualityAgg.totalPassed,
          totalDefectivePcs: factoryQualityAgg.totalDefectivePcs,
          totalDefects: factoryQualityAgg.totalDefects,
          rftPercent: clampPercent(factoryQualityAgg.rftPercent),
          defectRatePercent: clampPercent(factoryQualityAgg.defectRatePercent),
          dhuPercent: clampPercent(factoryQualityAgg.dhuPercent),
          currentHour: factoryQualityAgg.currentHour,
        },
      },
      lines,
      buildings: buildingsArr,
      bestLineSelection, // ✅ table rows + bestLabel
      bestBuildingSelection, // ✅ for "All floors" mode
    });
  } catch (err) {
    console.error("GET /api/floor-summary error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Server error" },
      { status: 500 }
    );
  }
}
