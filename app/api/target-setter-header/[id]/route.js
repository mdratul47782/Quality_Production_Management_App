// app/api/target-setter-header/[id]/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/services/mongo";
import TargetSetterHeader from "@/models/TargetSetterHeader";

function toNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function computeTargetFullDay(doc) {
  const mp = toNumberOrNull(doc.manpower_present);
  const hr = toNumberOrNull(doc.working_hour);
  const smvNum = toNumberOrNull(doc.smv);
  const eff = toNumberOrNull(doc.plan_efficiency_percent);

  if (!mp || !hr || !smvNum || !eff) return 0;

  const totalMinutes = mp * hr * 60;
  const effFactor = eff / 100;
  const target = (totalMinutes / smvNum) * effFactor;

  return Math.round(target);
}

// GET /api/target-setter-header/[id]?factory=K-2
export async function GET(req, context) {
  try {
    await dbConnect();

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const factory = searchParams.get("factory");

    const query = { _id: id };
    if (factory) query.factory = factory;

    const doc = await TargetSetterHeader.findOne(query);

    if (!doc) {
      return NextResponse.json(
        { success: false, message: "Target setter header not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: doc });
  } catch (err) {
    console.error("GET /api/target-setter-header/[id] error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to fetch target setter header" },
      { status: 500 }
    );
  }
}

// PATCH /api/target-setter-header/[id]?factory=K-2
export async function PATCH(req, context) {
  try {
    await dbConnect();

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const factory = searchParams.get("factory");

    const updates = await req.json();

    const query = { _id: id };
    if (factory) query.factory = factory;

    const doc = await TargetSetterHeader.findOne(query);
    if (!doc) {
      return NextResponse.json(
        { success: false, message: "Target setter header not found" },
        { status: 404 }
      );
    }

    const updatableFields = [
      "date",
      "assigned_building",
      "factory", // 🔹 allow updating factory if you ever need
      "line",
      "buyer",
      "style",
      "run_day",
      "color_model",
      "total_manpower",
      "manpower_present",
      "manpower_absent",
      "working_hour",
      "plan_quantity",
      "plan_efficiency_percent",
      "smv",
      "capacity",
      "user",
    ];

    for (const field of updatableFields) {
      if (Object.prototype.hasOwnProperty.call(updates, field)) {
        if (field === "user") {
          const u = updates.user;
          if (u) {
            const idVal = u.id || u._id || u.user_id;
            doc.user = {
              id: idVal ? String(idVal) : undefined,
              user_name: u.user_name || "",
              role: u.role || "",
            };
          }
          continue;
        }

        const isNumericField = [
          "run_day",
          "total_manpower",
          "manpower_present",
          "manpower_absent",
          "working_hour",
          "plan_quantity",
          "plan_efficiency_percent",
          "smv",
          "capacity",
        ].includes(field);

        if (isNumericField) {
          doc[field] = toNumberOrNull(updates[field]);
        } else {
          doc[field] = updates[field];
        }
      }
    }

    if (
      ("total_manpower" in updates || "manpower_present" in updates) &&
      doc.total_manpower != null &&
      doc.manpower_present != null &&
      !("manpower_absent" in updates)
    ) {
      doc.manpower_absent = Math.max(
        0,
        doc.total_manpower - doc.manpower_present
      );
    }

    doc.target_full_day = computeTargetFullDay(doc);

    await doc.save();

    return NextResponse.json({ success: true, data: doc });
  } catch (err) {
    console.error("PATCH /api/target-setter-header/[id] error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to update target setter header" },
      { status: 500 }
    );
  }
}

// DELETE /api/target-setter-header/[id]?factory=K-2
export async function DELETE(req, context) {
  try {
    await dbConnect();

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const factory = searchParams.get("factory");

    const query = { _id: id };
    if (factory) query.factory = factory;

    const deleted = await TargetSetterHeader.findOneAndDelete(query);

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Target setter header not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Target setter header deleted successfully",
      data: deleted,
    });
  } catch (err) {
    console.error("DELETE /api/target-setter-header/[id] error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to delete target setter header" },
      { status: 500 }
    );
  }
}
