import { NextResponse } from "next/server";
import { dbConnect } from "@/services/mongo";
import MediaLink from "@/models/MediaLink";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary using env vars
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

async function parseBody(req) {
  const contentType = req.headers.get("content-type") || "";

  // JSON (old behavior)
  if (contentType.includes("application/json")) {
    const body = await req.json();
    return {
      userId: body.userId,
      userName: body.userName,
      imageSrc: body.imageSrc || "",
      videoSrc: body.videoSrc || "",
      imageFile: null,
      videoFile: null,
    };
  }

  // multipart/form-data (file upload from client)
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();

    const imageFile = formData.get("imageFile");
    const videoFile = formData.get("videoFile");

    return {
      userId: formData.get("userId"),
      userName: formData.get("userName"),
      imageSrc: (formData.get("imageSrc") || "").toString(),
      videoSrc: (formData.get("videoSrc") || "").toString(),
      imageFile:
        imageFile && typeof imageFile === "object" && "arrayBuffer" in imageFile
          ? imageFile
          : null,
      videoFile:
        videoFile && typeof videoFile === "object" && "arrayBuffer" in videoFile
          ? videoFile
          : null,
    };
  }

  throw new Error("Unsupported content type");
}

// GET - Fetch user's media links
export async function GET(req) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const mediaLink = await MediaLink.findOne({ "user.id": userId });
    return NextResponse.json({ data: mediaLink || null });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create new media links
export async function POST(req) {
  try {
    await dbConnect();

    const {
      userId,
      userName,
      imageSrc: rawImageSrc,
      videoSrc: rawVideoSrc,
      imageFile,
      videoFile,
    } = await parseBody(req);

    if (!userId || !userName) {
      return NextResponse.json(
        { error: "userId and userName required" },
        { status: 400 }
      );
    }

    // Check if already exists
    const existing = await MediaLink.findOne({ "user.id": userId });
    if (existing) {
      return NextResponse.json(
        { error: "Media links already exist. Use PATCH to update." },
        { status: 409 }
      );
    }

    let imageSrc = rawImageSrc || "";
    let videoSrc = rawVideoSrc || "";

    // If files are present, upload them and override URLs
    if (imageFile) {
      imageSrc = await uploadToCloudinary(imageFile, "media-links/images");
    }
    if (videoFile) {
      videoSrc = await uploadToCloudinary(videoFile, "media-links/videos");
    }

    const newMediaLink = await MediaLink.create({
      user: { id: userId, user_name: userName },
      imageSrc,
      videoSrc,
    });

    return NextResponse.json({ data: newMediaLink }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - Update existing media links
export async function PATCH(req) {
  try {
    await dbConnect();

    const {
      userId,
      imageSrc: rawImageSrc,
      videoSrc: rawVideoSrc,
      imageFile,
      videoFile,
    } = await parseBody(req);

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    let imageSrc = rawImageSrc || "";
    let videoSrc = rawVideoSrc || "";

    if (imageFile) {
      imageSrc = await uploadToCloudinary(imageFile, "media-links/images");
    }
    if (videoFile) {
      videoSrc = await uploadToCloudinary(videoFile, "media-links/videos");
    }

    const updated = await MediaLink.findOneAndUpdate(
      { "user.id": userId },
      {
        $set: {
          imageSrc,
          videoSrc,
        },
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Media links not found. Use POST to create." },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
