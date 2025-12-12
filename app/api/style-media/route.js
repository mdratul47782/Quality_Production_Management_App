// app/api/style-media/route.js
import { dbConnect } from "@/services/mongo";
import { StyleMediaModel } from "@/models/style-media-model";
import { v2 as cloudinary } from "cloudinary";

export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function dayBefore(isoDate) {
  try {
    const d = new Date(`${isoDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

async function uploadToCloudinary(file, folder) {
  if (!file) return "";
  const buffer = Buffer.from(await file.arrayBuffer());

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, resource_type: "auto" }, (err, result) => {
        if (err) return reject(err);
        resolve(result.secure_url);
      })
      .end(buffer);
  });
}

async function parseRequestBody(request) {
  const ct = request.headers.get("content-type") || "";

  if (ct.includes("multipart/form-data")) {
    const fd = await request.formData();
    const imageFile = fd.get("imageFile");
    const videoFile = fd.get("videoFile");

    const body = {
      id: (fd.get("id") || "").toString(),
      factory: (fd.get("factory") || "").toString(),
      assigned_building: (fd.get("assigned_building") || "").toString(),
      buyer: (fd.get("buyer") || "").toString(),
      style: (fd.get("style") || "").toString(),
      color_model: (fd.get("color_model") || "").toString(),
      effectiveFrom: (fd.get("effectiveFrom") || "").toString(),
      imageSrc: (fd.get("imageSrc") || "").toString(),
      videoSrc: (fd.get("videoSrc") || "").toString(),
      user: {
        id: (fd.get("userId") || "").toString(),
        user_name: (fd.get("userName") || "").toString(),
      },
    };

    const isFile = (f) => f && typeof f === "object" && "arrayBuffer" in f;

    return {
      body,
      imageFile: isFile(imageFile) ? imageFile : null,
      videoFile: isFile(videoFile) ? videoFile : null,
    };
  }

  const body = await request.json();
  return { body, imageFile: null, videoFile: null };
}

// GET /api/style-media?factory=K-2&assigned_building=A-2&date=2025-12-12
// optional filters: buyer, style, color_model
export async function GET(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const factory = searchParams.get("factory") || "";
    const assigned_building = searchParams.get("assigned_building") || "";
    const date = searchParams.get("date") || ""; // ✅ for dashboard date wise
    const buyer = searchParams.get("buyer") || "";
    const style = searchParams.get("style") || "";
    const color_model = searchParams.get("color_model") || "";

    const filter = {};
    if (factory) filter.factory = factory;
    if (assigned_building) filter.assigned_building = assigned_building;
    if (buyer) filter.buyer = buyer;
    if (style) filter.style = style;
    if (color_model) filter.color_model = color_model;

    // ✅ pick records active for this date
    if (date) {
      filter.$and = [
        { effectiveFrom: { $lte: date } },
        { $or: [{ effectiveTo: "" }, { effectiveTo: { $gte: date } }] },
      ];
    }

    const data = await StyleMediaModel.find(filter)
      .sort({ effectiveFrom: -1, updatedAt: -1 })
      .lean();

    return Response.json({ success: true, data }, { status: 200 });
  } catch (err) {
    console.error("GET /api/style-media error:", err);
    return Response.json(
      { success: false, message: "Failed to fetch style media" },
      { status: 500 }
    );
  }
}

// POST = create/update style media for a start date (effectiveFrom) and close previous active record
export async function POST(request) {
  try {
    await dbConnect();

    const { body, imageFile, videoFile } = await parseRequestBody(request);

    const required = ["factory", "assigned_building", "buyer", "style", "color_model"];
    for (const k of required) {
      if (!body?.[k]) {
        return Response.json({ success: false, message: `${k} is required` }, { status: 400 });
      }
    }

    const effectiveFrom = body.effectiveFrom || todayIso();
    const key = {
      factory: body.factory,
      assigned_building: body.assigned_building,
      buyer: body.buyer,
      style: body.style,
      color_model: body.color_model,
    };

    let imageSrc = body.imageSrc || "";
    let videoSrc = body.videoSrc || "";

    if (imageFile) imageSrc = await uploadToCloudinary(imageFile, "style-media/images");
    if (videoFile) videoSrc = await uploadToCloudinary(videoFile, "style-media/videos");

    // ✅ close previous ACTIVE record (effectiveTo="") for this key
    // so old one remains visible on old dates
    const prevEnd = dayBefore(effectiveFrom);

    await StyleMediaModel.updateMany(
      { ...key, effectiveTo: "" },
      { $set: { effectiveTo: prevEnd || effectiveFrom } }
    );

    // ✅ upsert record for this effectiveFrom (if same day re-save, it updates)
    const doc = await StyleMediaModel.findOneAndUpdate(
      { ...key, effectiveFrom },
      {
        ...key,
        effectiveFrom,
        effectiveTo: "",
        imageSrc,
        videoSrc,
        user: body.user,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return Response.json(
      { success: true, data: doc, message: "Style media saved successfully" },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/style-media error:", err);
    return Response.json(
      { success: false, message: err.message || "Failed to save style media" },
      { status: 500 }
    );
  }
}

// PUT = update by id (manual edit)
export async function PUT(request) {
  try {
    await dbConnect();

    const { body, imageFile, videoFile } = await parseRequestBody(request);
    const id = body.id;

    if (!id) {
      return Response.json({ success: false, message: "id is required" }, { status: 400 });
    }

    let imageSrc = body.imageSrc || "";
    let videoSrc = body.videoSrc || "";
    if (imageFile) imageSrc = await uploadToCloudinary(imageFile, "style-media/images");
    if (videoFile) videoSrc = await uploadToCloudinary(videoFile, "style-media/videos");

    const updated = await StyleMediaModel.findByIdAndUpdate(
      id,
      { ...body, imageSrc, videoSrc },
      { new: true }
    );

    if (!updated) {
      return Response.json({ success: false, message: "Not found" }, { status: 404 });
    }

    return Response.json(
      { success: true, data: updated, message: "Style media updated successfully" },
      { status: 200 }
    );
  } catch (err) {
    console.error("PUT /api/style-media error:", err);
    return Response.json(
      { success: false, message: err.message || "Failed to update style media" },
      { status: 500 }
    );
  }
}

// DELETE /api/style-media?id=...
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

    const deleted = await StyleMediaModel.findByIdAndDelete(id);
    if (!deleted) {
      return Response.json({ success: false, message: "Not found" }, { status: 404 });
    }

    return Response.json({ success: true, message: "Deleted successfully" }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/style-media error:", err);
    return Response.json(
      { success: false, message: "Failed to delete style media" },
      { status: 500 }
    );
  }
}
