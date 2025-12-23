// app/api/target-setter-header/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/services/mongo";
import TargetSetterHeader from "@/models/TargetSetterHeader";

function toNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function computeTargetFullDay({
  manpower_present,
  working_hour,
  smv,
  plan_efficiency_percent,
}) {
  const mp = toNumberOrNull(manpower_present);
  const hr = toNumberOrNull(working_hour);
  const smvNum = toNumberOrNull(smv);
  const eff = toNumberOrNull(plan_efficiency_percent);

  if (!mp || !hr || !smvNum || !eff) return 0;

  const totalMinutes = mp * hr * 60;
  const effFactor = eff / 100;
  const target = (totalMinutes / smvNum) * effFactor;

  return Math.round(target);
}

export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);

    const filters = {};
    const assigned_building = searchParams.get("assigned_building");
    const line = searchParams.get("line");
    const date = searchParams.get("date");
    const buyer = searchParams.get("buyer");
    const style = searchParams.get("style");
    const Item = searchParams.get("Item");
    const factory = searchParams.get("factory");

    // ✅ new: prefill support
    const latest = searchParams.get("latest"); // "1"
    const beforeDate = searchParams.get("beforeDate"); // YYYY-MM-DD

    if (assigned_building) filters.assigned_building = assigned_building;
    if (line) filters.line = line;
    if (buyer) filters.buyer = buyer;
    if (style) filters.style = style;
    if (Item) filters.Item = Item;
    if (factory) filters.factory = factory;

    // ✅ if latest=1 -> return latest previous doc (date < beforeDate)
    if (latest === "1") {
      if (beforeDate) {
        filters.date = { $lt: beforeDate };
      }

      const doc = await TargetSetterHeader.findOne(filters).sort({
        date: -1,
        createdAt: -1,
      });

      return NextResponse.json({ success: true, data: doc || null });
    }

    // normal list (exact date)
    if (date) filters.date = date;

    const headers = await TargetSetterHeader.find(filters).sort({ createdAt: -1 });

    return NextResponse.json({ success: true, data: headers });
  } catch (err) {
    console.error("GET /api/target-setter-header error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to fetch target setter headers" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await dbConnect();

    const body = await req.json();

    let {
      date,
      assigned_building,
      line,
      factory,
      buyer,
      style,
      Item,
      run_day,
      color_model,
      total_manpower,
      manpower_present,
      manpower_absent,
      working_hour,
      plan_quantity,
      plan_efficiency_percent,
      smv,
      capacity,
      user,
    } = body;

    if (!date) {
      const now = new Date();
      date = now.toISOString().split("T")[0];
    }

    const itemVal = typeof Item === "string" ? Item.trim().toUpperCase() : "";
    const colorModelVal =
      typeof color_model === "string" ? color_model.trim().toUpperCase() : "";

    const runDayNum = toNumberOrNull(run_day);
    const totalManpowerNum = toNumberOrNull(total_manpower);
    const manpowerPresentNum = toNumberOrNull(manpower_present);
    let manpowerAbsentNum = toNumberOrNull(manpower_absent);
    const workingHourNum = toNumberOrNull(working_hour);
    const planQuantityNum = toNumberOrNull(plan_quantity);
    const planEffNum = toNumberOrNull(plan_efficiency_percent);
    const smvNum = toNumberOrNull(smv);
    const capacityNum = toNumberOrNull(capacity);

    if (totalManpowerNum != null && manpowerPresentNum != null) {
      manpowerAbsentNum = Math.max(0, totalManpowerNum - manpowerPresentNum);
    }

    let userPayload = null;
    if (user && (user.id || user._id || user.user_id)) {
      const id = user.id || user._id || user.user_id;
      userPayload = {
        id: String(id),
        user_name: user.user_name || "",
        role: user.role || "",
      };
    }

    if (!factory) {
      return NextResponse.json(
        { success: false, message: "Factory is required." },
        { status: 400 }
      );
    }

    if (
      !date ||
      !assigned_building ||
      !factory ||
      !line ||
      !buyer ||
      !style ||
      !itemVal ||
      runDayNum == null ||
      !colorModelVal ||
      totalManpowerNum == null ||
      manpowerPresentNum == null ||
      manpowerAbsentNum == null ||
      workingHourNum == null ||
      planQuantityNum == null ||
      planEffNum == null ||
      smvNum == null ||
      capacityNum == null
    ) {
      return NextResponse.json(
        { success: false, message: "Missing or invalid required fields." },
        { status: 400 }
      );
    }

    const target_full_day = computeTargetFullDay({
      manpower_present: manpowerPresentNum,
      working_hour: workingHourNum,
      smv: smvNum,
      plan_efficiency_percent: planEffNum,
    });

    const doc = await TargetSetterHeader.create({
      date,
      assigned_building,
      factory,
      line,
      buyer,
      style,
      Item: itemVal,
      run_day: runDayNum,
      color_model: colorModelVal,
      total_manpower: totalManpowerNum,
      manpower_present: manpowerPresentNum,
      manpower_absent: manpowerAbsentNum,
      working_hour: workingHourNum,
      plan_quantity: planQuantityNum,
      plan_efficiency_percent: planEffNum,
      smv: smvNum,
      target_full_day,
      capacity: capacityNum,
      user: userPayload,
    });

    return NextResponse.json({ success: true, data: doc }, { status: 201 });
  } catch (err) {
    console.error("POST /api/target-setter-header error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to create target setter header" },
      { status: 500 }
    );
  }
}
