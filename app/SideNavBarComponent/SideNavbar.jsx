// app/SideNavBarComponent/SideNavbar.jsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/hooks/useAuth";
import {
  ClipboardList,
  Activity,
  LogOut,
  LogIn,
  ChartNoAxesCombined,
  MonitorCloud,
  User,
  Table2,
  GitCompare,
  FileText,
} from "lucide-react";

export default function SideNavbar() {
  const { auth, setAuth } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    setAuth(null);
    router.push("/login");
  };

  // ✅ Safely read user info from auth (support both shapes)
  const user = auth?.user || auth || {};
  const userName = user?.user_name || "";
  const userRole = user?.role || "";
  const trackerType = user?.tracker_type || ""; // ✅ NEW
  const userFactory = user?.factory || "";
  const userBuilding = user?.assigned_building || user?.building || "";

  // base nav
  const navItems = [
    { href: "/floor-dashboard", icon: MonitorCloud },
    { href: "/floor-summary", icon: ChartNoAxesCombined },
    { href: "/floor-compare", icon: GitCompare },

    // production
    { href: "/ProductionInput", icon: Activity },

    // quality
    { href: "/QualityInput", icon: ClipboardList },
    { href: "/QualitySummaryTable", icon: Table2 },

    { href: "/style-media-register", icon: FileText },
  ];

  // ✅ NEW: hide buttons based on tracker type
  const filteredNavItems = navItems.filter((it) => {
    if (userRole !== "Data tracker") return true;

    if (trackerType === "Quality") {
      // quality tracker -> no production button
      if (it.href === "/ProductionInput") return false;
      return true;
    }

    if (trackerType === "Production") {
      // production tracker -> no quality buttons
      if (it.href === "/QualityInput") return false;
      if (it.href === "/QualitySummaryTable") return false;
      return true;
    }

    // if tracker type missing, still show minimum pages only
    if (it.href === "/ProductionInput") return false;
    if (it.href === "/QualityInput") return false;
    if (it.href === "/QualitySummaryTable") return false;
    return true;
  });

  const roleLabel =
    userRole === "Data tracker" && trackerType
      ? `Data tracker (${trackerType})`
      : userRole || "Role";

  return (
    <aside
      className="
        fixed inset-y-0 left-0 z-40
        h-full w-14
        bg-slate-950
        border-r border-slate-800
        flex flex-col
        py-3
      "
    >
      <div className="flex-1 flex flex-col items-center justify-between gap-4">
        {/* TOP: Logo + Nav icons */}
        <div className="flex flex-col items-center gap-4">
          <Link href="/">
            <div className="flex items-center justify-center">
              <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center overflow-hidden shadow-[0_0_16px_rgba(15,23,42,0.8)]">
                <Image
                  src="/HKD_LOGO.png"
                  alt="HKD Outdoor Innovations Ltd."
                  width={30}
                  height={30}
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </Link>

          {/* NAV ICONS */}
          <div className="flex flex-col items-center gap-3 mt-1">
            {filteredNavItems.map(({ href, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`
                    flex items-center justify-center
                    h-9 w-9 rounded-2xl border
                    transition-all
                    ${
                      active
                        ? "bg-emerald-500 border-emerald-400 text-slate-950 shadow-[0_0_14px_rgba(16,185,129,0.7)]"
                        : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-500 hover:text-slate-50"
                    }
                  `}
                >
                  <Icon size={18} />
                </Link>
              );
            })}
          </div>
        </div>

        {/* BOTTOM: User info + auth icon */}
        <div className="flex flex-col items-center gap-2 pb-1">
          {auth && (
            <div className="relative group">
              <div className="h-8 w-8 rounded-full bg-slate-900 border border-slate-600 flex items-center justify-center text-slate-100">
                <User size={16} />
              </div>

              <div
                className="
                  pointer-events-none
                  absolute bottom-0 left-12
                  w-56
                  -translate-y-2 opacity-0 scale-95
                  group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0
                  transition-all duration-150
                "
              >
                <div className="rounded-2xl border border-white/10 bg-slate-950/95 shadow-[0_12px_40px_rgba(0,0,0,0.55)] overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/10 bg-white/5">
                    <div className="text-[11px] font-extrabold text-white truncate">
                      {userName || "User"}
                    </div>
                    <div className="text-[10px] text-slate-300/70 truncate">
                      {roleLabel}
                    </div>
                  </div>

                  <div className="px-3 py-2 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="text-slate-300/70">Factory</span>
                      <span className="text-slate-100 font-semibold truncate">
                        {userFactory || "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="text-slate-300/70">Building</span>
                      <span className="text-slate-100 font-semibold truncate">
                        {userBuilding || "-"}
                      </span>
                    </div>
                    {userRole === "Data tracker" ? (
                      <div className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="text-slate-300/70">Tracker</span>
                        <span className="text-slate-100 font-semibold truncate">
                          {trackerType || "-"}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="absolute left-[-6px] top-4 h-3 w-3 rotate-45 border-l border-b border-white/10 bg-slate-950/95" />
              </div>

              <div className="mt-1 text-[9px] text-center leading-tight text-slate-100 max-w-[52px]">
                <div className="font-semibold truncate">{userName || "User"}</div>
                <div className="text-[8px] text-slate-400 truncate">{roleLabel}</div>
              </div>
            </div>
          )}

          {auth ? (
            <button
              onClick={handleLogout}
              className="
                h-9 w-9 rounded-2xl border border-rose-500
                bg-rose-500/20 text-rose-100
                flex items-center justify-center
                hover:bg-rose-500 hover:text-white hover:border-rose-400
                transition-all
              "
            >
              <LogOut size={18} />
            </button>
          ) : (
            <Link
              href="/login"
              className="
                h-9 w-9 rounded-2xl border border-sky-500
                bg-sky-500/20 text-sky-100
                flex items-center justify-center
                hover:bg-sky-500 hover:text-white hover:border-sky-400
                transition-all
              "
            >
              <LogIn size={18} />
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
