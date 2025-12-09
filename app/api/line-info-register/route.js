import { dbConnect } from "@/services/mongo";
import { LineInfoRegisterModel } from "@/models/line-info-register-model";
import { v2 as cloudinary } from "cloudinary";

// Make sure this route runs on Node.js runtime
export const runtime = "nodejs";

// Cloudinary config (env vars must be set)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadToCloudinary(file, folder) {
  if (!file) return "";

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder, resource_type: "auto" },
        (error, result) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        }
      )
      .end(buffer);
  });
}

// 🔹 Parse request body: supports JSON and multipart/form-data
async function parseRequestBody(request) {
  const contentType = request.headers.get("content-type") || "";

  // multipart/form-data from FormData (with files)
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();

    const imageFile = formData.get("imageFile");
    const videoFile = formData.get("videoFile");

    const body = {
      id: formData.get("id") || null,
      factory: formData.get("factory") || "",
      buyer: formData.get("buyer") || "",
      assigned_building: formData.get("assigned_building") || "",
      line: formData.get("line") || "",
      style: formData.get("style") || "",
      item: formData.get("item") || "",
      color: formData.get("color") || "",
      smv: formData.get("smv") || "",
      runDay: formData.get("runDay") || "",
      date: formData.get("date") || "",
      imageSrc: (formData.get("imageSrc") || "").toString(),
      videoSrc: (formData.get("videoSrc") || "").toString(),
      user: {
        id: formData.get("userId") || "",
        user_name: formData.get("userName") || "",
      },
    };

    return {
      body,
      imageFile:
        imageFile &&
        typeof imageFile === "object" &&
        "arrayBuffer" in imageFile
          ? imageFile
          : null,
      videoFile:
        videoFile &&
        typeof videoFile === "object" &&
        "arrayBuffer" in videoFile
          ? videoFile
          : null,
    };
  }

  // JSON: fallback (no file upload, but still works)
  const body = await request.json();
  return { body, imageFile: null, videoFile: null };
}

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

    const { body, imageFile, videoFile } = await parseRequestBody(request);

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

    let imageSrc = body.imageSrc || "";
    let videoSrc = body.videoSrc || "";

    // If files are present, upload to Cloudinary and override URLs
    if (imageFile) {
      imageSrc = await uploadToCloudinary(
        imageFile,
        "line-info-register/images"
      );
    }
    if (videoFile) {
      videoSrc = await uploadToCloudinary(
        videoFile,
        "line-info-register/videos"
      );
    }

    const doc = await LineInfoRegisterModel.create({
      ...body,
      imageSrc,
      videoSrc,
    });

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

    const { body, imageFile, videoFile } = await parseRequestBody(request);
    const { id, ...rest } = body;

    if (!id) {
      return Response.json(
        { success: false, message: "id is required" },
        { status: 400 }
      );
    }

    let imageSrc = rest.imageSrc || "";
    let videoSrc = rest.videoSrc || "";

    if (imageFile) {
      imageSrc = await uploadToCloudinary(
        imageFile,
        "line-info-register/images"
      );
    }
    if (videoFile) {
      videoSrc = await uploadToCloudinary(
        videoFile,
        "line-info-register/videos"
      );
    }

    const updated = await LineInfoRegisterModel.findByIdAndUpdate(
      id,
      {
        ...rest,
        imageSrc,
        videoSrc,
      },
      { new: true }
    );

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
