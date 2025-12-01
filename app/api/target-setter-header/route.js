// app/api/target-setter-header/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/services/mongo";
import TargetSetterHeader from "@/models/TargetSetterHeader";

// small helpers
function toNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// typical garments target formula:
// target = (manpower_present * working_hour * 60 / smv) * (plan_efficiency_percent / 100)
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

// GET /api/target-setter-header?assigned_building=...&line=...&date=...&buyer=...&style=...
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

    if (assigned_building) filters.assigned_building = assigned_building;
    if (line) filters.line = line;
    if (date) filters.date = date;
    if (buyer) filters.buyer = buyer;
    if (style) filters.style = style;

    const headers = await TargetSetterHeader.find(filters).sort({
      createdAt: -1,
    });

    return NextResponse.json({ success: true, data: headers });
  } catch (err) {
    console.error("GET /api/target-setter-header error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to fetch target setter headers" },
      { status: 500 }
    );
  }
}

// POST /api/target-setter-header
export async function POST(req) {
  try {
    await dbConnect();

    const body = await req.json();

    let {
      date,
      assigned_building,
      line,
      buyer,
      style,
      run_day,
      color_model,
      total_manpower,
      manpower_present,
      manpower_absent, // can be ignored & recalculated
      working_hour,
      plan_quantity,
      plan_efficiency_percent,
      smv,
      capacity,
    } = body;

    // fallback: auto-set today's date if not sent (YYYY-MM-DD)
    if (!date) {
      const now = new Date();
      date = now.toISOString().split("T")[0];
    }

    // numeric conversions
    const runDayNum = toNumberOrNull(run_day);
    const totalManpowerNum = toNumberOrNull(total_manpower);
    const manpowerPresentNum = toNumberOrNull(manpower_present);
    let manpowerAbsentNum = toNumberOrNull(manpower_absent);
    const workingHourNum = toNumberOrNull(working_hour);
    const planQuantityNum = toNumberOrNull(plan_quantity);
    const planEffNum = toNumberOrNull(plan_efficiency_percent);
    const smvNum = toNumberOrNull(smv);
    const capacityNum = toNumberOrNull(capacity);

    // auto-calc absent from total - present (server is source of truth)
    if (totalManpowerNum != null && manpowerPresentNum != null) {
      manpowerAbsentNum = Math.max(0, totalManpowerNum - manpowerPresentNum);
    }

    // basic validation
    if (
      !date ||
      !assigned_building ||
      !line ||
      !buyer ||
      !style ||
      runDayNum == null ||
      !color_model ||
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
      line,
      buyer,
      style,
      run_day: runDayNum,
      color_model,
      total_manpower: totalManpowerNum,
      manpower_present: manpowerPresentNum,
      manpower_absent: manpowerAbsentNum,
      working_hour: workingHourNum,
      plan_quantity: planQuantityNum,
      plan_efficiency_percent: planEffNum,
      smv: smvNum,
      target_full_day,
      capacity: capacityNum,
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
