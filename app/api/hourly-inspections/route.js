import { HourlyInspectionModel } from "@/models/hourly-inspections";
import { dbConnect } from "@/services/mongo";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

function startOfDay(dateLike) {
  const d = dateLike ? new Date(dateLike) : new Date();
  return new Date(d.toDateString());
}

function toNumber(n, def = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

function normalizeEntry(raw) {
  const hourLabel = raw.hour || raw.hourLabel || "";
  const selectedDefects = Array.isArray(raw.selectedDefects)
    ? raw.selectedDefects.map((d) => ({
        name: String(d.name || "").trim(),
        quantity: toNumber(d.quantity, 0),
      }))
    : [];

  // Extract hourIndex from hourLabel (e.g., "1st Hour" -> 1)
  let hourIndex = raw.hourIndex;
  if (!hourIndex && hourLabel) {
    const match = hourLabel.match(/^(\d+)/);
    if (match) {
      hourIndex = parseInt(match[1], 10);
    }
  }
  if (!hourIndex) hourIndex = 0;

  // Calculate totalDefects from selectedDefects
  const totalDefects = selectedDefects.reduce(
    (sum, d) => sum + (Number(d.quantity) || 0),
    0
  );

  const building = (raw.building || "").trim();
  const factory = (raw.factory || "").trim();

  const doc = {
    hourLabel,
    hourIndex,
    inspectedQty: toNumber(raw.inspectedQty, 0),
    passedQty: toNumber(raw.passedQty, 0),
    defectivePcs: toNumber(raw.defectivePcs, 0),
    afterRepair: toNumber(raw.afterRepair, 0),
    totalDefects,
    selectedDefects,
    line: raw.line || "",
    building,
    factory,
  };

  console.log("normalizeEntry input:", raw);
  console.log("normalizeEntry output:", doc);

  return doc;
}

// ---------- POST ----------

export async function POST(req) {
  try {
    await dbConnect();

    const body = await req.json();
    const userId = body.userId || body.user_id || body.created_by?.id;
    const user_name =
      body.userName || body.user_name || body.created_by?.user_name;

    const building = body.building || body.assigned_building || "";
    const factory =
      body.factory || body.assigned_factory || body.factoryCode || "";

    if (!userId || !user_name) {
      return NextResponse.json(
        { success: false, message: "userId এবং userName দুটোই প্রয়োজন।" },
        { status: 400 }
      );
    }
    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json(
        { success: false, message: "Invalid userId (not ObjectId)." },
        { status: 400 }
      );
    }
    if (!factory) {
      return NextResponse.json(
        { success: false, message: "Factory information is required." },
        { status: 400 }
      );
    }
    if (!building) {
      return NextResponse.json(
        { success: false, message: "Building information is required." },
        { status: 400 }
      );
    }

    const reportDate = startOfDay(body.reportDate);

    let rawEntries = [];
    if (Array.isArray(body.entries)) rawEntries = body.entries;
    else if (Array.isArray(body.hours)) rawEntries = body.hours;
    else if (body.entry) rawEntries = [body.entry];
    else rawEntries = [body];

    console.log("Raw entries received:", JSON.stringify(rawEntries, null, 2));
    console.log("Building from body:", building);
    console.log("Factory from body:", factory);

    if (!rawEntries || rawEntries.length === 0) {
      return NextResponse.json(
        { success: false, message: "No entries provided to save." },
        { status: 400 }
      );
    }

    const docs = rawEntries.map((e) => ({
      ...normalizeEntry({
        ...e,
        building: e.building || building,
        factory: e.factory || factory,
      }),
      user: { id: new mongoose.Types.ObjectId(userId), user_name },
      reportDate,
    }));

    console.log(
      "Normalized docs before validation:",
      JSON.stringify(docs, null, 2)
    );

    for (const d of docs) {
      if (!d.hourLabel || !d.hourIndex || d.hourIndex < 1 || d.hourIndex > 24) {
        console.error(
          "Validation failed: Missing or invalid hourLabel/hourIndex",
          d
        );
        return NextResponse.json(
          {
            success: false,
            message: `hourLabel/hourIndex is required and must be between 1-24. hourLabel: "${d.hourLabel}", hourIndex: ${d.hourIndex}`,
          },
          { status: 400 }
        );
      }
      if (!d.factory) {
        console.error("Validation failed: Missing factory", d);
        return NextResponse.json(
          { success: false, message: "Factory is required for each entry." },
          { status: 400 }
        );
      }
      if (!d.building) {
        console.error("Validation failed: Missing building", d);
        return NextResponse.json(
          { success: false, message: "Building is required for each entry." },
          { status: 400 }
        );
      }
      if (!d.line) {
        console.error("Validation failed: Missing line", d);
        return NextResponse.json(
          { success: false, message: "Line is required for each entry." },
          { status: 400 }
        );
      }
    }

    console.log("Attempting to insert docs:", JSON.stringify(docs, null, 2));
    console.log("Number of docs to insert:", docs.length);

    if (docs.length === 0) {
      return NextResponse.json(
        { success: false, message: "No valid documents to insert." },
        { status: 400 }
      );
    }

    // Final simple required field check
    for (const doc of docs) {
      if (!doc.hourLabel || !doc.line || !doc.building || !doc.factory) {
        console.error("Missing required fields in doc:", doc);
        return NextResponse.json(
          {
            success: false,
            message: `Missing required fields: hourLabel, line, building, or factory`,
          },
          { status: 400 }
        );
      }
    }

    let inserted;
    try {
      inserted = await HourlyInspectionModel.insertMany(docs, {
        ordered: true,
      });
      console.log("Successfully inserted:", inserted.length, "entries");
      if (inserted.length > 0) {
        console.log(
          "Inserted data sample:",
          JSON.stringify(inserted[0], null, 2)
        );
      }
    } catch (insertError) {
      console.error("insertMany error:", insertError);

      if (insertError.name === "ValidationError") {
        const validationErrors = Object.values(insertError.errors || {})
          .map((e) => `${e.path}: ${e.message}`)
          .join(", ");
        return NextResponse.json(
          {
            success: false,
            message: `Validation failed: ${validationErrors}`,
          },
          { status: 400 }
        );
      }

      if (insertError.code === 11000) {
        const duplicateField = insertError.keyPattern
          ? Object.keys(insertError.keyPattern).join(", ")
          : "unknown field";
        return NextResponse.json(
          {
            success: false,
            message: `An entry already exists for this combination (${duplicateField}). Please edit the existing entry instead.`,
          },
          { status: 409 }
        );
      }

      if (insertError.writeErrors && Array.isArray(insertError.writeErrors)) {
        const errorMessages = insertError.writeErrors
          .map((e) => e.errmsg || e.err?.message || JSON.stringify(e.err))
          .join("; ");

        if (insertError.insertedDocs && insertError.insertedDocs.length > 0) {
          return NextResponse.json(
            {
              success: true,
              count: insertError.insertedDocs.length,
              data: insertError.insertedDocs,
              message: `Some entries created, but some failed: ${errorMessages}`,
            },
            { status: 201 }
          );
        }

        return NextResponse.json(
          {
            success: false,
            message: `Failed to insert entries: ${errorMessages}`,
          },
          { status: 400 }
        );
      }

      const errorMessage =
        insertError.message ||
        insertError.errmsg ||
        String(insertError) ||
        "Unknown error occurred";

      return NextResponse.json(
        {
          success: false,
          message: `Failed to insert: ${errorMessage}`,
        },
        { status: 500 }
      );
    }

    if (!inserted || inserted.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No entries were inserted. Please check server logs for details.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        count: inserted.length,
        data: inserted,
        message: "Hourly inspection entries created.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /hourly-inspections outer catch error:", err);

    if (err.code === 11000 || err.name === "MongoServerError") {
      return NextResponse.json(
        {
          success: false,
          message:
            "An entry for this hour and date already exists. Please edit the existing entry instead.",
        },
        { status: 409 }
      );
    }

    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors || {})
        .map((e) => e.message)
        .join(", ");
      return NextResponse.json(
        { success: false, message: `Validation error: ${errors}` },
        { status: 400 }
      );
    }

    const errorMessage =
      err?.message || err?.errmsg || err?.toString() || "Server error occurred";

    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

