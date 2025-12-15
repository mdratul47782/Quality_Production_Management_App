// app/page.js
"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "@/app/hooks/useAuth";
import SignInOut from "../AuthComponents/SignInOut";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  ImageIcon,
  Activity,
  BarChart2,
  Table2,
  MonitorCloud,
  HelpCircle,
  GitCompare,
} from "lucide-react";

function InfoPill({ label, value }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur">
      <span className="text-white/55">{label}:</span>
      <span className="text-white">{value || "-"}</span>
    </span>
  );
}

function Tile({ href, icon: Icon, title, desc, tone = "sky" }) {
  const toneMap = {
    sky: "from-sky-500/14 to-sky-500/5 border-sky-400/25 hover:border-sky-300/50",
    emerald:
      "from-emerald-500/14 to-emerald-500/5 border-emerald-400/25 hover:border-emerald-300/50",
    amber:
      "from-amber-500/14 to-amber-500/5 border-amber-400/25 hover:border-amber-300/50",
    violet:
      "from-violet-500/14 to-violet-500/5 border-violet-400/25 hover:border-violet-300/50",
    rose: "from-rose-500/14 to-rose-500/5 border-rose-400/25 hover:border-rose-300/50",
    slate:
      "from-slate-400/14 to-slate-400/5 border-slate-300/20 hover:border-slate-200/40",
  };

  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${toneMap[tone]} p-4 shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5`}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/12 bg-white/10 text-white shadow-sm">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-white">
              {title}
            </h3>
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-white/70 opacity-0 transition group-hover:opacity-100">
              Open <ArrowRight size={14} />
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-white/70">
            {desc}
          </p>
        </div>
      </div>
    </Link>
  );
}

function SvgCard({ src, title }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-white/20 bg-white/5">
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/5 blur-2xl" />
      <div className="relative aspect-[4/3] w-full">
        <Image src={src} alt="Images" fill className="object-contain p-4" />
      </div>
      <div className="px-3 pb-2">
        <p className="text-[11px] font-semibold text-white/80">{title}</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { auth } = useAuth();

  const userName = useMemo(
    () => auth?.user?.user_name || auth?.user_name || "User",
    [auth]
  );
  const factory = useMemo(
    () => auth?.factory || auth?.user?.factory || auth?.assigned_factory || "",
    [auth]
  );
  const building = useMemo(
    () =>
      auth?.assigned_building ||
      auth?.user?.assigned_building ||
      auth?.building ||
      "",
    [auth]
  );

  const heroSvgs = [
    { src: "/undraw_presentation_4ik4.svg" },
    { src: "/undraw_factory_4d61.svg" },
    { src: "/undraw_business-plan_wv9q.svg" },
  ];

  return (
    <main className="min-h-screen bg-[#070A12] text-white pl-14">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 left-[-10%] h-[520px] w-[520px] rounded-full bg-emerald-500/15 blur-[90px]" />
        <div className="absolute -top-28 right-[-12%] h-[560px] w-[560px] rounded-full bg-sky-500/15 blur-[90px]" />
        <div className="absolute bottom-[-22%] left-[20%] h-[520px] w-[520px] rounded-full bg-violet-500/12 blur-[90px]" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(255,255,255,0.08),transparent)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070A12]/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {/* HKD Logo */}
            <div className="h-10 w-10 rounded-xl bg-white border border-white/15 flex items-center justify-center overflow-hidden shadow-sm">
              <Image
                src="/HKD_LOGO.png"
                alt="HKD Outdoor Innovations Ltd."
                width={34}
                height={34}
                className="object-contain"
                priority
              />
            </div>

            <div className="leading-tight">
              <p className="text-[12px] font-semibold text-white/95">
                HKD Outdoor Innovations Ltd.
              </p>
              <p className="text-[11px] text-white/55">
                Production & Quality Management System
              </p>
            </div>
          </div>

          {/* SignInOut + pills */}
          <div className="hidden items-center gap-2 md:flex">
            <div className="-mt-3 origin-right scale-[0.78]">
              <SignInOut />
            </div>

            <InfoPill label="Factory" value={factory} />
            <InfoPill label="Floor" value={building} />
            {/* <InfoPill label="User" value={userName} /> */}
          </div>

          <div className="md:hidden flex items-center gap-2">
            <Link
              href="/user-manual"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[12px] font-semibold text-white/90"
            >
              <BookOpen size={16} />
              Manual
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <section className="mx-auto max-w-6xl px-4 py-7 md:py-10">
        {/* Hero */}
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live dashboards • Fast entry • Clean tracking
            </div>

            <h1 className="text-2xl font-semibold leading-tight md:text-4xl">
              Your daily{" "}
              <span className="bg-gradient-to-r from-emerald-300 to-sky-300 bg-clip-text text-transparent">
                PRODUCTION & QUALITY
              </span>{" "}
              control center.
            </h1>

            <p className="max-w-xl text-[13px] leading-relaxed text-white/70 md:text-[14px]">
              Open modules quickly from the tiles. Keep Buyer/Style/Color
              consistent, track hourly inspections, and manage media for each
              style.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href="/floor-dashboard"
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-[12px] font-semibold text-emerald-950 shadow-[0_14px_40px_rgba(16,185,129,0.25)] hover:bg-emerald-400"
              >
                <MonitorCloud size={16} />
                Open Floor Dashboard
              </Link>

              <Link
                href="/ProductionInput"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-[12px] font-semibold text-white/90 hover:bg-white/15"
              >
                <ClipboardList size={16} />
                Production Input Page
              </Link>

              <Link
                href="/user-manual"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-[12px] font-semibold text-white/90 hover:bg-white/15"
              >
                <BookOpen size={16} />
                User Manual
              </Link>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 md:hidden">
              <InfoPill label="User" value={userName} />
              <InfoPill label="Factory" value={factory} />
              <InfoPill label="Floor" value={building} />
            </div>
          </div>

          {/* 3 SVGs */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-white/5 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
              <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
              <div className="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {heroSvgs.map((s) => (
                  <SvgCard key={s.src} src={s.src} title={s.title} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tiles */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Tile
            href="/floor-dashboard"
            icon={MonitorCloud}
            title="Floor Dashboard"
            desc="Line-wise view of performance, quality & production."
            tone="sky"
          />
          <Tile
            href="/floor-summary"
            icon={BarChart2}
            title="Floor Summary"
            desc="Day summary charts & comparisons (building/line)."
            tone="violet"
          />

          {/* ✅ NEW: floor-compare */}
          <Tile
            href="/floor-compare"
            icon={GitCompare}
            title="Floor Compare"
            desc="Compare floors/lines side-by-side for quick decisions."
            tone="slate"
          />

          <Tile
            href="/ProductionInput"
            icon={Activity}
            title="Production Input"
            desc="Hourly production entry & target tracking."
            tone="emerald"
          />
          <Tile
            href="/QualityInput"
            icon={ClipboardList}
            title="Quality Input"
            desc="Hourly inspection entry with defects."
            tone="amber"
          />
          <Tile
            href="/QualitySummaryTable"
            icon={Table2}
            title="Quality Summary Table"
            desc="Table view of hourly quality, totals, and defects."
            tone="slate"
          />
          <Tile
            href="/style-media-register"
            icon={ImageIcon}
            title="Style Media Register"
            desc="Buyer/Style/Color media reference (image/video)."
            tone="rose"
          />
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#070A12]/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 md:flex-row md:items-center md:justify-between">
          <p className="text-[11px] text-white/55">
            © {new Date().getFullYear()} HKD Outdoor Innovations Ltd.
          </p>
          <p className="text-[11px] text-white/55">
            Built for factory floor visibility • Quality • Production
          </p>
        </div>
      </footer>
    </main>
  );
}
