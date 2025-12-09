// app/SideNavBarComponent/SideNavbar.jsx
"use client";

import Link from "next/link";
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
  MonitorCloud
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
    { href: "/QualitySummaryTable", icon: BarChart2 },
    { href: "/line-info-register", icon: FileText },
  ];

  return (
    <aside
      className="
        fixed inset-y-0 left-0 z-40
        h-full w-14
        bg-slate-950
        border-r border-slate-800
        flex flex-col justify-between
        py-4
      "
    >
      {/* MIDDLE: main page icons */}
      <div className="flex flex-col items-center gap-3">
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

      {/* BOTTOM: auth icon */}
      <div className="flex flex-col items-center gap-2">
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
    </aside>
  );
}
