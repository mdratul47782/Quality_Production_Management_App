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
  const targetFromFullDay =
    workingHour > 0 ? targetFullDay / workingHour : 0;

  return targetFromCapacity || targetFromFullDay || 0;
}

// "2025-12-08" -> local Date(2025,11,8)
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

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
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
        {
          success: false,
          message: "factory এবং date লাগবে",
        },
        { status: 400 }
      );
    }

    // ============================
    // 1) TARGET HEADER (per line)
    // ============================
    const headerFilter = {
      factory,
      date,
    };
    if (building) {
      headerFilter.assigned_building = building;
    }

    const headers = await TargetSetterHeader.find(headerFilter).lean();

    const headerMap = {};
    const headerIdToLine = {};
    const productionLineAgg = {};

    // 🔹 NEW: building-wise production aggregation
    const productionBuildingAgg = {};

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
          _effSum: 0,
          _effCount: 0,
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

    const factoryProductionAgg = {
      totalTargetQty: 0,
      totalAchievedQty: 0,
      totalVarianceQty: 0,
      // efficiency totals (factory level)
      produceMinutesTotal: 0, // Σ (output × SMV)
      availableMinutesTotal: 0, // Σ (MP × 60)
      // per-hour efficiency (for currentHour)
      hourProduce: {}, // { hour: Σ produceMinutes }
      hourAvailable: {}, // { hour: Σ availableMinutes }
      currentHour: null,
      currentHourEfficiency: 0,
      avgEffPercent: 0,
    };

    // 1.a) Base target from headers
    for (const h of headers) {
      const lineName = h.line;
      const buildingName = h.assigned_building || "UNKNOWN";

      const agg = ensureLineAgg(lineName);
      const bAgg = ensureBuildingProdAgg(buildingName);

      const baseTargetPerHourRaw = computeBaseTargetPerHourFromHeader(h);
      const baseTargetPerHourRounded = Math.round(baseTargetPerHourRaw);
      const workingHours = toNumberOrZero(h.working_hour);

      const headerBaseTarget =
        (Number.isFinite(baseTargetPerHourRounded)
          ? baseTargetPerHourRounded
          : 0) *
        (Number.isFinite(workingHours) ? workingHours : 0);

      agg.targetQty += headerBaseTarget;
      bAgg.targetQty += headerBaseTarget;
      factoryProductionAgg.totalTargetQty += headerBaseTarget;

      const idStr = h._id.toString();
      headerMap[idStr] = h;
      headerIdToLine[idStr] = lineName;
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

      // -------- line-wise aggregation ----------
      agg.achievedQty += achieved;

      agg._effSum += toNumberOrZero(rec.hourlyEfficiency);
      agg._effCount += 1;

      if (agg.currentHour === null || hour > agg.currentHour) {
        agg.currentHour = hour;
        agg.currentHourEfficiency = toNumberOrZero(rec.hourlyEfficiency);
      }

      // -------- building-wise aggregation (minutes-based) ----------
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

      // -------- factory-level qty ----------
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

    // finalize per-line variance + avgEff
    Object.values(productionLineAgg).forEach((agg) => {
      agg.varianceQty = agg.achievedQty - agg.targetQty;

      if (agg._effCount > 0) {
        agg.avgEffPercent = agg._effSum / agg._effCount;
      } else {
        agg.avgEffPercent = 0;
      }

      delete agg._effSum;
      delete agg._effCount;
    });

    // 🔹 finalize building-wise variance + eff
    Object.values(productionBuildingAgg).forEach((agg) => {
      agg.varianceQty = agg.achievedQty - agg.targetQty;

      if (agg.availableMinutesTotal > 0) {
        agg.avgEffPercent =
          (agg.produceMinutesTotal / agg.availableMinutesTotal) * 100;
      } else {
        agg.avgEffPercent = 0;
      }

      const hourKeys = Object.keys(agg.hourProduce).map((h) => Number(h));
      if (hourKeys.length > 0) {
        const maxHour = Math.max(...hourKeys);
        const prodMin = agg.hourProduce[maxHour] || 0;
        const availMin = agg.hourAvailable[maxHour] || 0;

        agg.currentHour = maxHour;
        agg.currentHourEfficiency =
          availMin > 0 ? (prodMin / availMin) * 100 : 0;
      } else {
        agg.currentHour = null;
        agg.currentHourEfficiency = 0;
      }

      delete agg.produceMinutesTotal;
      delete agg.availableMinutesTotal;
      delete agg.hourProduce;
      delete agg.hourAvailable;
    });

    // finalize factory-level variance + avgEff + currentHourEff
    factoryProductionAgg.totalVarianceQty =
      factoryProductionAgg.totalAchievedQty -
      factoryProductionAgg.totalTargetQty;

    if (factoryProductionAgg.availableMinutesTotal > 0) {
      factoryProductionAgg.avgEffPercent =
        (factoryProductionAgg.produceMinutesTotal /
          factoryProductionAgg.availableMinutesTotal) *
        100;
    } else {
      factoryProductionAgg.avgEffPercent = 0;
    }

    const hourKeys = Object.keys(factoryProductionAgg.hourProduce).map(
      (h) => Number(h)
    );
    if (hourKeys.length > 0) {
      const maxHour = Math.max(...hourKeys);
      const prodMin = factoryProductionAgg.hourProduce[maxHour] || 0;
      const availMin = factoryProductionAgg.hourAvailable[maxHour] || 0;

      factoryProductionAgg.currentHour = maxHour;
      factoryProductionAgg.currentHourEfficiency =
        availMin > 0 ? (prodMin / availMin) * 100 : 0;
    }

    // ============================
    // 3) QUALITY (line + factory)
    // ============================
    const { start, end } = getDayRange(date);

    const qualityMatch = {
      factory,
      reportDate: { $gte: start, $lte: end },
    };
    if (building) {
      qualityMatch.building = building;
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

      const rftPercent =
        totalInspected > 0 ? (totalPassed / totalInspected) * 100 : 0;
      const defectRatePercent =
        totalInspected > 0
          ? (totalDefectivePcs / totalInspected) * 100
          : 0;
      const dhuPercent =
        totalInspected > 0 ? (totalDefects / totalInspected) * 100 : 0;

      const currentHour =
        Number(doc.maxHourIndex ?? 0) > 0 ? Number(doc.maxHourIndex) : null;

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

      // factory quality sum
      factoryQualityAgg.totalInspected += totalInspected;
      factoryQualityAgg.totalPassed += totalPassed;
      factoryQualityAgg.totalDefectivePcs += totalDefectivePcs;
      factoryQualityAgg.totalDefects += totalDefects;

      if (
        currentHour != null &&
        (factoryQualityAgg.currentHour == null ||
          currentHour > factoryQualityAgg.currentHour)
      ) {
        factoryQualityAgg.currentHour = currentHour;
      }
    }

    if (factoryQualityAgg.totalInspected > 0) {
      factoryQualityAgg.rftPercent =
        (factoryQualityAgg.totalPassed /
          factoryQualityAgg.totalInspected) *
        100;
      factoryQualityAgg.defectRatePercent =
        (factoryQualityAgg.totalDefectivePcs /
          factoryQualityAgg.totalInspected) *
        100;
      factoryQualityAgg.dhuPercent =
        (factoryQualityAgg.totalDefects /
          factoryQualityAgg.totalInspected) *
        100;
    }

    // 🔹 NEW: Building-wise quality aggregation
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

      const rftPercent =
        totalInspected > 0 ? (totalPassed / totalInspected) * 100 : 0;
      const defectRatePercent =
        totalInspected > 0
          ? (totalDefectivePcs / totalInspected) * 100
          : 0;
      const dhuPercent =
        totalInspected > 0 ? (totalDefects / totalInspected) * 100 : 0;

      const currentHour =
        Number(doc.maxHourIndex ?? 0) > 0 ? Number(doc.maxHourIndex) : null;

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
          production: prod,
          quality: qual,
        };
      });

    // 🔹 NEW: MERGED building list
    const buildingNames = new Set([
      ...Object.keys(productionBuildingAgg),
      ...Object.keys(qualityBuildingAgg),
    ]);

    const buildingsArr = Array.from(buildingNames)
      .filter((b) => b && b !== "UNKNOWN")
      .sort()
      .map((b) => {
        const prod = productionBuildingAgg[b] || {
          building: b,
          targetQty: 0,
          achievedQty: 0,
          varianceQty: 0,
          currentHour: null,
          currentHourEfficiency: 0,
          avgEffPercent: 0,
        };

        const qual = qualityBuildingAgg[b] || {
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

        return {
          building: b,
          production: prod,
          quality: qual,
        };
      });

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
          currentHourEfficiency: clampPercent(
            factoryProductionAgg.currentHourEfficiency
          ),
        },
        quality: {
          totalInspected: factoryQualityAgg.totalInspected,
          totalPassed: factoryQualityAgg.totalPassed,
          totalDefectivePcs: factoryQualityAgg.totalDefectivePcs,
          totalDefects: factoryQualityAgg.totalDefects,
          rftPercent: clampPercent(factoryQualityAgg.rftPercent),
          defectRatePercent: clampPercent(
            factoryQualityAgg.defectRatePercent
          ),
          dhuPercent: clampPercent(factoryQualityAgg.dhuPercent),
          currentHour: factoryQualityAgg.currentHour,
        },
      },
      lines,
      buildings: buildingsArr, // 🔹 NEW: floor-wise aggregated data
    });
  } catch (err) {
    console.error("GET /api/floor-summary error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err.message || "Server error",
      },
      { status: 500 }
    );
  }
}
