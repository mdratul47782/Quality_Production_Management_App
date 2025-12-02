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

// ======================= GET =======================
export async function GET(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);

    const headerId = searchParams.get("headerId");
    const productionUserId = searchParams.get("productionUserId");
    const assigned_building = searchParams.get("assigned_building");
    const line = searchParams.get("line");
    const date = searchParams.get("date");
    const days = parseInt(searchParams.get("days") || "30", 10);

    // 1) Specific header (current Hourly card)
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

    // 2) Building + Line + Date ভিত্তিক API
    // /api/hourly-productions?assigned_building=B-4&line=Line-3&date=2025-12-02&productionUserId=...
    if (assigned_building && line && date) {
      const headers = await TargetSetterHeader.find({
        assigned_building,
        line,
        date,
      })
        .select("_id")
        .lean();

      if (!headers.length) {
        return Response.json({ success: true, data: [] }, { status: 200 });
      }

      const headerIds = headers.map((h) => h._id);

      const query = { headerId: { $in: headerIds } };
      if (productionUserId) {
        query["productionUser.id"] = productionUserId;
      }

      const records = await HourlyProductionModel.find(query)
        .sort({ hour: 1 })
        .lean();

      return Response.json({ success: true, data: records }, { status: 200 });
    }

    // 3) Production user history (last N days)
    if (!productionUserId) {
      return Response.json(
        {
          success: false,
          message:
            "Need either headerId OR (assigned_building + line + date) OR productionUserId",
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

// ======================= POST =======================
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

    // Previous hours for same header + same user
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

    const baselineToDatePrev = baseTargetPerHour * (hour - 1);
    const shortfallPrevVsBase = Math.max(
      0,
      baselineToDatePrev - totalAchievedBefore
    );

    const dynamicTarget = baseTargetPerHour + shortfallPrevVsBase;
    const varianceQty = achievedQty - dynamicTarget;

    const totalAchievedUpToThisHour = totalAchievedBefore + achievedQty;
    const baselineToDateCurrent = baseTargetPerHour * hour;
    const cumulativeVariance =
      totalAchievedUpToThisHour - baselineToDateCurrent;

    const hourlyEfficiency =
      manpowerPresent > 0 && smv > 0
        ? (achievedQty * smv * 100) / (manpowerPresent * 60)
        : 0;

    const achieveEfficiency =
      manpowerPresent > 0 && smv > 0 && hour > 0
        ? (totalAchievedUpToThisHour * smv * 100) /
          (manpowerPresent * 60 * hour)
        : 0;

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

    // ✅ Upsert per (headerId + productionUser.id + hour)
    const existing = await HourlyProductionModel.findOne({
      headerId,
      "productionUser.id": productionUser.id,
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

    // Duplicate key nice handling
    if (error.code === 11000) {
      return Response.json(
        {
          success: false,
          message:
            "This hour is already saved for this header & user. Reload / edit existing record instead.",
        },
        { status: 409 }
      );
    }

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to save hourly production record",
      },
      { status: 500 }
    );
  }
}
