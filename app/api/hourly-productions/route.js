// app/api/hourly-productions/route.js
import { dbConnect } from "@/services/mongo";
import TargetSetterHeader from "@/models/TargetSetterHeader";
import { HourlyProductionModel } from "@/models/HourlyProduction-model";

// Safe number parse
function toNumberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Base target/hr from TargetSetterHeader
// Target/hr = manpower_present × 60 × plan_eff% ÷ SMV
// Fallback: target_full_day / working_hour
function computeBaseTargetPerHourFromHeader(header) {
  const workingHour = toNumberOrZero(header.working_hour);
  const manpowerPresent = toNumberOrZero(header.manpower_present);
  const smv = toNumberOrZero(header.smv);
  const planEffPercent = toNumberOrZero(header.plan_efficiency_percent);
  const planEffDecimal = planEffPercent / 100;
  const targetFullDay = toNumberOrZero(header.target_full_day);

  const targetFromCapacity =
    manpowerPresent > 0 && smv > 0
      ? (manpowerPresent * 60 * planEffDecimal) / smv
      : 0;

  const targetFromFullDay =
    workingHour > 0 ? targetFullDay / workingHour : 0;

  return targetFromCapacity || targetFromFullDay || 0;
}

// 🔸 GET /api/hourly-productions?headerId=...&productionUserId=...&days=30
export async function GET(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const headerId = searchParams.get("headerId");
    const productionUserId = searchParams.get("productionUserId");
    const days = parseInt(searchParams.get("days") || "30", 10);

    // 1) For a specific header (line + style segment)
    if (headerId) {
      const query = { headerId };
      if (productionUserId) {
        query["productionUser.id"] = productionUserId;
      }

      const records = await HourlyProductionModel.find(query)
        .sort({ hour: 1 })
        .lean();

      return Response.json({ success: true, data: records }, { status: 200 });
    }

    // 2) For a production user over last N days (for MonthlyEfficiencyChart)
    if (!productionUserId) {
      return Response.json(
        {
          success: false,
          message: "Either headerId or productionUserId is required",
        },
        { status: 400 }
      );
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startStr = startDate.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const endStr = endDate.toISOString().slice(0, 10);

    const records = await HourlyProductionModel.find({
      "productionUser.id": productionUserId,
      productionDate: {
        $gte: startStr,
        $lte: endStr,
      },
    })
      .sort({ productionDate: 1, hour: 1 })
      .lean();

    return Response.json({ success: true, data: records }, { status: 200 });
  } catch (error) {
    console.error("GET /api/hourly-productions error:", error);
    return Response.json(
      { success: false, message: "Failed to fetch hourly production records" },
      { status: 500 }
    );
  }
}

// 🔸 POST /api/hourly-productions
// Body:
// {
//   headerId: string,
//   hour: number,
//   achievedQty: number,
//   productionUser: { id, Production_user_name, phone, bio }
// }
export async function POST(request) {
  try {
    await dbConnect();

    const body = await request.json();
    const errors = [];

    const headerId = body.headerId;
    const hour = toNumberOrZero(body.hour);
    const achievedQtyRaw = toNumberOrZero(body.achievedQty);
    const achievedQty = Math.round(achievedQtyRaw);
    const productionUser = body.productionUser;

    if (!headerId) errors.push("headerId is required");
    if (!hour || hour <= 0) errors.push("hour must be a positive number");
    if (!productionUser || !productionUser.id)
      errors.push("productionUser.id is required");
    if (!Number.isFinite(achievedQty) || achievedQty < 0)
      errors.push("achievedQty must be a non-negative number");

    if (errors.length > 0) {
      return Response.json({ success: false, errors }, { status: 400 });
    }

    // 🔹 Header from TargetSetterHeader (by building + line + date UI)
    const header = await TargetSetterHeader.findById(headerId).lean();

    if (!header) {
      return Response.json(
        { success: false, message: "Target header not found" },
        { status: 404 }
      );
    }

    const manpowerPresent = toNumberOrZero(header.manpower_present);
    const smv = toNumberOrZero(header.smv);
    const productionDate = header.date || new Date().toISOString().slice(0, 10);

    const baseTargetPerHour = computeBaseTargetPerHourFromHeader(header);

    // 🔹 Previous hours for this header + production user
    const previousRecords = await HourlyProductionModel.find({
      headerId,
      "productionUser.id": productionUser.id,
      hour: { $lt: hour },
    })
      .sort({ hour: 1 })
      .lean();

    let totalAchievedBefore = 0;
    for (const rec of previousRecords) {
      totalAchievedBefore += toNumberOrZero(rec.achievedQty);
    }

    // 🔹 Dynamic target (GARMENT RULE)
    // Baseline up to previous hour: base * (hour - 1)
    // Shortfall vs BASE (not vs dynamic): max(0, baseline - achievedBefore)
    const baselineToDatePrev = baseTargetPerHour * (hour - 1);
    const shortfallPrevVsBase = Math.max(
      0,
      baselineToDatePrev - totalAchievedBefore
    );

    const dynamicTarget = baseTargetPerHour + shortfallPrevVsBase;

    // Δ vs dynamic this hour
    const varianceQty = achievedQty - dynamicTarget;

    // 🔹 Net variance vs BASE to date (same as your frontend decoration)
    const totalAchievedUpToThisHour = totalAchievedBefore + achievedQty;
    const baselineToDateCurrent = baseTargetPerHour * hour;
    const cumulativeVariance =
      totalAchievedUpToThisHour - baselineToDateCurrent;

    // 🔹 Efficiency calculations
    // Hourly Eff % = (Output_this_hr * SMV * 100) / (Manpower * 60)
    const hourlyEfficiency =
      manpowerPresent > 0 && smv > 0
        ? (achievedQty * smv * 100) / (manpowerPresent * 60)
        : 0;

    // AVG Eff % (AchieveEff) = (TotalOutputTillNow * SMV * 100) /
    //                          (Manpower * 60 * HourCompleted)
    const achieveEfficiency =
      manpowerPresent > 0 && smv > 0 && hour > 0
        ? (totalAchievedUpToThisHour * smv * 100) /
          (manpowerPresent * 60 * hour)
        : 0;

    // For your "AVG Eff %" column, you wanted:
    // (total produce minute / total available minute) * 100
    // That is exactly achieveEfficiency. So:
    const totalEfficiency = achieveEfficiency;

    const doc = {
      headerId,
      productionDate,
      hour,
      achievedQty,
      baseTargetPerHour,
      dynamicTarget,
      varianceQty,
      cumulativeVariance,
      hourlyEfficiency,
      achieveEfficiency,
      totalEfficiency,
      productionUser: {
        id: productionUser.id,
        Production_user_name: productionUser.Production_user_name,
        phone: productionUser.phone,
        bio: productionUser.bio,
      },
    };

    // 🔹 Upsert: one row per (headerId + productionUser.id + hour)
   const existing = await HourlyProductionModel.findOne({
  headerId,
  hour,
});

    let saved;
    if (existing) {
      Object.assign(existing, doc);
      saved = await existing.save();
    } else {
      saved = await HourlyProductionModel.create(doc);
    }

    return Response.json(
      {
        success: true,
        data: saved,
        message: "Hourly production record saved successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("POST /api/hourly-productions error:", error);
    return Response.json(
      {
        success: false,
        message: error.message || "Failed to save hourly production record",
      },
      { status: 500 }
    );
  }
}
