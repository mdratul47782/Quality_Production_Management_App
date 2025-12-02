// app/api/style-capacities/[id]/route.js
import { dbConnect } from "@/services/mongo";
import { StyleCapacityModel } from "@/models/StyleCapacity-model";

function toNumberOrUndefined(value) {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// GET /api/style-capacities/:id
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

    const doc = await StyleCapacityModel.findById(id).lean();
    if (!doc) {
      return Response.json(
        { success: false, message: "Style capacity not found" },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data: doc }, { status: 200 });
  } catch (error) {
    console.error("GET /api/style-capacities/[id] error:", error);
    return Response.json(
      { success: false, message: "Failed to fetch style capacity" },
      { status: 500 }
    );
  }
}

// PATCH /api/style-capacities/:id
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

    if ("capacity" in body) {
      const c = toNumberOrUndefined(body.capacity);
      if (c === undefined || c < 0) {
        errors.push("capacity must be a non-negative number");
      } else {
        update.capacity = c;
      }
    }

    if ("date" in body) {
      update.date = body.date;
    }

    if (body.user) {
      update.user = {
        id: body.user.id,
        user_name: body.user.user_name,
        role: body.user.role,
      };
    }

    if (errors.length > 0) {
      return Response.json({ success: false, errors }, { status: 400 });
    }

    const doc = await StyleCapacityModel.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).lean();

    if (!doc) {
      return Response.json(
        { success: false, message: "Style capacity not found" },
        { status: 404 }
      );
    }

    return Response.json(
      {
        success: true,
        data: doc,
        message: "Style capacity updated successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("PATCH /api/style-capacities/[id] error:", error);
    return Response.json(
      { success: false, message: "Failed to update style capacity" },
      { status: 500 }
    );
  }
}

// DELETE /api/style-capacities/:id
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

    const deleted = await StyleCapacityModel.findByIdAndDelete(id);
    if (!deleted) {
      return Response.json(
        { success: false, message: "Style capacity not found" },
        { status: 404 }
      );
    }

    return Response.json(
      {
        success: true,
        message: "Style capacity deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/style-capacities/[id] error:", error);
    return Response.json(
      { success: false, message: "Failed to delete style capacity" },
      { status: 500 }
    );
  }
}
