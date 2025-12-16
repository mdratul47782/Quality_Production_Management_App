// models/HourlyProduction-model.js
import mongoose, { Schema } from "mongoose";

const HourlyProductionSchema = new Schema(
  {
    headerId: {
      type: Schema.Types.ObjectId,
      ref: "TargetSetterHeader",
      required: true,
    },
    productionDate: {
      type: String, // "YYYY-MM-DD"
      required: true,
      trim: true,
    },
    hour: { type: Number, required: true },
    achievedQty: { type: Number, required: true, min: 0 },

    baseTargetPerHour: { type: Number, required: true },
    dynamicTarget: { type: Number, required: true },
    varianceQty: { type: Number, required: true },
    cumulativeVariance: { type: Number, required: true },

    hourlyEfficiency: { type: Number, required: true },
    achieveEfficiency: { type: Number, required: true },
    totalEfficiency: { type: Number, required: true },

    // 🔹 NEW: upper case field name "Item"
    Item: {
      type: String,
      trim: true,
      set: (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
    },

    // 🔹 multi-factory context
    factory: { type: String, trim: true },
    assigned_building: { type: String, trim: true },
    line: { type: String, trim: true },
    buyer: { type: String, trim: true },
    style: { type: String, trim: true },

    productionUser: {
      id: { type: String, required: true },
      Production_user_name: { type: String },
      phone: { type: String },
      bio: { type: String },
    },
  },
  { timestamps: true }
);

// avoid duplicate per (headerId + user + hour)
HourlyProductionSchema.index(
  { headerId: 1, "productionUser.id": 1, hour: 1 },
  { unique: true }
);

export const HourlyProductionModel =
  mongoose.models.HourlyProduction ||
  mongoose.model("HourlyProduction", HourlyProductionSchema);
