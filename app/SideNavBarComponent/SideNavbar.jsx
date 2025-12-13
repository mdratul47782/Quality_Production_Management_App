// app/SideNavBarComponent/SideNavbar.jsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/hooks/useAuth";
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  Activity,
  BarChart2,
  LogOut,
  LogIn,
  ChartNoAxesCombined,
  MonitorCloud,
  User,
  Table2
} from "lucide-react";

export default function SideNavbar() {
  const { auth, setAuth } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    setAuth(null);
    router.push("/login");
  };

  const navItems = [
    { href: "/floor-dashboard", icon: MonitorCloud },
    { href: "/floor-summary", icon: ChartNoAxesCombined },
    { href: "/ProductionInput", icon: Activity },
    { href: "/QualityInput", icon: ClipboardList },
    { href: "/QualitySummaryTable", icon: Table2 },
    // { href: "/line-info-register", icon: FileText },
    { href: "/style-media-register", icon: FileText },
  ];

  // Safely read user name and role from auth
  const userName =
    auth?.user?.user_name || auth?.user_name || "";
  const userRole =
    auth?.user?.role || auth?.role || "";

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
          {/* HKD Logo */}
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
            {navItems.map(({ href, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`
                    flex items-center justify-center
                    h-9 w-9 rounded-2xl border
                    transition-all
                    ${active
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
          {/* User head + name + role (only if logged in) */}
          {auth && (
            <div className="flex flex-col items-center gap-1 max-w-[52px]">
              <div className="h-8 w-8 rounded-full bg-slate-900 border border-slate-600 flex items-center justify-center text-slate-100">
                <User size={16} />
              </div>
              <div className="text-[9px] text-center leading-tight text-slate-100">
                <div className="font-semibold truncate">
                  {userName || "User"}
                </div>
                {userRole && (
                  <div className="text-[8px] text-slate-400 truncate">
                    {userRole}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Auth icon (login/logout) */}
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
