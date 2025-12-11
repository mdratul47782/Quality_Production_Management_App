// app/api/seed-demo/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/services/mongo";

// adjust path if you put it somewhere else
import { generateAllDummyData } from "@/lib/generateDummyData";

// ✅ use exactly how your models are exported
import { userModel } from "@/models/user-model";
import { LineInfoRegisterModel } from "@/models/line-info-register-model";
import { StyleCapacityModel } from "@/models/StyleCapacity-model";
import TargetSetterHeader from "@/models/TargetSetterHeader";
import { HourlyProductionModel } from "@/models/HourlyProduction-model";
import { HourlyInspectionModel } from "@/models/hourly-inspections";

export async function GET() {
  try {
    await dbConnect();

  const {
  users,
  lineInfos,
  targetHeaders,
  styleCapacities,
  hourlyProductions,
  hourlyInspections,
} = generateAllDummyData({
  days: 30,
  hoursPerDay: 12,
});

    // ⚠️ পুরোনো data মুছে ফেলে নতুন demo data ঢোকাচ্ছে
    await Promise.all([
      userModel.deleteMany({}),
      LineInfoRegisterModel.deleteMany({}),
      StyleCapacityModel.deleteMany({}),
      TargetSetterHeader.deleteMany({}),
      HourlyProductionModel.deleteMany({}),
      HourlyInspectionModel.deleteMany({}),
    ]);

    await userModel.insertMany(users);
    await LineInfoRegisterModel.insertMany(lineInfos);
    await StyleCapacityModel.insertMany(styleCapacities);
    await TargetSetterHeader.insertMany(targetHeaders);
    await HourlyProductionModel.insertMany(hourlyProductions);
    await HourlyInspectionModel.insertMany(hourlyInspections);

    return NextResponse.json({
      success: true,
      message: "Demo data seeded successfully.",
      counts: {
        users: users.length,
        lineInfos: lineInfos.length,
        targetHeaders: targetHeaders.length,
        styleCapacities: styleCapacities.length,
        hourlyProductions: hourlyProductions.length,
        hourlyInspections: hourlyInspections.length,
      },
    });
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Seed failed" },
      { status: 500 }
    );
  }
}
