// app/floor-dashboard/page.jsx
"use client";

import { useState, useEffect } from "react";
import { PieChart } from "react-minimal-pie-chart";

const factoryOptions = ["K-1", "K-2", "K-3"]; // adjust as needed

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

function formatNumber(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toFixed(digits);
}

export default function FloorDashboardPage() {
  const [factory, setFactory] = useState("K-2");
  const [building, setBuilding] = useState("A-2");
  const [date, setDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [line, setLine] = useState("ALL");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 🔹 line-info register data (buyer, style, runDay, smv, etc.)
  const [lineInfoMap, setLineInfoMap] = useState({});
  // 🔹 WIP data per line
  const [wipMap, setWipMap] = useState({});

  // ============================================================
  // 1) Main dashboard data (production + quality) – auto refresh
  // ============================================================
  useEffect(() => {
    if (!factory || !building || !date) {
      setRows([]);
      return;
    }

    let cancelled = false;

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
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to load dashboard.");
        }

        if (!cancelled) {
          setRows(json.lines || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError(err.message || "Failed to load dashboard.");
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    // initial load
    fetchDashboard();

    // polling for "realtime" updates (every 10 seconds)
    const intervalId = setInterval(fetchDashboard, 10000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [factory, building, date, line]);

  // ============================================================
  // 2) Load Line Info (buyer, style, runDay, smv) by factory+building
  //    -> we keep latest record per line in a map
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

        // pick latest per line (API already sorted, but we are safe)
        const map = {};
        for (const doc of list) {
          if (!map[doc.line]) {
            map[doc.line] = doc; // first occurrence is latest because of sort
          }
        }

        if (!cancelled) {
          setLineInfoMap(map);
        }
      } catch (err) {
        console.error("Error fetching line info:", err);
        if (!cancelled) setLineInfoMap({});
      }
    };

    fetchLineInfo();

    // optional: can also poll if you want, but usually line info changes rarely
    return () => {
      cancelled = true;
    };
  }, [factory, building]);

  // ============================================================
  // 3) Load WIP per line using /api/style-wip
  //    Depends on: factory, building, date, rows, lineInfoMap
  // ============================================================
  useEffect(() => {
    if (!factory || !building || !date || rows.length === 0) {
      setWipMap({});
      return;
    }

    // need line info for buyer + style
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

        // Without buyer/style we can't calculate WIP
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
            newMap[lineName] = json.data; // {capacity, totalAchieved, wip, ...}
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

    // this effect will re-run whenever rows change
    return () => {
      cancelled = true;
    };
  }, [factory, building, date, rows, lineInfoMap]);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-slate-950 py-3 px-2">
      <div className="space-y-4">
        {/* Filter Panel */}
        <div className="card bg-slate-950/80 border border-slate-800 shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
          <div className="card-body p-3 text-xs space-y-2">
            <div className="flex flex-wrap items-end gap-3">
              {/* Factory */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase text-amber-100">
                  Factory
                </label>
                <select
                  className="select select-xs select-bordered min-w-[120px]"
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
                  Building
                </label>
                <select
                  className="select select-xs select-bordered min-w-[120px]"
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
                  className="input input-xs input-bordered"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              {/* Line */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase text-amber-100">
                  Line
                </label>
                <select
                  className="select select-xs select-bordered min-w-[120px]"
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

              {loading && (
                <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-500">
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

        {/* Cards */}
        {rows.length === 0 && !loading && !error && (
          <p className="text-[11px] text-slate-500">
            No data for this factory/building/date yet.
          </p>
        )}

        {rows.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((row) => (
              <LineCard
                key={row.line}
                lineData={row}
                lineInfo={lineInfoMap[row.line]}
                wipData={wipMap[row.line]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LineCard({ lineData, lineInfo, wipData }) {
  const { line, quality, production } = lineData || {};

  const buyer = lineInfo?.buyer || "-";
  const style = lineInfo?.style || "-";
  const runDay = lineInfo?.runDay || "-";
  const smv = lineInfo?.smv || "-";

  const imageSrc = lineInfo?.imageSrc || "";
  const videoSrc = lineInfo?.videoSrc || "";

  // --- main KPI: Plan vs Achieved ---
  const targetQty = production?.targetQty ?? 0;
  const achievedQty = production?.achievedQty ?? 0;
  const rawPlan = targetQty > 0 ? (achievedQty / targetQty) * 100 : 0;
  const planPercent = clampPercent(rawPlan);
  const varianceQty = production?.varianceQty ?? 0;

  // --- quality KPIs ---
  const rft = clampPercent(quality?.rftPercent ?? 0);
  const dhu = clampPercent(quality?.dhuPercent ?? 0);
  const defectRate = clampPercent(quality?.defectRatePercent ?? 0);

  // --- production KPIs ---
  const hourlyEff = clampPercent(production?.currentHourEfficiency ?? 0);
  const avgEff = clampPercent(production?.avgEffPercent ?? 0);

  const qualityHourLabel = quality?.currentHour ?? "-";
  const prodHourLabel = production?.currentHour ?? "-";

  return (
    <div className="card rounded-2xl border border-slate-800 bg-slate-950/95 shadow-[0_12px_36px_rgba(0,0,0,0.7)] overflow-hidden">
      <div className="card-body p-3 space-y-2 text-[11px] text-slate-100">
        {/* TOP: meta + main donut */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-2">
          {/* left chips */}
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1">
              <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[9px] uppercase tracking-wide text-slate-300">
                Floor / Line&nbsp;
                <span className="font-semibold text-cyan-300">{line}</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/60 text-[9px] text-amber-100">
                Buyer: <span className="font-semibold">{buyer}</span>
              </span>
            </div>

            <div className="flex flex-wrap gap-1 text-[9px]">
              <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/60 text-fuchsia-100">
                Style: <span className="font-semibold">{style}</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/60 text-emerald-100">
                SMV: <span className="font-semibold">{smv}</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/60 text-sky-100">
                Run Day: <span className="font-semibold">{runDay}</span>
              </span>
            </div>
          </div>

          {/* right: main pie + bordered plan summary */}
          <div className="flex items-center gap-2 ">
            <KpiPie
              value={planPercent}
              label="PLAN"
              color="#22d3ee"
              size={46}
            />

            <div className="text-[9px] leading-tight text-right rounded-xl border border-sky-500/60  bg-slate-950/80 px-2 py-1.5 shadow-[0_0_0_1px_rgba(15,23,42,0.9)]">
              <div className="text-[8px] uppercase tracking-wide text-slate-400 mb-0.5">
                Plan Summary
              </div>

              <div className="text-slate-300">
                Target:{" "}
                <span className="font-semibold">
                  {formatNumber(targetQty, 0)}
                </span>
              </div>

              <div className="text-slate-300">
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
            </div>
          </div>

        </div>

        {/* MIDDLE: quality + production pies */}
        <div className="space-y-1.5">
          {/* QUALITY KPIs */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[9px] text-slate-400">
              <span className="uppercase tracking-wide">
                Quality KPIs
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/50 text-[8px] text-emerald-200">
                Quality Current Hour:{" "}
                <span className="font-semibold">{qualityHourLabel}</span>
              </span>
            </div>
            <div className="flex gap-1.5">
              <MiniKpi label="RFT%" value={rft} color="#22c55e" />
              <MiniKpi label="DHU%" value={dhu} color="#f97316" />
              <MiniKpi label="Defect RATE" value={defectRate} color="#e11d48" />
            </div>
          </div>

          {/* PRODUCTION KPIs */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[9px] text-slate-400">
              <span className="uppercase tracking-wide">
                Production Eff%
              </span>
              <span className="px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/50 text-[8px] text-sky-200">
                Production's Current Hour:{" "}
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
                <div className="h-16 bg-slate-900 flex items-center justify-center">
                  <img
                    src={imageSrc}
                    alt={`${line} image`}
                    className="h-full w-full object-cover"
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
                <div className="h-16 bg-slate-900 flex items-center justify-center">
                  <video
                    src={videoSrc}
                    className="h-full w-full object-cover"
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

function Row({ label, value, valueClass = "" }) {
  return (
    <div className="flex justify-between text-[10px]">
      <span className="text-slate-400">{label}</span>
      <span className={`font-semibold text-slate-100 ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

// clamp percent between 0–100
function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

// generic pie using react-minimal-pie-chart
function KpiPie({ value, label, color, size = 40 }) {
  const pct = clampPercent(value);
  const display = formatNumber(pct, 0);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className="relative"
        style={{ width: size, height: size }}
      >
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
          <span className="text-[9px] font-semibold text-slate-100">
            {display}%
          </span>
        </div>
      </div>
      {label && (
        <span className="text-[8px] uppercase tracking-wide text-slate-400">
          {label}
        </span>
      )}
    </div>
  );
}

// compact KPI tile with small pie
function MiniKpi({ label, value, color }) {
  const pct = clampPercent(value);
  const display = formatNumber(pct, 1);

  return (
    <div className="flex-1 min-w-[0] flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/90 px-1.5 py-1">
      <KpiPie value={pct} label="" color={color} size={32} />
      <div className="flex flex-col leading-tight">
        <span className="text-[8px] uppercase tracking-wide text-slate-400">
          {label}
        </span>
        <span className="text-[11px] font-semibold text-slate-50">
          {display}%
        </span>
      </div>
    </div>
  );
}
