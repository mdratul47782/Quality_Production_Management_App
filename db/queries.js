// db/queries.js
import { dbConnect } from "@/services/mongo";
import { userModel } from "@/models/user-model";
import { replaceMongoIdInObject } from "@/utils/data-util";

function parseMongoDuplicate(err) {
  const kp = err?.keyPattern || {};

  if (kp.user_name) {
    return {
      message: "এই User Name আগে থেকেই আছে. অন্য User Name দিন।",
      fieldErrors: { user_name: "Already exists" },
    };
  }

  // ✅ NEW: one tracker per type per factory+building
  if (kp.factory && kp.assigned_building && kp.tracker_type) {
    return {
      message:
        "এই Factory + Building এ এই Data Tracker টাইপ আগে থেকেই আছে। (Quality/Production একবারই হবে)",
      fieldErrors: {
        factory: "Duplicate tracker slot",
        assigned_building: "Duplicate tracker slot",
        tracker_type: "Duplicate tracker slot",
      },
    };
  }

  return { message: "Duplicate data found.", fieldErrors: {} };
}

async function createUser(user) {
  try {
    await dbConnect();

    // ✅ normalize: if not Data tracker, force tracker_type empty
    const payload = {
      ...user,
      tracker_type: user?.role === "Data tracker" ? user?.tracker_type || "" : "",
    };

    const created = await userModel.create(payload);
    return { success: true, data: replaceMongoIdInObject(created.toObject()) };
  } catch (err) {
    if (err?.code === 11000) {
      const dup = parseMongoDuplicate(err);
      return { success: false, message: dup.message, fieldErrors: dup.fieldErrors };
    }
    return {
      success: false,
      message: err?.message || "Failed to create user",
      fieldErrors: {},
    };
  }
}

async function findUserByCredentials(credentials) {
  await dbConnect();
  const user = await userModel.findOne(credentials).lean();
  if (user) return replaceMongoIdInObject(user);
  return null;
}

export { createUser, findUserByCredentials };
