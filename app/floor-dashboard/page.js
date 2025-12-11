"use client";

import { useState, useEffect ,useMemo} from "react";
import { PieChart } from "react-minimal-pie-chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Gauge, TrendingUp, Activity, AlertTriangle } from "lucide-react";

const factoryOptions = ["K-1", "K-2", "K-3"];

const buildingOptions = [
  "A-2",
  "B-2",
  "A-3",
  "B-3",
  "A-4",
  "B-4",
  "A-5",
  "B-5",
];

const lineOptions = [
  "ALL",
  "Line-1",
  "Line-2",
  "Line-3",
  "Line-4",
  "Line-5",
  "Line-6",
  "Line-7",
  "Line-8",
  "Line-9",
  "Line-10",
  "Line-11",
  "Line-12",
  "Line-13",
  "Line-14",
  "Line-15",
];

// refresh every X ms
const REFRESH_INTERVAL_MS = 10000;

function formatNumber(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toFixed(digits);
}

// clamp percent between 0–100
function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/* ---------- KPI TILE DESIGN (compact, like your example) ---------- */

const KPI_TONE_MAP = {
  emerald: {
    card:
      "from-emerald-500/15 to-emerald-500/5 border-emerald-400/30 ring-emerald-400/40 text-emerald-100",
    badge: "bg-emerald-500/90 text-emerald-950",
  },
  sky: {
    card:
      "from-sky-500/15 to-sky-500/5 border-sky-400/30 ring-sky-400/40 text-sky-100",
    badge: "bg-sky-400/90 text-sky-950",
  },
  red: {
    card:
      "from-red-500/15 to-red-500/5 border-red-400/30 ring-red-400/40 text-red-100",
    badge: "bg-red-500/90 text-red-50",
  },
  amber: {
    card:
      "from-amber-500/15 to-amber-500/5 border-amber-400/30 ring-amber-400/40 text-amber-100",
    badge: "bg-amber-400/90 text-amber-950",
  },
  purple: {
    card:
      "from-purple-500/15 to-purple-500/5 border-purple-400/30 ring-purple-400/40 text-purple-100",
    badge: "bg-purple-400/90 text-purple-950",
  },
};

function KpiTile({ label, value, tone = "emerald", icon: Icon }) {
  const toneMap = KPI_TONE_MAP[tone] || KPI_TONE_MAP.emerald;

  return (
    <div
      className={`
        group relative overflow-hidden rounded-xl border ${toneMap.card}
        bg-gradient-to-br p-2 sm:p-2.5 ring-1
        transition-transform duration-200 hover:translate-y-0.5
        min-h-[40px]
      `}
    >
      {/* subtle corner glow */}
      <div className="pointer-events-none absolute -inset-px rounded-[0.9rem] bg-[radial-gradient(100px_50px_at_0%_0%,rgba(255,255,255,0.12),transparent)]" />

      <div className="relative flex items-center justify-between gap-2">
        {/* Left: label chip */}
        <div
          className={`
            inline-flex items-center gap-1 rounded-md
            px-1.5 py-[2px]
            text-[9px] font-semibold uppercase tracking-wider
            ${toneMap.badge}
          `}
        >
          {Icon ? <Icon className="h-3 w-3" /> : null}
          <span className="leading-none">{label}</span>
        </div>

        {/* Right: value */}
        <div className="text-right text-xl sm:text-2xl font-extrabold tabular-nums tracking-tight text-white leading-none">
          {value}
        </div>
      </div>
    </div>
  );
}

/* -------------------- MAIN PAGE -------------------- */

