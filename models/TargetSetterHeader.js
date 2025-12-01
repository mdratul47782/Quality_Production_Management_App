// models/TargetSetterHeader.js
import mongoose from "mongoose";

const TargetSetterHeaderSchema = new mongoose.Schema(
  {
    // YYYY-MM-DD string (easier for filtering by day)
    date: {
      type: String,
      required: true,
      trim: true,
    },

    // From auth.assigned_building (e.g. "B-4")
    assigned_building: {
      type: String,
      required: true,
      trim: true,
    },

    // Line selection
    line: {
      type: String,
      required: true,
      enum: ["Line-1", "Line-2", "Line-3"],
    },

    // Buyer selection
    buyer: {
      type: String,
      required: true,
      trim: true,
    },

    // Style input
    style: {
      type: String,
      required: true,
      trim: true,
    },

    // Manpower
    total_manpower: {
      type: Number,
      required: true,
    },
    manpower_present: {
      type: Number,
      required: true,
    },
    manpower_absent: {
      type: Number,
      required: true,
    },

    // Working hour for this style on this line (can be 2.5, 3.75 etc)
    working_hour: {
      type: Number,
      required: true,
    },

    // Planning info
    plan_quantity: {
      type: Number,
      required: true,
    },
    plan_efficiency_percent: {
      type: Number,
      required: true,
    },
    smv: {
      type: Number,
      required: true,
    },

    // Auto-calculated on backend
    target_full_day: {
      type: Number,
      required: true,
    },

    // Manual input
    capacity: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const TargetSetterHeader =
  mongoose.models.TargetSetterHeader ||
  mongoose.model("TargetSetterHeader", TargetSetterHeaderSchema);

export default TargetSetterHeader;
