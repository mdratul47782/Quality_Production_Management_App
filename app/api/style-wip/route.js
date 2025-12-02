// app/api/style-wip/route.js
import { dbConnect } from "@/services/mongo";
import TargetSetterHeader from "@/models/TargetSetterHeader";
import { HourlyProductionModel } from "@/models/HourlyProduction-model";
import { StyleCapacityModel } from "@/models/StyleCapacity-model";

function toNumberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const assigned_building = searchParams.get("assigned_building");
    const line = searchParams.get("line");
    const buyer = searchParams.get("buyer");
    const style = searchParams.get("style");
    const date = searchParams.get("date"); // "YYYY-MM-DD"

    if (!assigned_building || !line || !buyer || !style || !date) {
      return Response.json(
        {
          success: false,
          message:
            "assigned_building, line, buyer, style, date সবগুলোই required",
        },
        { status: 400 }
      );
    }

    // 1) Capacity doc বের করি এই style এর জন্য
    const capacityDoc = await StyleCapacityModel.findOne({
      assigned_building,
      line,
      buyer,
      style,
    }).lean();

    const capacity = capacityDoc ? toNumberOrZero(capacityDoc.capacity) : 0;

    // 2) এই building+line+buyer+style এর সব header যেগুলোর date <= current date
    const headers = await TargetSetterHeader.find({
      assigned_building,
      line,
      buyer,
      style,
      date: { $lte: date }, // header.date "YYYY-MM-DD" ধরে নিচ্ছি
    })
      .select("_id")
      .lean();

    let totalAchieved = 0;

    if (headers.length > 0) {
      const headerIds = headers.map((h) => h._id);

      // সব hourly records থেকে মোট achievedQty sum
      const agg = await HourlyProductionModel.aggregate([
        {
          $match: {
            headerId: { $in: headerIds },
            productionDate: { $lte: date }, // "YYYY-MM-DD"
          },
        },
        {
          $group: {
            _id: null,
            totalAchieved: { $sum: "$achievedQty" },
          },
        },
      ]);

      if (agg.length > 0) {
        totalAchieved = toNumberOrZero(agg[0].totalAchieved);
      }
    }

    const rawWip = capacity - totalAchieved;
    const wip = Math.max(rawWip, 0); // চাইলে negative allow করতে পারো

    return Response.json(
      {
        success: true,
        data: {
          capacity,
          totalAchieved,
          wip,
          rawWip,
          capacityId: capacityDoc?._id || null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/style-wip error:", error);
    return Response.json(
      { success: false, message: "Failed to calculate style WIP" },
      { status: 500 }
    );
  }
}
