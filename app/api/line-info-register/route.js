// app/api/line-info-register/route.js
import { dbConnect } from "@/services/mongo";
import { LineInfoRegisterModel } from "@/models/line-info-register-model";

// GET /api/line-info-register?factory=K-2&assigned_building=A-2&userId=...
export async function GET(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const factory = searchParams.get("factory");
    const assignedBuilding = searchParams.get("assigned_building");
    const userId = searchParams.get("userId");

    const filter = {};
    if (factory) filter.factory = factory;
    if (assignedBuilding) filter.assigned_building = assignedBuilding;
    if (userId) filter["user.id"] = userId;

    const data = await LineInfoRegisterModel.find(filter).sort({
      factory: 1,
      line: 1,
      createdAt: -1,
    });

    return Response.json({ success: true, data }, { status: 200 });
  } catch (err) {
    console.error("GET /api/line-info-register error:", err);
    return Response.json(
      { success: false, message: "Failed to fetch line info" },
      { status: 500 }
    );
  }
}

// POST /api/line-info-register
export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();

    if (!body.user || !body.user.id || !body.user.user_name) {
      return Response.json(
        { success: false, message: "user.id and user.user_name are required" },
        { status: 400 }
      );
    }
    if (!body.factory) {
      return Response.json(
        { success: false, message: "factory is required" },
        { status: 400 }
      );
    }
    if (!body.assigned_building) {
      return Response.json(
        { success: false, message: "assigned_building is required" },
        { status: 400 }
      );
    }
    if (!body.date) {
      return Response.json(
        { success: false, message: "date is required" },
        { status: 400 }
      );
    }

    const doc = await LineInfoRegisterModel.create(body);

    return Response.json(
      {
        success: true,
        data: doc,
        message: "Line info created successfully",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/line-info-register error:", err);
    return Response.json(
      {
        success: false,
        message: err.message || "Failed to create line info",
      },
      { status: 500 }
    );
  }
}

// PUT /api/line-info-register
export async function PUT(request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { id, ...rest } = body;

    if (!id) {
      return Response.json(
        { success: false, message: "id is required" },
        { status: 400 }
      );
    }

    const updated = await LineInfoRegisterModel.findByIdAndUpdate(id, rest, {
      new: true,
    });

    if (!updated) {
      return Response.json(
        { success: false, message: "Line not found" },
        { status: 404 }
      );
    }

    return Response.json(
      {
        success: true,
        data: updated,
        message: "Line info updated successfully",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("PUT /api/line-info-register error:", err);
    return Response.json(
      {
        success: false,
        message: err.message || "Failed to update line info",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/line-info-register?id=...
export async function DELETE(request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json(
        { success: false, message: "id query param is required" },
        { status: 400 }
      );
    }

    const deleted = await LineInfoRegisterModel.findByIdAndDelete(id);

    if (!deleted) {
      return Response.json(
        { success: false, message: "Line not found" },
        { status: 404 }
      );
    }

    return Response.json(
      { success: true, message: "Line info deleted successfully" },
      { status: 200 }
    );
  } catch (err) {
    console.error("DELETE /api/line-info-register error:", err);
    return Response.json(
      { success: false, message: "Failed to delete line info" },
      { status: 500 }
    );
  }
}