// ---------- GET ----------
export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const date = searchParams.get("date");
    const building = searchParams.get("building");
    const factory = searchParams.get("factory");
    const limit = Math.min(Number(searchParams.get("limit") || 200), 1000);

    const filter = {};
    if (userId) {
      if (!mongoose.isValidObjectId(userId)) {
        return NextResponse.json(
          { success: false, message: "Invalid userId (not ObjectId)." },
          { status: 400 }
        );
      }
      filter["user.id"] = new mongoose.Types.ObjectId(userId);
    }
    if (date) {
      const dayStart = startOfDay(date);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      filter.reportDate = { $gte: dayStart, $lt: dayEnd };
    }
    if (building) {
      filter.building = building;
    }
    if (factory) {
      filter.factory = factory;
    }

    const rows = await HourlyInspectionModel.find(filter)
      .sort({ reportDate: 1, hourIndex: 1, createdAt: 1 })
      .limit(limit)
      .lean();

    const rowsWithTotalDefects = rows.map((row) => {
      if (row.totalDefects === undefined || row.totalDefects === null) {
        const total = Array.isArray(row.selectedDefects)
          ? row.selectedDefects.reduce(
              (sum, d) => sum + (Number(d.quantity) || 0),
              0
            )
          : 0;
        return { ...row, totalDefects: total };
      }
      return row;
    });

    return NextResponse.json(
      {
        success: true,
        count: rowsWithTotalDefects.length,
        data: rowsWithTotalDefects,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /hourly-inspections error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Server error" },
      { status: 500 }
    );
  }
}

// ---------- PATCH (Update) ----------
export async function PATCH(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const factory = searchParams.get("factory");

    if (!id || !mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Valid ID is required" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const updateData = normalizeEntry(body);

    const totalDefects = updateData.selectedDefects.reduce(
      (sum, d) => sum + d.quantity,
      0
    );

    const filter = { _id: id };
    if (factory) filter.factory = factory;

    const updated = await HourlyInspectionModel.findOneAndUpdate(
      filter,
      {
        ...updateData,
        totalDefects,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, message: "Entry not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: updated,
        message: "Entry updated successfully",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("PATCH /hourly-inspections error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Server error" },
      { status: 500 }
    );
  }
}

// ---------- DELETE ----------
export async function DELETE(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const factory = searchParams.get("factory");

    if (!id || !mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Valid ID is required" },
        { status: 400 }
      );
    }

    const filter = { _id: id };
    if (factory) filter.factory = factory;

    const deleted = await HourlyInspectionModel.findOneAndDelete(filter);

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Entry not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: deleted,
        message: "Entry deleted successfully",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("DELETE /hourly-inspections error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Server error" },
      { status: 500 }
    );
  }
}

