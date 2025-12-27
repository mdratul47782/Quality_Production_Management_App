// models/user-model.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    user_name: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters long"],
      maxlength: [50, "Username cannot exceed 50 characters"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
    },

    role: {
      type: String,
      required: [true, "Role is required"],
      trim: true,
      enum: ["Management", "Data tracker", "Developer", "Others"],
    },

    // ✅ NEW: only for role === "Data tracker"
    tracker_type: {
      type: String,
      trim: true,
      enum: ["", "Quality", "Production"],
      default: "",
      required: function () {
        return this.role === "Data tracker";
      },
    },

    assigned_building: {
      type: String,
      required: [true, "Assigned building is required"],
      enum: ["A-2", "B-2", "A-3", "B-3", "A-4", "B-4", "A-5", "B-5"],
    },
    factory: {
      type: String,
      required: [true, "Factory is required"],
      enum: ["K-1", "K-2", "K-3"],
    },
  },
  { timestamps: true, collection: "users" } // keep collection name same
);

/**
 * ✅ RULE: Same Factory + Building can have:
 * - 1 Quality Data Tracker
 * - 1 Production Data Tracker
 * (user_name must be unique anyway)
 *
 * This unique index applies ONLY to Data tracker role.
 */
userSchema.index(
  { factory: 1, assigned_building: 1, tracker_type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      role: "Data tracker",
      tracker_type: { $in: ["Quality", "Production"] },
    },
  }
);

export const userModel =
  mongoose.models.User || mongoose.model("User", userSchema);
