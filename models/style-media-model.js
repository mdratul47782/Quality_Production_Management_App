// models/style-media-model.js
import mongoose, { Schema } from "mongoose";

const StyleMediaSchema = new Schema(
  {
    factory: { type: String, required: true, trim: true },
    assigned_building: { type: String, required: true, trim: true },

    buyer: { type: String, required: true, trim: true },
    style: { type: String, required: true, trim: true },
    color_model: { type: String, required: true, trim: true },

    imageSrc: { type: String, default: "" },
    videoSrc: { type: String, default: "" },

    // ✅ date-wise history (string "YYYY-MM-DD" so compare works)
    effectiveFrom: { type: String, required: true, trim: true }, // start date
    effectiveTo: { type: String, default: "", trim: true }, // "" = active

    user: {
      id: { type: Schema.Types.ObjectId, ref: "User" },
      user_name: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

StyleMediaSchema.index({
  factory: 1,
  assigned_building: 1,
  buyer: 1,
  style: 1,
  color_model: 1,
  effectiveFrom: -1,
  effectiveTo: 1,
});

export const StyleMediaModel =
  mongoose.models.StyleMedia || mongoose.model("StyleMedia", StyleMediaSchema);
