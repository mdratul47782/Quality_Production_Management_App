import mongoose, { Schema } from "mongoose";

// Define the schema for defect items
const DefectItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

// Define the schema for hourly inspections
const HourlyInspectionSchema = new Schema(
  {
    user: {
      id: { type: Schema.Types.ObjectId, ref: "User", required: true },
      user_name: { type: String, required: true, trim: true },
    },

    // Factory (multi-factory support)
    factory: { type: String, required: true, trim: true },

    // Building inside factory
    building: { type: String, required: true, trim: true },

    reportDate: {
      type: Date,
      required: true,
      default: () => new Date(new Date().toDateString()),
    },
    hourLabel: { type: String, required: true, trim: true },
    hourIndex: { type: Number, required: true, min: 1, max: 24 },

    inspectedQty: { type: Number, required: true, min: 0, default: 0 },
    passedQty: { type: Number, required: true, min: 0, default: 0 },
    defectivePcs: { type: Number, required: true, min: 0, default: 0 },
    afterRepair: { type: Number, required: true, min: 0, default: 0 },

    totalDefects: { type: Number, required: true, min: 0, default: 0 },
    selectedDefects: { type: [DefectItemSchema], default: [] },

    line: { type: String, required: true },
  },
  { timestamps: true, collection: "endline_hour_entries" }
);

// ❗ Unique entry per user + factory + date + hour + building
HourlyInspectionSchema.index(
  { "user.id": 1, factory: 1, reportDate: 1, hourIndex: 1, building: 1 },
  { unique: true }
);

// Pre-save hook to calculate total defects (for save(), not insertMany)
HourlyInspectionSchema.pre("save", function (next) {
  if (Array.isArray(this.selectedDefects)) {
    this.totalDefects = this.selectedDefects.reduce(
      (acc, d) => acc + (Number(d.quantity) || 0),
      0
    );
  } else {
    this.selectedDefects = [];
    this.totalDefects = 0;
  }

  if (!this.hourIndex && this.hourLabel) {
    const m = this.hourLabel.match(/^(\d+)/);
    if (m) this.hourIndex = parseInt(m[1], 10);
  }

  if (typeof next === "function") {
    next();
  }
});

// Export the model
export const HourlyInspectionModel =
  mongoose.models.HourlyInspection ||
  mongoose.model("HourlyInspection", HourlyInspectionSchema);
