// models/TargetSetterHeader.js
import mongoose from "mongoose";

const targetSetterHeaderSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // "YYYY-MM-DD"

    factory: { type: String, required: true, trim: true },

    assigned_building: { type: String, required: true },
    line: { type: String, required: true },

    buyer: { type: String, required: true },
    style: { type: String, required: true },

    // ✅ NEW (auto-uppercase)
    Item: { type: String, trim: true, uppercase: true },

    run_day: { type: Number, required: true },
    color_model: { type: String, required: true },

    total_manpower: { type: Number, required: true },
    manpower_present: { type: Number, required: true },
    manpower_absent: { type: Number, required: true },

    working_hour: { type: Number, required: true },
    plan_quantity: { type: Number, required: true },
    plan_efficiency_percent: { type: Number, required: true },

    smv: { type: Number, required: true },
    target_full_day: { type: Number, required: true },
    capacity: { type: Number, required: true },

    user: {
      id: { type: String },
      user_name: { type: String },
      role: { type: String },
    },
  },
  { timestamps: true }
);

const TargetSetterHeader =
  mongoose.models.TargetSetterHeader ||
  mongoose.model("TargetSetterHeader", targetSetterHeaderSchema);

export default TargetSetterHeader;
