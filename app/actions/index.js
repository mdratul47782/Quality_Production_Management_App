"use server";
import { createUser, findUserByCredentials } from "@/db/queries";
import { redirect } from "next/navigation";
async function registerUser(formData) {
  const user = Object.fromEntries(formData);
  await createUser(user);
  redirect("/login");
}

async function PerformLogin(formData) {
  try {
    const credential = {};
    credential.user_name = formData.get("user_name");
    credential.password = formData.get("password");
    const found = await findUserByCredentials(credential);
    return found;
  } catch (error) {
    throw error;
  }
}

export {
  registerUser,
  PerformLogin,
  
};