export default function FloorDashboardPage() {
  const [factory, setFactory] = useState("K-2");
  const [building, setBuilding] = useState("A-2");
  const [date, setDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [line, setLine] = useState("ALL");

 const [rows, setRows] = useState([]);
const [loading, setLoading] = useState(false);
// 🔹 Always show lines serially: Line-1, Line-2, ... Line-15
const sortedRows = useMemo(() => {
  if (!rows || rows.length === 0) return [];

  const getLineNumber = (lineName = "") => {
    const match = lineName.match(/(\d+)/); // pick "1" from "Line-1"
    return match ? parseInt(match[1], 10) : 0;
  };

  return [...rows].sort(
    (a, b) => getLineNumber(a.line) - getLineNumber(b.line)
  );
}, [rows]);

  const [error, setError] = useState("");

  // line-info register data (buyer, style, runDay, smv, etc.)
  const [lineInfoMap, setLineInfoMap] = useState({});
  // WIP data per line
  const [wipMap, setWipMap] = useState({});

  // শুধু এই tick change হলেই সব data re-fetch হবে
  const [refreshTick, setRefreshTick] = useState(0);

  // View mode -> "grid" (full view) | "tv" (single card auto slide)
  const [viewMode, setViewMode] = useState("grid");
  // এখন কোন card দেখাচ্ছে (tv mode)
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  // ================================
  // Global polling timer (10 sec)
  // ================================
  useEffect(() => {
    const id = setInterval(() => {
      setRefreshTick((prev) => prev + 1);
    }, REFRESH_INTERVAL_MS);

    const handleFocus = () => {
      setRefreshTick((prev) => prev + 1);
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(id);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // ============================================================
  // 1) Main dashboard data (production + quality)
  // ============================================================
  useEffect(() => {
    if (!factory || !building || !date) {
      setRows([]);
      return;
    }

    const controller = new AbortController();

    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams({
          factory,
          building,
          date,
        });
        if (line && line !== "ALL") params.append("line", line);

        const res = await fetch(`/api/floor-dashboard?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to load dashboard.");
        }

        setRows(json.lines || []);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error(err);
        setError(err.message || "Failed to load dashboard.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();

    return () => controller.abort();
  }, [factory, building, date, line, refreshTick]);

  // ============================================================
  // 2) Load Line Info (buyer, style, runDay, smv) by factory+building
  // ============================================================
  useEffect(() => {
    if (!factory || !building) {
      setLineInfoMap({});
      return;
    }

    let cancelled = false;

    const fetchLineInfo = async () => {
      try {
        const params = new URLSearchParams({
          factory,
          assigned_building: building,
        });

        const res = await fetch(
          `/api/line-info-register?${params.toString()}`,
          { cache: "no-store" }
        );
        const json = await res.json();

        if (!res.ok || !json.success) {
          console.error(json.message || "Failed to load line info.");
          if (!cancelled) setLineInfoMap({});
          return;
        }

        const list = json.data || [];

        const map = {};
        for (const doc of list) {
          if (!map[doc.line]) {
            map[doc.line] = doc; // first occurrence is latest because of sort
          }
        }

        if (!cancelled) setLineInfoMap(map);
      } catch (err) {
        console.error("Error fetching line info:", err);
        if (!cancelled) setLineInfoMap({});
      }
    };

    fetchLineInfo();

    return () => {
      cancelled = true;
    };
  }, [factory, building]);

  // ============================================================
  // 3) Load WIP per line using /api/style-wip
  // ============================================================
  useEffect(() => {
    if (!factory || !building || !date || rows.length === 0) {
      setWipMap({});
      return;
    }

    if (!lineInfoMap || Object.keys(lineInfoMap).length === 0) {
      setWipMap({});
      return;
    }

    let cancelled = false;

    const fetchWipForAllLines = async () => {
      const newMap = {};

      for (const row of rows) {
        const lineName = row.line;
        const info = lineInfoMap[lineName];

        if (!info || !info.buyer || !info.style) continue;

        const params = new URLSearchParams({
          factory,
          assigned_building: building,
          line: lineName,
          buyer: info.buyer,
          style: info.style,
          date,
        });

        try {
          const res = await fetch(`/api/style-wip?${params.toString()}`, {
            cache: "no-store",
          });
          const json = await res.json();

          if (res.ok && json.success && !cancelled) {
            newMap[lineName] = json.data;
          }
        } catch (err) {
          console.error("Error fetching WIP for", lineName, err);
        }
      }

      if (!cancelled) {
        setWipMap(newMap);
      }
    };

    fetchWipForAllLines();

    return () => {
      cancelled = true;
    };
  }, [factory, building, date, rows, lineInfoMap]);

  // ============================================================
  // 4) TV MODE: auto-slide single card every 10s
  // ============================================================
  useEffect(() => {
    setCurrentCardIndex(0);
  }, [rows.length, viewMode, factory, building, date, line]);

 useEffect(() => {
  if (viewMode !== "tv") return;
  if (sortedRows.length <= 1) return;

  const id = setInterval(() => {
    setCurrentCardIndex((prev) =>
      sortedRows.length === 0 ? 0 : (prev + 1) % sortedRows.length
    );
  }, 10000);

  return () => clearInterval(id);
}, [viewMode, sortedRows.length]);

  // ============================================================
  // RENDER
  // ============================================================
 const hasData = sortedRows.length > 0;
const safeIndex =
  sortedRows.length > 0 ? currentCardIndex % sortedRows.length : 0;
const currentRow = sortedRows[safeIndex];


  const contentWrapperClass = `flex-1 min-h-0 ${viewMode === "grid" ? "overflow-y-auto pr-1" : ""
    }`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-50 py-2 px-2 mb-0">
      {/* whole page constrained to viewport height */}
      <div className="max-w-[1700px] mx-auto flex flex-col gap-3 h-[calc(100vh-16px)]">
        {/* Filter Panel */}
        <div className="card bg-base-300/10 border border-slate-800/80 shadow-[0_10px_35px_rgba(0,0,0,0.9)]">
          <div className="card-body p-2 md:p-3 text-xs space-y-2">
            <div className="flex flex-wrap items-end gap-4">
              {/* Factory */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase text-amber-100">
                  Factory
                </label>
                <select
                  className="select select-xs bg-amber-300/95 select-bordered min-w-[140px] text-slate-900"
                  value={factory}
                  onChange={(e) => setFactory(e.target.value)}
                >
                  <option value="">Select factory</option>
                  {factoryOptions.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* Building */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase text-amber-100">
                  Floor
                  {/* unfortunetly i used in db as Building */}
                </label>
                <select
                  className="select select-xs bg-amber-300/95 select-bordered min-w-[140px] text-slate-900"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                >
                  <option value="">Select building</option>
                  {buildingOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase text-amber-100">
                  Date
                </label>
                <input
                  type="date"
                  className="input input-xs input-bordered bg-amber-300/95 text-slate-900"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              {/* Line */}
              <div className="space-y-1">
                <label className="block text-[12px] font-semibold uppercase text-amber-100 ">
                  Line
                </label>
                <select
                  className="select select-xs bg-amber-300/95 select-bordered min-w-[120px] text-slate-900"
                  value={line}
                  onChange={(e) => setLine(e.target.value)}
                >
                  {lineOptions.map((ln) => (
                    <option key={ln} value={ln}>
                      {ln}
                    </option>
                  ))}
                </select>
              </div>

              {/* View mode */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase text-amber-100">
                  View
                </label>

                <select
                  className="select select-xs bg-amber-300/95 select-bordered min-w-[130px] text-slate-900"
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value)}
                >
                  <option value="grid">Full View (All Line's)</option>
                  <option value="tv">TV Auto Slide (Single Line)</option>
                </select>
              </div>

              {loading && (
                <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-400">
                  <span className="loading loading-spinner loading-xs" />
                  Auto updating...
                </span>
              )}
            </div>

            {error && (
              <div className="alert alert-error py-1 px-2 text-[11px]">
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* CONTENT AREA (grid or TV) */}
        <div className={contentWrapperClass}>
          {/* No data msg */}
          {!hasData && !loading && !error && (
            <p className="text-[11px] text-slate-500">
              No data for this factory/building/date yet.
            </p>
          )}

          {/* FULL VIEW (GRID) */}
         {hasData && viewMode === "grid" && (
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-1">
    {sortedRows.map((row) => (
      <LineCard
        key={row.line}
        lineData={row}
        lineInfo={lineInfoMap[row.line]}
        wipData={wipMap[row.line]}
      />
    ))}
  </div>
)}


          {/* TV VIEW */}
          {hasData && viewMode === "tv" && currentRow && (
            <div className="flex-1 min-h-0 flex flex-col space-y-3">
              <div className="flex-1 min-h-0">
                <TvLineCard
                  lineData={currentRow}
                  lineInfo={lineInfoMap[currentRow.line]}
                  wipData={wipMap[currentRow.line]}
                  factory={factory}
                  building={building}
                  date={date}
                />
              </div>

              {/* Slider dots + info */}
              <div className="flex flex-col items-center gap-1 text-[9px] text-slate-400 pb-1">
                <div className="flex items-center gap-1">
                 {sortedRows.map((row, idx) => (
  <button
    key={row.line + idx}
    type="button"
    onClick={() => setCurrentCardIndex(idx)}
    className={`h-2 rounded-full transition-all duration-300 ${
      idx === safeIndex
        ? "w-5 bg-sky-400"
        : "w-2 bg-slate-600 hover:bg-slate-400"
    }`}
  />
))}

                </div>
                <div>
                  Showing{" "}
                  <span className="mx-1 font-semibold text-sky-300">
                    {safeIndex + 1}
                  </span>
                  of{" "}
                  <span className="mx-1 font-semibold text-slate-200">
  {sortedRows.length}
</span>
                  lines • Auto slide every 10s
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------ NORMAL GRID CARD ------------ */

function LineCard({ lineData, lineInfo, wipData }) {
  const { line, quality, production } = lineData || {};

  const buyer = lineInfo?.buyer || "-";
  const style = lineInfo?.style || "-";
  const runDay = lineInfo?.runDay || "-";
  const smv = lineInfo?.smv || "-";

  const imageSrc = lineInfo?.imageSrc || "";
  const videoSrc = lineInfo?.videoSrc || "";

  const targetQty = production?.targetQty ?? 0;
  const achievedQty = production?.achievedQty ?? 0;
  const rawPlan = targetQty > 0 ? (achievedQty / targetQty) * 100 : 0;
  const planPercent = clampPercent(rawPlan);
  const varianceQty = production?.varianceQty ?? 0;

  const rft = clampPercent(quality?.rftPercent ?? 0);
  const dhu = clampPercent(quality?.dhuPercent ?? 0);
  const defectRate = clampPercent(quality?.defectRatePercent ?? 0);

  const hourlyEff = clampPercent(production?.currentHourEfficiency ?? 0);
  const avgEff = clampPercent(production?.avgEffPercent ?? 0);

  const qualityHourLabel = quality?.currentHour ?? "-";
  const prodHourLabel = production?.currentHour ?? "-";

  const manpowerPresent = production?.manpowerPresent ?? 0;
  const wip = wipData?.wip ?? 0;

  const isBehind = varianceQty < 0;

  return (
    <div
      className={`card h-full rounded-2xl border bg-slate-950/95 shadow-[0_12px_36px_rgba(0,0,0,0.7)] overflow-hidden 
      ${isBehind ? "border-rose-500/40" : "border-emerald-500/35"}`}
    >
      <div className="card-body p-2 space-y-0 text-[11px] text-slate-100 bg-gradient-to-b from-slate-950 via-slate-950/95 to-slate-950">
        {/* TOP: meta + main donut */}
        <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-1">
          {/* left chips */}
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1">
              <span className="badge badge-outline border-slate-600 bg-slate-900 text-[9px]">
                Line&nbsp;
                <span className="font-semibold text-cyan-300">{line}</span>
              </span>
              <span className="badge border-amber-500/60 bg-amber-500/10 text-[9px] text-amber-100">
                Buyer: <span className="font-semibold">{buyer}</span>
              </span>
            </div>

            <div className="flex flex-wrap gap-1 ">
              <span className="badge border-fuchsia-500/60 bg-fuchsia-500/10 text-fuchsia-100 text-[9px]">
                Style: <span className="font-semibold">{style}</span>
              </span>
              <span className="badge border-emerald-500/60 bg-emerald-500/10 text-emerald-100 text-[9px]">
                SMV: <span className="font-semibold">{smv}</span>
              </span>
              <span className="badge border-sky-500/60 bg-sky-500/10 text-sky-100 text-[9px]">
                Run Day: <span className="font-semibold">{runDay}</span>
              </span>
            </div>
          </div>

          {/* right: main pie + compact plan summary */}
          <div className="flex items-center gap-2">
            <KpiPie value={planPercent} label="PLAN" color="#22d3ee" size={46} />

            <div className="text-[9px] leading-tight text-right rounded-lg border border-sky-500/60 bg-slate-950/85 px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-wide text-slate-400 mb-0.5">
                Plan Summary
              </div>

              <div className="text-slate-200 font-semibold">
                Target:{" "}
                <span className="font-semibold">
                  {formatNumber(targetQty, 0)}
                </span>
              </div>

              <div className="text-slate-200">
                Achv:{" "}
                <span className="font-semibold">
                  {formatNumber(achievedQty, 0)}
                </span>
              </div>

              <div
                className={`${varianceQty >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
              >
                Var:{" "}
                <span className="font-semibold">
                  {formatNumber(varianceQty, 0)}
                </span>
              </div>

              <div className="mt-1 flex items-center justify-end gap-1 text-[8px]">
                <span className="badge badge-outline border-slate-600 bg-slate-900/80 px-1.5 py-0.5">
                  <span className="uppercase tracking-wide text-[7px] text-slate-400">
                    MP
                  </span>
                  <span className="ml-1 text-[9px] font-semibold text-emerald-300">
                    {manpowerPresent ? formatNumber(manpowerPresent, 0) : "-"}
                  </span>
                </span>
                {wip ? (
                  <span className="badge badge-outline border-cyan-600 bg-slate-900/80 px-1.5 py-0.5">
                    <span className="uppercase tracking-wide text-[7px] text-slate-400">
                      WIP
                    </span>
                    <span className="ml-1 text-[9px] font-semibold text-cyan-300">
                      {formatNumber(wip, 0)}
                    </span>
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE: quality + production pies */}
        <div className="space-y-1.5">
          {/* QUALITY KPIs */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[9px] text-slate-400">
              <span className="uppercase tracking-wide">Quality</span>
              <span className="badge border-emerald-500/50 bg-emerald-500/10 text-[8px] text-emerald-200">
                Q Hour:{" "}
                <span className="font-semibold">{qualityHourLabel}</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 overflow-hidden">
              <MiniKpi label="RFT%" value={rft} color="#22c55e" />
              <MiniKpi label="DHU%" value={dhu} color="#f97316" />
              <MiniKpi label="Defect RATE" value={defectRate} color="#e11d48" />
            </div>
          </div>

          {/* PRODUCTION KPIs */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[9px] text-slate-400">
              <span className="uppercase tracking-wide">Production</span>
              <span className="badge border-sky-500/50 bg-sky-500/10 text-[8px] text-sky-200">
                P Hour:{" "}
                <span className="font-semibold">{prodHourLabel}</span>
              </span>
            </div>
            <div className="flex gap-1.5">
              <MiniKpi label="Hourly EFF" value={hourlyEff} color="#0ea5e9" />
              <MiniKpi label="AVG EFF" value={avgEff} color="#6366f1" />
            </div>
          </div>
        </div>

        {/* BOTTOM: media strip (image + auto-play video) */}
        {(imageSrc || videoSrc) && (
          <div className="grid grid-cols-2 gap-1.5 border-t border-slate-800 pt-1.5">
            {imageSrc && (
              <div className="rounded-xl border border-cyan-500/60 bg-slate-950/90 overflow-hidden">
                <div className="flex items-center justify-between px-2 py-0.5 text-[9px] uppercase tracking-wide bg-gradient-to-r from-cyan-500/15 to-transparent text-cyan-200">
                  <span>Image</span>
                  <span className="opacity-60">View</span>
                </div>
                <div className="h-16 bg-slate-900 flex items-center justify-center overflow-hidden">
                  <img
                    src={imageSrc}
                    alt={`${line} image`}
                    className="w-full h-full object-cover"
                    style={{ maxHeight: "100%", maxWidth: "100%" }}
                  />
                </div>
              </div>
            )}

            {videoSrc && (
              <div className="rounded-xl border border-emerald-500/60 bg-slate-950/90 overflow-hidden">
                <div className="flex items-center justify-between px-2 py-0.5 text-[9px] uppercase tracking-wide bg-gradient-to-r from-emerald-500/15 to-transparent text-emerald-200">
                  <span>Video</span>
                  <span className="opacity-60">Auto</span>
                </div>
                <div className="h-16 bg-slate-900 flex items-center justify-center overflow-hidden">
                  <video
                    src={videoSrc}
                    className="w-full h-full object-cover"
                    style={{ maxHeight: "100%", maxWidth: "100%" }}
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------ TV CARD (full-screen / full viewport area) ------------ */

function TvLineCard({ lineData, lineInfo, wipData, factory, building, date }) {
  const { line, quality, production } = lineData || {};

  const buyer = lineInfo?.buyer || "-";
  const style = lineInfo?.style || "-";
  const item = lineInfo?.styleItem || lineInfo?.garmentType || "Item";
  const colorModel = lineInfo?.colorModel || lineInfo?.color || "-";

  const runDay = lineInfo?.runDay || "-";
  const smv = lineInfo?.smv || "-";

  const imageSrc = lineInfo?.imageSrc || "";
  const videoSrc = lineInfo?.videoSrc || "";

  const targetQty = production?.targetQty ?? 0;
  const achievedQty = production?.achievedQty ?? 0;
  const rawPlan = targetQty > 0 ? (achievedQty / targetQty) * 100 : 0;
  const planPercent = clampPercent(rawPlan);
  const varianceQty = production?.varianceQty ?? 0;

  const rft = clampPercent(quality?.rftPercent ?? 0);
  const dhu = clampPercent(quality?.dhuPercent ?? 0);
  const defectRate = clampPercent(quality?.defectRatePercent ?? 0);

  const hourlyEff = clampPercent(production?.currentHourEfficiency ?? 0);
  const avgEff = clampPercent(production?.avgEffPercent ?? 0);

  const qualityHourLabel = quality?.currentHour ?? "-";
  const prodHourLabel = production?.currentHour ?? "-";

  const manpowerPresent = production?.manpowerPresent ?? 0;
  const totalInput = wipData?.capacity ?? 0;
  const wip = wipData?.wip ?? 0;
  const totalAchieved = wipData?.totalAchieved ?? 0;
  console.log("WIP DATA IN TV CARD:wipData:", wipData);
  const isBehind = varianceQty < 0;

  // 🔹 Hourly variance data for bar chart
  const [hourlyRecords, setHourlyRecords] = useState([]);
  const [varianceLoading, setVarianceLoading] = useState(false);

  useEffect(() => {
    if (!factory || !building || !line || !date) {
      setHourlyRecords([]);
      return;
    }

    const controller = new AbortController();

    const fetchVariance = async () => {
      try {
        setVarianceLoading(true);
        const params = new URLSearchParams({
          assigned_building: building,
          line,
          date,
        });
        if (factory) params.append("factory", factory);

        const res = await fetch(
          `/api/hourly-productions?${params.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const json = await res.json();

        if (!res.ok || !json.success) {
          setHourlyRecords([]);
          return;
        }

        setHourlyRecords(json.data || []);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("Error loading hourly variance:", err);
        setHourlyRecords([]);
      } finally {
        setVarianceLoading(false);
      }
    };

    fetchVariance();

    return () => controller.abort();
  }, [factory, building, line, date]);

  const varianceChartData = (hourlyRecords || []).map((rec) => ({
    hour: rec.hour,
    hourLabel: `H${rec.hour}`,
    varianceQty: rec.varianceQty ?? 0,
  }));

  return (
    <div
      className={`relative h-full w-full rounded-3xl border-2 shadow-[0_0_80px_rgba(0,0,0,0.9)] overflow-hidden
      bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900
      ${isBehind ? "border-rose-500/70" : "border-emerald-500/70"}`}
    >
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_0%_0%,rgba(45,212,191,0.25),transparent),radial-gradient(1000px_500px_at_100%_0%,rgba(56,189,248,0.25),transparent)]" />

      {/* content column fills the card height */}
      <div className="relative flex h-full flex-col gap-4 p-3 md:p-4 lg:p-5 text-xs md:text-sm min-h-0">
        {/* TOP meta row */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-800/70 pb-2">
          <div className="flex flex-wrap gap-2">
            <span className="badge badge-lg border-slate-600 bg-slate-900/80 text-amber-100">
              Buyer:&nbsp;
              <span className="font-semibold text-amber-300">{buyer}</span>
            </span>
            <span className="badge badge-lg border-fuchsia-500/70 bg-fuchsia-500/10 text-fuchsia-100">
              Style:&nbsp;
              <span className="font-semibold text-fuchsia-300">{style}</span>
            </span>
            <span className="badge badge-lg border-cyan-500/70 bg-cyan-500/10 text-cyan-100">
              Item:&nbsp;
              <span className="font-semibold text-cyan-300">{item}</span>
            </span>
            <span className="badge badge-lg border-emerald-500/70 bg-emerald-500/10 text-emerald-100">
              Run Day:&nbsp;
              <span className="font-semibold text-emerald-300">
                {runDay}
              </span>
            </span>
            <span className="badge badge-lg border-emerald-500/70 bg-emerald-500/10 text-emerald-100">
              SMV:&nbsp;
              <span className="font-semibold text-emerald-300">{smv}</span>
            </span>
            <span className="badge badge-lg border-emerald-500/70 bg-emerald-500/10 text-emerald-100">
              Man Power:&nbsp;
              <span className="font-semibold text-emerald-300">
                {manpowerPresent}
              </span>
            </span>
            <span className="badge badge-lg border-emerald-500/70 bg-emerald-500/10 text-emerald-100">
              Color/Model:&nbsp;
              <span className="font-semibold text-emerald-300">
                {colorModel}
              </span>
            </span>
          </div>

          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">
              Line
            </div>
            <div className="text-3xl md:text-4xl font-semibold text-cyan-300 drop-shadow-[0_0_24px_rgba(34,211,238,0.9)]">
              {line}
            </div>
          </div>
        </div>

        {/* MAIN AREA – grid, fills remaining height */}
        <div className="grid flex-1 min-h-0 gap-2 md:grid-cols-2 lg:grid-cols-12">
          {/* IMAGE column – media fills column height */}
          <div className="md:col-span-1 lg:col-span-3 flex flex-col min-h-0">
            <div className="flex-1 min-h-0 rounded-2xl border border-cyan-500/70 bg-slate-950/95 overflow-hidden flex flex-col">
              <div className="px-3 py-1.5 text-[10px] md:text-xs uppercase tracking-[0.14em] text-cyan-200 bg-gradient-to-r from-cyan-500/25 to-transparent border-b border-cyan-500/40 flex items-center justify-between">
                <span>STYLE IMAGE</span>
                <span className="text-[10px] text-cyan-200/70">View</span>
              </div>
              <div className="relative flex-1 min-h-[140px] sm:min-h-[160px] md:min-h-[180px] bg-black/90">
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={`${line} image`}
                    className="absolute inset-0 m-auto max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-slate-500">
                      No image attached
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* VIDEO column – media fills column height */}
          <div className="md:col-span-1 lg:col-span-3 flex flex-col min-h-0">
            <div className="flex-1 min-h-0 rounded-2xl border border-emerald-500/70 bg-slate-950/95 overflow-hidden flex flex-col">
              <div className="px-3 py-1.5 text-[10px] md:text-xs uppercase tracking-[0.14em] text-emerald-200 bg-gradient-to-r from-emerald-500/25 to-transparent border-b border-emerald-500/40 flex items-center justify-between">
                <span>LIVE VIDEO</span>
                <span className="text-[10px] text-emerald-200/70">
                  Auto Play
                </span>
              </div>
              <div className="relative flex-1 min-h-[140px] sm:min-h-[160px] md:min-h-[180px] bg-black/90">
                {videoSrc ? (
                  <video
                    src={videoSrc}
                    className="absolute inset-0 m-auto max-w-full max-h-full object-contain"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-slate-500">
                      No video attached
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* STATS + VARIANCE column */}
          <div className="md:col-span-2 lg:col-span-6 flex flex-col gap-3 min-h-0">
            {/* PLAN vs ACHV block */}
            <div className="rounded-2xl border border-sky-700 bg-gradient-to-br from-sky-900/50 via-slate-950 to-slate-900/95 p-3 md:p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="uppercase tracking-wide text-sky-200">
                  Plan vs Achieved
                </span>
                <span className="badge badge-outline border-sky-500/60 bg-slate-950/80 text-[10px] text-sky-100">
                  Plan: {formatNumber(planPercent, 1)}%
                </span>
              </div>

              <div className="mt-1 flex flex-col lg:flex-row items-center gap-4">
                <KpiPie
                  value={planPercent}
                  label=""
                  color="#22d3ee"
                  size={110}
                />

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 w-full text-[11px] md:text-xs">
                  <TvStatBox
                    label="Target"
                    value={formatNumber(targetQty, 0)}
                    accent="text-sky-200 border-sky-500/80"
                  />
                  <TvStatBox
                    label="Achieved"
                    value={formatNumber(achievedQty, 0)}
                    accent="text-emerald-200 border-emerald-500/80"
                  />
                  <TvStatBox
                    label="Variance"
                    value={formatNumber(varianceQty, 0)}
                    accent={
                      varianceQty >= 0
                        ? "text-emerald-200 border-emerald-500/80"
                        : "text-rose-200 border-rose-500/80"
                    }
                  />
                  <TvStatBox
                    label="Total Input"
                    value={formatNumber(totalInput || 0, 0)}
                    accent="text-cyan-200 border-cyan-500/80"
                  />
                  <TvStatBox
                    label="WIP"
                    value={formatNumber(wip || 0, 0)}
                    accent="text-fuchsia-200 border-fuchsia-500/80"
                  />
                  <TvStatBox
                    label="Upto Date Achieved"
                    value={formatNumber(totalAchieved || 0, 0)}
                    accent="text-fuchsia-200 border-fuchsia-500/80"
                  />
                </div>
              </div>
            </div>

            {/* QUALITY + EFF + VARIANCE block */}
            <div className="rounded-2xl border border-amber-600 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900/95 p-3 flex flex-col gap-2 min-h-0">
              <div className="flex items-center justify-between text-[11px]">
                <span className="uppercase tracking-wide text-amber-200">
                  Production &  Quality
                </span>
                <div className="flex flex-wrap gap-1">
                  <span className="badge border-emerald-500/60 bg-emerald-500/10 text-[14px] text-emerald-100">
                    Q Hour:{" "}
                    <span className="font-semibold">{qualityHourLabel}</span>
                  </span>
                  <span className="badge border-sky-500/60 bg-sky-500/10 text-[14px] text-sky-100">
                    P Hour:{" "}
                    <span className="font-semibold">{prodHourLabel}</span>
                  </span>
                </div>
              </div>

              {/* KPI tiles (your design) */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
                <KpiTile
                  label="RFT%"
                  value={`${formatNumber(rft, 1)}%`}
                  tone="emerald"
                  icon={Gauge}
                />
                <KpiTile
                  label="DEFECT RATE%"
                  value={`${formatNumber(defectRate, 1)}%`}
                  tone="red"
                  icon={AlertTriangle}
                />
                <KpiTile
                  label="DHU%"
                  value={`${formatNumber(dhu, 1)}%`}
                  tone="amber"
                  icon={Activity}
                />

                <KpiTile
                  label="HOURLY EFF%"
                  value={`${formatNumber(hourlyEff, 1)}%`}
                  tone="sky"
                  icon={Gauge}
                />
                <KpiTile
                  label="AVG EFF%"
                  value={`${formatNumber(avgEff, 1)}%`}
                  tone="purple"
                  icon={TrendingUp}
                />
              </div>

              {/* Variance chart */}
              <div className="mt-1 space-y-1 min-h-0">
                <div className="flex items-center justify-between text-[11px] text-slate-200">
                  <span className="uppercase tracking-wide text-amber-200">
                    Hourly Variance
                  </span>
                  {varianceLoading ? (
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                      <span className="loading loading-spinner loading-xs" />
                      Loading...
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">
                      Green = ahead, Red = behind
                    </span>
                  )}
                </div>
                <div className="h-24 sm:h-26 md:h-28 lg:h-32 w-full">
                  <VarianceBarChart data={varianceChartData} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------ shared small components ------------ */

function KpiPie({ value, label, color, size = 40 }) {
  const pct = clampPercent(value);
  const display = formatNumber(pct, 0);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative" style={{ width: size, height: size }}>
        <PieChart
          data={[
            { title: "value", value: pct, color },
            {
              title: "rest",
              value: 100 - pct,
              color: "#020617",
            },
          ]}
          startAngle={-90}
          lineWidth={12}
          rounded
          background="#020617"
          animate
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] md:text-[14px] font-semibold text-slate-100">
            {display}%
          </span>
        </div>
      </div>
      {label && (
        <span className="text-[8px] uppercase tracking-wide text-slate-400 text-center">
          {label}
        </span>
      )}
    </div>
  );
}

function MiniKpi({ label, value, color }) {
  const pct = clampPercent(value);
  const display = formatNumber(pct, 1);

  return (
    <div className="flex-1 min-w-[0] flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/90 px-1.5 py-1">
      <div className="flex-shrink-0">
        <KpiPie value={pct} label="" color={color} size={28} />
      </div>
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-[8px] uppercase tracking-wide text-slate-400 truncate">
          {label}
        </span>
        <span className="text-[11px] font-semibold text-slate-50">
          {display}%
        </span>
      </div>
    </div>
  );
}

function TvStatBox({ label, value, accent = "", big = false }) {
  return (
    <div
      className={`rounded-xl border bg-slate-950/90 px-2 py-1.5 flex flex-col justify-center ${accent || "border-slate-600 text-slate-100"
        }`}
    >
      <span className="text-[14px] uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className={`font-semibold ${big ? "text-[15px]" : "text-[14px]"}`}>
        {value}
      </span>
    </div>
  );
}

/* ------------ Variance bar chart (Recharts) ------------ */

function VarianceBarChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[11px] text-slate-500">
        No hourly records yet
      </div>
    );
  }

  const maxAbs =
    data.reduce(
      (max, d) => Math.max(max, Math.abs(d.varianceQty || 0)),
      0
    ) || 1;

  const chartData = data.map((d) => ({
    ...d,
    varianceQty: d.varianceQty || 0,
    fill: (d.varianceQty || 0) >= 0 ? "#22c55e" : "#ef4444",
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
      >
        <XAxis
          dataKey="hourLabel"
          tickLine={false}
          axisLine={{ stroke: "#475569" }}
          tick={{ fontSize: 10, fill: "#cbd5f5" }}
        />
        <YAxis
          tickLine={false}
          axisLine={{ stroke: "#475569" }}
          tick={{ fontSize: 10, fill: "#cbd5f5" }}
          domain={[-maxAbs, maxAbs]}
        />
        <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />
        <Tooltip
          cursor={{ fill: "rgba(15,23,42,0.4)" }}
          contentStyle={{
            backgroundColor: "#020617",
            border: "1px solid #475569",
            borderRadius: "0.5rem",
            padding: "6px 8px",
          }}
          labelStyle={{ fontSize: 11, color: "#e2e8f0" }}
          itemStyle={{ fontSize: 11, color: "#e2e8f0" }}
        />
        <Bar dataKey="varianceQty" radius={[3, 3, 0, 0]}>
          {chartData.map((entry, idx) => (
            <Cell key={idx} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
