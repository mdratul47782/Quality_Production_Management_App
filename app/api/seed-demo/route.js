// app/api/seed-demo/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/services/mongo";
import { generateAllDummyData } from "@/lib/generateDummyData";

import { userModel } from "@/models/user-model";
import { LineInfoRegisterModel } from "@/models/line-info-register-model";
import { StyleCapacityModel } from "@/models/StyleCapacity-model";
import TargetSetterHeader from "@/models/TargetSetterHeader";
import { HourlyProductionModel } from "@/models/HourlyProduction-model";
import { HourlyInspectionModel } from "@/models/hourly-inspections";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function insertInChunks(Model, docs, chunkSize = 300) {
  if (!Array.isArray(docs) || docs.length === 0) return 0;

  let inserted = 0;
  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize);
    try {
      await Model.insertMany(chunk, { ordered: false });
      inserted += chunk.length;
    } catch (err) {
      if (err?.writeErrors?.length) {
        inserted += chunk.length - err.writeErrors.length;
        continue;
      }
      if (err?.code === 11000) continue;
      throw err;
    }
  }
  return inserted;
}

function contextsForDemo() {
  // ✅ you can add more later, keep small now
  return [
    { factory: "K-2", building: "A-2" },
    { factory: "K-2", building: "B-2" },
  ];
}

export async function GET() {
  try {
    await dbConnect();

    // ✅ keep it small so dev server won’t crash
    const days = 5;
    const hoursPerDay = 8;
    const chunkSize = 250;
    const contexts = contextsForDemo();

    const data = generateAllDummyData({ days, hoursPerDay, contexts });

    const factories = contexts.map((c) => c.factory);
    const buildings = contexts.map((c) => c.building);

    // ✅ delete only those contexts
    await Promise.all([
      userModel.deleteMany({
        factory: { $in: factories },
        assigned_building: { $in: buildings },
      }),
      LineInfoRegisterModel.deleteMany({
        factory: { $in: factories },
        assigned_building: { $in: buildings },
      }),
      StyleCapacityModel.deleteMany({
        factory: { $in: factories },
        assigned_building: { $in: buildings },
      }),
      TargetSetterHeader.deleteMany({
        factory: { $in: factories },
        assigned_building: { $in: buildings },
      }),
      HourlyProductionModel.deleteMany({
        factory: { $in: factories },
        assigned_building: { $in: buildings },
      }),
      HourlyInspectionModel.deleteMany({
        factory: { $in: factories },
        $or: [
          { building: { $in: buildings } },
          { assigned_building: { $in: buildings } },
        ],
      }),
    ]);

    const inserted = {
      users: await insertInChunks(userModel, data.users, chunkSize),
      lineInfos: await insertInChunks(LineInfoRegisterModel, data.lineInfos, chunkSize),
      styleCapacities: await insertInChunks(StyleCapacityModel, data.styleCapacities, chunkSize),
      targetHeaders: await insertInChunks(TargetSetterHeader, data.targetHeaders, chunkSize),
      hourlyProductions: await insertInChunks(HourlyProductionModel, data.hourlyProductions, chunkSize),
      hourlyInspections: await insertInChunks(HourlyInspectionModel, data.hourlyInspections, chunkSize),
    };

    return NextResponse.json(
      {
        success: true,
        message: "Demo data seeded (5 days).",
        options: { days, hoursPerDay, chunkSize, contexts },
        totals: {
          users: data.users.length,
          lineInfos: data.lineInfos.length,
          targetHeaders: data.targetHeaders.length,
          styleCapacities: data.styleCapacities.length,
          hourlyProductions: data.hourlyProductions.length,
          hourlyInspections: data.hourlyInspections.length,
        },
        inserted,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Seed failed", error: String(err) },
      { status: 500 }
    );
  }
}
