// app/api/hourly-productions/[id]/route.js
import { dbConnect } from "@/services/mongo";
import { HourlyProductionModel } from "@/models/HourlyProduction-model";

function toNumberOrUndefined(value) {
  if (value === undefined) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

// GET /api/hourly-productions/:id
export async function GET(_request, { params = {} } = {}) {
  try {
    await dbConnect();
    const { id } = params;

    if (!id) {
      return Response.json(
        { success: false, message: "Route param 'id' is required" },
        { status: 400 }
      );
    }

    const rec = await HourlyProductionModel.findById(id).lean();
    if (!rec) {
      return Response.json(
        { success: false, message: "Hourly production record not found" },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data: rec }, { status: 200 });
  } catch (error) {
    console.error("GET /api/hourly-productions/[id] error:", error);
    return Response.json(
      { success: false, message: "Failed to fetch hourly production record" },
      { status: 500 }
    );
  }
}

// PATCH /api/hourly-productions/:id  (partial update, no global recalculation)
export async function PATCH(request, { params = {} } = {}) {
  try {
    await dbConnect();
    const { id } = params;

    if (!id) {
      return Response.json(
        { success: false, message: "Route param 'id' is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const update = {};
    const errors = [];

    const numericFields = [
      "achievedQty",
      "baseTargetPerHour",
      "dynamicTarget",
      "varianceQty",
      "cumulativeVariance",
      "hourlyEfficiency",
      "achieveEfficiency",
      "totalEfficiency",
      "hour",
    ];

    for (const field of numericFields) {
      if (field in body) {
        const parsed = toNumberOrUndefined(body[field]);
        if (parsed === undefined) {
          errors.push(`${field} must be a valid number`);
        } else {
          update[field] = parsed;
        }
      }
    }

    if (body.productionUser) {
      update.productionUser = body.productionUser;
    }

    if (errors.length > 0) {
      return Response.json({ success: false, errors }, { status: 400 });
    }

    const rec = await HourlyProductionModel.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).lean();

    if (!rec) {
      return Response.json(
        { success: false, message: "Hourly production record not found" },
        { status: 404 }
      );
    }

    return Response.json(
      {
        success: true,
        data: rec,
        message: "Hourly production record updated successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("PATCH /api/hourly-productions/[id] error:", error);
    return Response.json(
      { success: false, message: "Failed to update hourly production record" },
      { status: 500 }
    );
  }
}

// DELETE /api/hourly-productions/:id
export async function DELETE(_request, { params = {} } = {}) {
  try {
    await dbConnect();
    const { id } = params;

    if (!id) {
      return Response.json(
        { success: false, message: "Route param 'id' is required" },
        { status: 400 }
      );
    }

    const deleted = await HourlyProductionModel.findByIdAndDelete(id);
    if (!deleted) {
      return Response.json(
        { success: false, message: "Hourly production record not found" },
        { status: 404 }
      );
    }

    return Response.json(
      { success: true, message: "Hourly production record deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/hourly-productions/[id] error:", error);
    return Response.json(
      { success: false, message: "Failed to delete hourly production record" },
      { status: 500 }
    );
  }
}
