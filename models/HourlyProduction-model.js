// models/HourlyProduction-model.js
import mongoose from "mongoose";

const hourlyProductionSchema = new mongoose.Schema(
  {
    headerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TargetSetterHeader",
      required: true,
    },
    productionDate: { type: String, required: true }, // "YYYY-MM-DD"
    hour: { type: Number, required: true, min: 1 },
    achievedQty: { type: Number, required: true, min: 0 },

    baseTargetPerHour: { type: Number, required: true },
    dynamicTarget: { type: Number, required: true },
    varianceQty: { type: Number, required: true },
    cumulativeVariance: { type: Number, required: true },

    hourlyEfficiency: { type: Number, required: true },
    achieveEfficiency: { type: Number, required: true },
    totalEfficiency: { type: Number, required: true },

    productionUser: {
      id: { type: String, required: true },
      Production_user_name: { type: String, required: true },
      phone: { type: String },
      bio: { type: String },
    },
  },
  { timestamps: true }
);

// এক লাইন, এক header, এক user, এক ঘন্টায় একটাই রেকর্ড
hourlyProductionSchema.index(
  { headerId: 1, "productionUser.id": 1, hour: 1 },
  { unique: true }
);

export const HourlyProductionModel =
  mongoose.models.HourlyProduction ||
  mongoose.model("HourlyProduction", hourlyProductionSchema);
