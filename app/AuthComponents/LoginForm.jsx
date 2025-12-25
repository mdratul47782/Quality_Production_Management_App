"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PerformLogin } from "@/app/actions";
import { useAuth } from "@/app/hooks/useAuth";

export default function LoginForm() {
  const { setAuth } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");

  const userRef = useRef(null);
  const passRef = useRef(null);

  // ✅ TV browser এ প্রথমেই focus দিলে অনেক সময় keyboard/typing issue কমে
  useEffect(() => {
    // requestAnimationFrame দিয়ে নিশ্চিত করি DOM ready হওয়ার পরে focus হচ্ছে
    requestAnimationFrame(() => userRef.current?.focus());
  }, []);

  const forceFocus = (ref) => () => {
    // Android TV remote click অনেক সময় focus set করে না, তাই জোর করে focus
    requestAnimationFrame(() => ref.current?.focus());
  };

  async function onSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      const formData = new FormData(event.currentTarget);
      const found = await PerformLogin(formData);

      if (found) {
        setAuth(found);
        router.push("/");
      } else {
        setError("Please provide valid login credentials");
      }
    } catch (err) {
      setError(err?.message || "Login failed");
    }
  }

  return (
    <>
      {error && (
        <div className="my-2 text-sm text-red-600 text-center font-medium">
          {error}
        </div>
      )}

      {/* ✅ pointer-events নিশ্চিতভাবে auto */}
      <form onSubmit={onSubmit} className="space-y-5 pointer-events-auto">
        {/* Username Field */}
        <div>
          <label
            htmlFor="user_name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            User Name
          </label>

          <input
            ref={userRef}
            type="text"
            id="user_name"
            name="user_name"
            inputMode="text"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            enterKeyHint="next"
            className="w-full border text-black border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none rounded-lg px-3 py-2"
            placeholder="Enter your username"
            required
            // ✅ TV remote / mouse / touch সব কেসে focus force
            onPointerDown={forceFocus(userRef)}
            onMouseDown={forceFocus(userRef)}
            onTouchStart={forceFocus(userRef)}
            // ✅ Enter দিলে password এ যাবে
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                passRef.current?.focus();
              }
            }}
          />
        </div>

        {/* Password Field */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Password
          </label>

          <input
            ref={passRef}
            type="password"
            id="password"
            name="password"
            inputMode="text"
            autoComplete="current-password"
            enterKeyHint="done"
            className="w-full border border-gray-300 focus:ring-2 focus:ring-indigo-500 text-black focus:outline-none rounded-lg px-3 py-2"
            placeholder="••••••••"
            required
            onPointerDown={forceFocus(passRef)}
            onMouseDown={forceFocus(passRef)}
            onTouchStart={forceFocus(passRef)}
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg py-2 transition-all duration-200"
        >
          Login
        </button>
      </form>
    </>
  );
}
