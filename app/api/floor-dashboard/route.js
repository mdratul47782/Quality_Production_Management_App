// app/api/floor-dashboard/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/services/mongo";

import TargetSetterHeader from "@/models/TargetSetterHeader";
import { HourlyProductionModel } from "@/models/HourlyProduction-model";
import { HourlyInspectionModel } from "@/models/hourly-inspections"; // make sure this path is correct

// ---------- helpers ----------

// "2025-12-04" -> local Date(2025, 11, 4, 00:00)
function parseLocalDateFromYMD(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Build a whole-day range based on LOCAL date
// Works for either "YYYY-MM-DD" or full ISO ("2025-12-03T18:00:00.000Z")
function getDayRange(dateStr) {
  let base;

  if (dateStr.includes("T")) {
    // full ISO string
    base = new Date(dateStr);
  } else {
    // just "YYYY-MM-DD" from <input type="date">
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
// GET /api/floor-dashboard?building=B-4&date=2025-12-04&line=Line-1|ALL
// ==================================================================
export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const building = searchParams.get("building");
    const date = searchParams.get("date");
    const line = searchParams.get("line"); // optional, "ALL" for all lines

    if (!building || !date) {
      return NextResponse.json(
        { success: false, message: "building and date are required" },
        { status: 400 }
      );
    }

    // ============================
    // PRODUCTION PART (target, eff%)
    // ============================
    const headerFilter = {
      assigned_building: building,
      date,
    };
    if (line && line !== "ALL") {
      headerFilter.line = line;
    }

    const headers = await TargetSetterHeader.find(headerFilter).lean();

    const headerIdToLine = {};
    const productionLineAgg = {};

    for (const h of headers) {
      const lineName = h.line;
      const key = lineName;

      headerIdToLine[h._id.toString()] = lineName;

      if (!productionLineAgg[key]) {
        productionLineAgg[key] = {
          line: lineName,
          targetQty: 0,
          achievedQty: 0,
          varianceQty: 0,
          currentHour: null,
          currentHourEfficiency: 0,
          _effSum: 0,
          _effCount: 0,
        };
      }

      productionLineAgg[key].targetQty += Number(h.target_full_day || 0);
    }

    const allHeaderIds = headers.map((h) => h._id);
    let hourlyRecs = [];

    if (allHeaderIds.length > 0) {
      hourlyRecs = await HourlyProductionModel.find({
        productionDate: date, // stored as "YYYY-MM-DD"
        headerId: { $in: allHeaderIds },
      }).lean();
    }

    for (const rec of hourlyRecs) {
      const lineName = headerIdToLine[rec.headerId.toString()];
      if (!lineName) continue;

      const key = lineName;
      if (!productionLineAgg[key]) {
        productionLineAgg[key] = {
          line: lineName,
          targetQty: 0,
          achievedQty: 0,
          varianceQty: 0,
          currentHour: null,
          currentHourEfficiency: 0,
          _effSum: 0,
          _effCount: 0,
        };
      }

      const agg = productionLineAgg[key];

      agg.achievedQty += Number(rec.achievedQty || 0);
      agg._effSum += Number(rec.hourlyEfficiency || 0);
      agg._effCount += 1;

      if (agg.currentHour === null || rec.hour > agg.currentHour) {
        agg.currentHour = rec.hour;
        agg.currentHourEfficiency = Number(rec.hourlyEfficiency || 0);
      }
    }

    Object.values(productionLineAgg).forEach((agg) => {
      agg.varianceQty = agg.achievedQty - agg.targetQty;
      agg.avgEffPercent =
        agg._effCount > 0 ? agg._effSum / agg._effCount : 0;
      delete agg._effSum;
      delete agg._effCount;
    });

    // ============================
    // QUALITY PART (RFT, DHU, Defect Rate)
    // ============================
    const { start, end } = getDayRange(date);

    const qualityMatch = {
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
        },
      },
    ]);

    const qualityLineAgg = {};
    for (const doc of qualityAggDocs) {
      const lineName = doc._id;
      const totalInspected = Number(doc.totalInspected || 0);
      const totalPassed = Number(doc.totalPassed || 0);
      const totalDefectivePcs = Number(doc.totalDefectivePcs || 0);
      const totalDefects = Number(doc.totalDefects || 0);

      const rftPercent =
        totalInspected > 0 ? (totalPassed / totalInspected) * 100 : 0;
      const defectRatePercent =
        totalInspected > 0 ? (totalDefectivePcs / totalInspected) * 100 : 0;
      const dhuPercent =
        totalInspected > 0 ? (totalDefects / totalInspected) * 100 : 0;

      qualityLineAgg[lineName] = {
        line: lineName,
        totalInspected,
        totalPassed,
        totalDefectivePcs,
        totalDefects,
        rftPercent,
        defectRatePercent,
        dhuPercent,
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
        };

        return {
          line: ln,
          quality: qual,
          production: prod,
        };
      });

    return NextResponse.json({
      success: true,
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
