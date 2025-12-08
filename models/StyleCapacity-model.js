// models/StyleCapacity-model.js
import mongoose, { Schema } from "mongoose";

const StyleCapacitySchema = new Schema(
  {
    // 🔹 NEW: factory scope
    factory: {
      type: String,
      required: true,
      trim: true,
    },

    assigned_building: {
      type: String,
      required: true,
      trim: true,
    },
    line: {
      type: String,
      required: true,
      trim: true,
    },
    buyer: {
      type: String,
      required: true,
      trim: true,
    },
    style: {
      type: String,
      required: true,
      trim: true,
    },
    // capacity effective date (latest update date হিসেবে রাখছি)
    date: {
      type: String, // "YYYY-MM-DD"
      trim: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 0,
    },
    user: {
      id: { type: String, required: true },
      user_name: { type: String },
      role: { type: String },
    },
  },
  { timestamps: true }
);

// প্রতি factory+building+line+buyer+style এর জন্য একটাই capacity ডকুমেন্ট
StyleCapacitySchema.index(
  { factory: 1, assigned_building: 1, line: 1, buyer: 1, style: 1 },
  { unique: true }
);

export const StyleCapacityModel =
  mongoose.models.StyleCapacity ||
  mongoose.model("StyleCapacity", StyleCapacitySchema);
