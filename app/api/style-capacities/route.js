// app/api/style-capacities/route.js
import { dbConnect } from "@/services/mongo";
import { StyleCapacityModel } from "@/models/StyleCapacity-model";

function toNumberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// 🔹 GET -> capacity list (filter with building+line+buyer+style, optional userId)
export async function GET(request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);

    const assigned_building = searchParams.get("assigned_building");
    const line = searchParams.get("line");
    const buyer = searchParams.get("buyer");
    const style = searchParams.get("style");
    const userId = searchParams.get("userId"); // optional

    const query = {};

    if (assigned_building) query.assigned_building = assigned_building;
    if (line) query.line = line;
    if (buyer) query.buyer = buyer;
    if (style) query.style = style;
    if (userId) query["user.id"] = userId; // ✅ schema-তে আছে user.id

    const docs = await StyleCapacityModel.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return Response.json({ success: true, data: docs }, { status: 200 });
  } catch (error) {
    console.error("GET /api/style-capacities error:", error);
    return Response.json(
      { success: false, message: "Failed to fetch style capacities" },
      { status: 500 }
    );
  }
}

// 🔹 POST -> UPSERT (create or update) capacity
export async function POST(request) {
  try {
    await dbConnect();

    const body = await request.json();
    const errors = [];

    const assigned_building = body.assigned_building;
    const line = body.line;
    const buyer = body.buyer;
    const style = body.style;
    const date = body.date; // latest effective date (optional but nice)
    const capacity = toNumberOrZero(body.capacity);
    const user = body.user; // { id, user_name, role }

    if (!assigned_building) errors.push("assigned_building is required");
    if (!line) errors.push("line is required");
    if (!buyer) errors.push("buyer is required");
    if (!style) errors.push("style is required");
    if (!user || !user.id) errors.push("user.id is required");
    if (!Number.isFinite(capacity) || capacity < 0)
      errors.push("capacity must be a non-negative number");

    if (errors.length > 0) {
      return Response.json({ success: false, errors }, { status: 400 });
    }

    // 🔑 unique key -> schema index অনুযায়ী
    const key = {
      assigned_building,
      line,
      buyer,
      style,
    };

    const docToSet = {
      ...key,
      // সর্বশেষ effective date (optional)
      ...(date ? { date } : {}),
      capacity,
      user: {
        id: user.id,
        user_name: user.user_name,
        role: user.role,
      },
    };

    // 🔥 upsert: আছে হলে update, না থাকলে create
    const saved = await StyleCapacityModel.findOneAndUpdate(
      key,
      { $set: docToSet },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    return Response.json(
      {
        success: true,
        data: saved,
        message: "Capacity saved/updated successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("POST /api/style-capacities error:", error);
    return Response.json(
      {
        success: false,
        message:
          error.message || "Failed to save/update style capacity.",
      },
      { status: 500 }
    );
  }
}
