// app/registration/page.jsx (or wherever this form lives)
"use client";

import Image from "next/image";
import { registerUser } from "@/app/actions";
import Link from "next/link";

export default function RegistrationForm() {
  return (
    <section className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-indigo-100 px-4">
      {/* Outer container */}
      <div className="bg-white shadow-2xl rounded-2xl w-full max-w-4xl border border-gray-100 flex flex-col md:flex-row overflow-hidden">
        {/* LEFT: Illustration */}
        <div className="hidden md:flex w-1/2 items-center justify-center bg-indigo-50 p-8">
          <Image
            src="/Sign up-rafiki.svg"
            alt="Sign up illustration"
            width={420}
            height={420}
            className="w-full h-auto max-w-sm"
            priority
          />
        </div>

        {/* RIGHT: Form */}
        <div className="w-full md:w-1/2 p-8 flex flex-col justify-center">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-gray-800">
              Create Your Account
            </h1>
            <p className="text-sm text-gray-500 mt-2">
              Join HKD Outdoor Innovations Ltd.
            </p>
          </div>

          {/* Registration Form */}
          <form action={registerUser} className="space-y-5">
            {/* User Name */}
            <div>
              <label
                htmlFor="user_name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                User Name
              </label>
              <input
                type="text"
                id="user_name"
                name="user_name"
                className="w-full border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 focus:outline-none rounded-lg px-3 py-2 transition-all"
                placeholder="Enter your name"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                className="w-full border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 focus:outline-none rounded-lg px-3 py-2 transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {/* Role */}
            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Role
              </label>
              <input
                type="text"
                id="role"
                name="role"
                className="w-full border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 focus:outline-none rounded-lg px-3 py-2 transition-all"
                placeholder="Enter your role"
                required
              />
            </div>

            {/* Assigned Building */}
            <div>
              <label
                htmlFor="assigned_building"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Assigned Building
              </label>
              <select
                id="assigned_building"
                name="assigned_building"
                className="w-full border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 focus:outline-none rounded-lg px-3 py-2 transition-all"
                required
              >
                <option value="">Select a building</option>
                <option value="A-2">A-2</option>
                <option value="B-2">B-2</option>
                <option value="A-3">A-3</option>
                <option value="B-3">B-3</option>
                <option value="A-4">A-4</option>
                <option value="B-4">B-4</option>
                <option value="A-5">A-5</option>
                <option value="B-5">B-5</option>
              </select>
            </div>

            {/* 🔹 NEW: Factory */}
            <div>
              <label
                htmlFor="factory"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Factory
              </label>
              <select
                id="factory"
                name="factory"
                className="w-full border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 focus:outline-none rounded-lg px-3 py-2 transition-all"
                required
              >
                <option value="">Select a factory</option>
                <option value="K-1">K-1</option>
                <option value="K-2">K-2</option>
                <option value="K-3">K-3</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-lg py-2 transition-all duration-300 shadow-md hover:shadow-lg"
            >
              Create Account
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-indigo-600 font-medium hover:underline"
            >
              Login here
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
