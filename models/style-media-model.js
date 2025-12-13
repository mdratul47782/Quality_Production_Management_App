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

    // timeline
    effectiveFrom: { type: String, required: true, trim: true }, // YYYY-MM-DD
    effectiveTo: { type: String, default: "", trim: true }, // "" = active

    user: {
      id: { type: Schema.Types.ObjectId, ref: "User" },
      user_name: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

/**
 * ✅ RULES (no duplicates)
 * 1) Same key + same effectiveFrom => only ONE doc (history day-wise no duplicate)
 * 2) Same key => only ONE ACTIVE doc (effectiveTo="") at a time
 */

// 1) prevent duplicates per day/version
StyleMediaSchema.index(
  {
    factory: 1,
    assigned_building: 1,
    buyer: 1,
    style: 1,
    color_model: 1,
    effectiveFrom: 1,
  },
  { unique: true }
);

// 2) prevent duplicates for ACTIVE record only
StyleMediaSchema.index(
  { factory: 1, assigned_building: 1, buyer: 1, style: 1, color_model: 1 },
  {
    unique: true,
    partialFilterExpression: { effectiveTo: "" }, // ✅ only active docs
  }
);

export const StyleMediaModel =
  mongoose.models.StyleMedia || mongoose.model("StyleMedia", StyleMediaSchema);
