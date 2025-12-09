// models/line-info-register-model.js
import mongoose from "mongoose";

const lineInfoRegisterSchema = new mongoose.Schema(
  {
    factory: {
      type: String,
      required: true,
      trim: true,
    },

    buyer: { type: String, required: true },

    assigned_building: { type: String, required: true },

    line: { type: String, required: true },
    style: { type: String, required: true },
    item: { type: String, required: true },
    color: { type: String, required: true },
    smv: { type: String, required: true },
    runDay: { type: String, required: true },

    date: { type: String, required: true }, // "YYYY-MM-DD"

    // 🔹 NEW: Cloudinary URLs per line
    imageSrc: { type: String, default: "" },
    videoSrc: { type: String, default: "" },

    user: {
      id: { type: String, required: true },
      user_name: { type: String, required: true },
    },
  },
  { timestamps: true }
);

export const LineInfoRegisterModel =
  mongoose.models.LineInfoRegister ||
  mongoose.model("LineInfoRegister", lineInfoRegisterSchema);
