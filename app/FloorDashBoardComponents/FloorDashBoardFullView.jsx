// app/FloorDashBoardComponents/FloorDashBoardFullView.jsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/app/hooks/useAuth";

import {
  factoryOptions,
  buildingOptions,
  lineOptions,
  REFRESH_INTERVAL_FULL_MS,
  HEADER_REFRESH_MS,
  clampPercent,
  formatNumber,
  makeSegmentKey,
  makeStyleMediaKey,
  pickLatest,
  sortRowsByLineAndStyle,
  todayKeyDhaka,
  getDefaultFactoryBuilding,
  KpiPie,
} from "./floorDashboardShared";

export default function FloorDashBoardFullView() {
  const { auth } = useAuth();
  const initRef = useRef(false);

  const [factory, setFactory] = useState("K-2");
  const [building, setBuilding] = useState("A-2");
  const [date, setDate] = useState(() => todayKeyDhaka());
  const [line, setLine] = useState("ALL");

  const [rows, setRows] = useState([]);
  const [headerMap, setHeaderMap] = useState({});
  const [styleMediaMap, setStyleMediaMap] = useState({});
  const [wipMap, setWipMap] = useState({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [refreshTick, setRefreshTick] = useState(0);
  const [headerTick, setHeaderTick] = useState(0);

  useEffect(() => {
    if (initRef.current) return;
    const { factory: f, building: b } = getDefaultFactoryBuilding(auth);
    setFactory(f || "K-2");
    setBuilding(b || "A-2");
    initRef.current = true;
  }, [auth]);

  const sortedRows = useMemo(() => sortRowsByLineAndStyle(rows), [rows]);

  useEffect(() => {
    const id = setInterval(() => setRefreshTick((p) => p + 1), REFRESH_INTERVAL_FULL_MS);
    const onFocus = () => setRefreshTick((p) => p + 1);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setHeaderTick((p) => p + 1), HEADER_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  // dashboard
  useEffect(() => {
    if (!factory || !building || !date) return;

    const controller = new AbortController();

    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams({ factory, building, date });
        if (line && line !== "ALL") params.append("line", line);

        const res = await fetch(`/api/floor-dashboard?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Failed to load dashboard.");
        setRows(json.lines || []);
      } catch (e) {
        if (e?.name === "AbortError") return;
        console.error(e);
        setError(e?.message || "Failed to load dashboard.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
    return () => controller.abort();
  }, [factory, building, date, line, refreshTick]);

  // headers
  useEffect(() => {
    if (!factory || !building || !date) return;

    let cancelled = false;

    const fetchHeaders = async () => {
      try {
        const params = new URLSearchParams({
          factory,
          assigned_building: building,
          date,
        });
        if (line && line !== "ALL") params.append("line", line);

        const res = await fetch(`/api/target-setter-header?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json();

        if (!res.ok || !json.success) {
          if (!cancelled) setHeaderMap({});
          return;
        }

        const list = json.data || json.headers || json.items || [];
        const map = {};
        for (const h of list) {
          const segKey = makeSegmentKey(h.line, h.buyer, h.style);
          map[segKey] = map[segKey] ? pickLatest(map[segKey], h) : h;
        }
        if (!cancelled) setHeaderMap(map);
      } catch (e) {
        console.error(e);
        if (!cancelled) setHeaderMap({});
      }
    };

    fetchHeaders();
    return () => {
      cancelled = true;
    };
  }, [factory, building, date, line, headerTick]);

  // style media
  useEffect(() => {
    if (!factory || !building || !date) return;

    let cancelled = false;

    const fetchMedia = async () => {
      try {
        const params = new URLSearchParams({ factory, assigned_building: building, date });
        const res = await fetch(`/api/style-media?${params.toString()}`, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok || !json.success) {
          if (!cancelled) setStyleMediaMap({});
          return;
        }

        const list = json.data || [];
        const map = {};
        for (const doc of list) {
          const buyer = doc?.buyer || "";
          const style = doc?.style || "";
          const colorModel = doc?.color_model || doc?.colorModel || doc?.color || "";
          const k = makeStyleMediaKey(factory, building, buyer, style, colorModel);
          if (!map[k]) map[k] = doc;
        }

        if (!cancelled) setStyleMediaMap(map);
      } catch (e) {
        console.error(e);
        if (!cancelled) setStyleMediaMap({});
      }
    };

    fetchMedia();
    return () => {
      cancelled = true;
    };
  }, [factory, building, date]);

  // WIP for all segments (concurrency limited)
  useEffect(() => {
    if (!factory || !building || !date || sortedRows.length === 0) {
      setWipMap({});
      return;
    }

    let cancelled = false;

    const fetchWipAll = async () => {
      const newMap = {};

      const tasks = sortedRows.map((row) => async () => {
        const segKey = makeSegmentKey(row.line, row.buyer, row.style);
        const header = headerMap[segKey];

        const buyer = header?.buyer || row.buyer || "";
        const style = header?.style || row.style || "";
        if (!row.line || !buyer || !style) return;

        const params = new URLSearchParams({
          factory,
          assigned_building: building,
          line: row.line,
          buyer,
          style,
          date,
        });

        try {
          const res = await fetch(`/api/style-wip?${params.toString()}`, { cache: "no-store" });
          const json = await res.json();
          if (res.ok && json.success) newMap[segKey] = json.data;
        } catch (e) {
          console.error(e);
        }
      });

      // ✅ simple concurrency limit
      const limit = 5;
      let i = 0;

      const runWorker = async () => {
        while (i < tasks.length) {
          const idx = i++;
          await tasks[idx]();
        }
      };

      await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, runWorker));

      if (!cancelled) setWipMap(newMap);
    };

    fetchWipAll();
    return () => {
      cancelled = true;
    };
  }, [factory, building, date, sortedRows, headerMap, refreshTick]);

  const hasData = sortedRows.length > 0;

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-50 py-1.5 px-2">
      <div className="max-w-[1700px] mx-auto flex flex-col gap-2 h-full">
        {/* Filter Panel */}
        <div className="card bg-base-300/10 border border-slate-800/80 shadow-[0_8px_28px_rgba(0,0,0,0.9)]">
          <div className="card-body p-2 md:p-2.5 text-xs space-y-2">
            <div className="flex flex-wrap items-end gap-3">
              {/* Factory */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase text-amber-100">
                  Factory
                </label>
                <select
                  className="select select-xs bg-amber-300/95 select-bordered min-w-[120px] text-slate-900"
                  value={factory}
                  onChange={(e) => setFactory(e.target.value)}
                >
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
                </label>
                <select
                  className="select select-xs bg-amber-300/95 select-bordered min-w-[120px] text-slate-900"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                >
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
                <label className="block text-[11px] font-semibold uppercase text-amber-100 ">
                  Line
                </label>
                <select
                  className="select select-xs bg-amber-300/95 select-bordered min-w-[110px] text-slate-900"
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

              {/* nav */}
              <div className="ml-auto flex items-center gap-2">
                <Link
                  href="/floor-dashboard"
                  className="btn btn-xs bg-cyan-600 border border-cyan-400 text-slate-950 hover:bg-cyan-500"
                >
                  TV View
                </Link>
                <Link
                  href="/floor-dashboard/full"
                  className="btn btn-xs bg-slate-900 border border-slate-700 text-slate-100 hover:bg-slate-800"
                >
                  Full View
                </Link>
              </div>

              {loading && (
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
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

        {/* CONTENT */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {!hasData && !loading && !error && (
            <p className="text-[11px] text-slate-500">No data for this factory/building/date yet.</p>
          )}

          {hasData && (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 pb-1">
              {sortedRows.map((row) => {
                const segKey = makeSegmentKey(row.line, row.buyer, row.style);
                const header = headerMap[segKey];

                const buyerForMedia = header?.buyer || row?.buyer || "";
                const styleForMedia = header?.style || row?.style || "";
                const colorForMedia =
                  header?.color_model ||
                  header?.colorModel ||
                  header?.color ||
                  header?.color_model_name ||
                  row?.colorModel ||
                  row?.color ||
                  "";

                const mediaKey = makeStyleMediaKey(
                  factory,
                  building,
                  buyerForMedia,
                  styleForMedia,
                  colorForMedia
                );

                return (
                  <LineCard
                    key={`${segKey}__${colorForMedia || ""}`}
                    lineData={row}
                    header={header}
                    styleMedia={styleMediaMap[mediaKey]}
                    wipData={wipMap[segKey]}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------ GRID CARD (same as your existing one) ------------ */
function LineCard({ lineData, header, styleMedia, wipData }) {
  const { line, quality, production } = lineData || {};

  const buyer = header?.buyer || lineData?.buyer || "-";
  const style = header?.style || lineData?.style || "-";
  const runDay = header?.run_day ?? header?.runDay ?? "-";
  const smv = header?.smv ?? "-";

  const item = header?.Item || header?.item || lineData?.Item || "-";
  const colorModel = header?.color_model || header?.colorModel || header?.color || "-";

  const imageSrc = styleMedia?.imageSrc || "";
  const videoSrc = styleMedia?.videoSrc || "";

  const targetQty = production?.targetQty ?? 0;
  const achievedQty = production?.achievedQty ?? 0;
  const rawPlan = targetQty > 0 ? (achievedQty / targetQty) * 100 : 0;
  const planPercent = clampPercent(rawPlan);
  const varianceQty = production?.varianceQty ?? 0;

  const prevWorkingDate = production?.prevWorkingDate || null;
  const prevWorkingAchievedQty = production?.prevWorkingAchievedQty ?? 0;

  const rft = clampPercent(quality?.rftPercent ?? 0);
  const dhu = clampPercent(quality?.dhuPercent ?? 0);
  const defectRate = clampPercent(quality?.defectRatePercent ?? 0);

  const hourlyEff = clampPercent(production?.currentHourEfficiency ?? 0);
  const avgEff = clampPercent(production?.avgEffPercent ?? 0);

  const qualityHourLabel = quality?.currentHour ?? "-";
  const prodHourLabel = production?.currentHour ?? "-";

  const manpowerPresent =
    production?.manpowerPresent ?? header?.manpower_present ?? header?.manpowerPresent ?? 0;

  const wip = wipData?.wip ?? 0;
  const isBehind = varianceQty < 0;

  return (
    <div
      className={`card h-full rounded-2xl border bg-slate-950/95 shadow-[0_10px_28px_rgba(0,0,0,0.7)] overflow-hidden 
      ${isBehind ? "border-rose-500/40" : "border-emerald-500/35"}`}
    >
      <div className="card-body p-2 space-y-1 text-[11px] text-slate-100 bg-gradient-to-b from-slate-950 via-slate-950/95 to-slate-950">
        {/* TOP */}
        <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-1">
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1">
              <span className="badge badge-outline border-slate-600 bg-slate-900 text-[9px]">
                Line&nbsp;<span className="font-semibold text-cyan-300">{line}</span>
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
              <span className="badge border-sky-500/60 bg-sky-500/10 text-sky-100 text-[9px]">
                Item: <span className="font-semibold">{item}</span>
              </span>
              <span className="badge border-sky-500/60 bg-sky-500/10 text-sky-100 text-[9px]">
                Color: <span className="font-semibold">{colorModel}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <KpiPie value={planPercent} label="PLAN" color="#22d3ee" size={42} animate={true} />

            <div className="text-[9px] leading-tight text-right rounded-lg border border-sky-500/60 bg-slate-950/85 px-2 py-1.5">
              <div className="text-[8px] uppercase tracking-wide text-slate-400 mb-0.5">
                Plan Summary
              </div>

              <div className="text-slate-200 font-semibold">
                Target: <span className="font-semibold">{formatNumber(targetQty, 0)}</span>
              </div>

              <div className="text-slate-200">
                Achv: <span className="font-semibold">{formatNumber(achievedQty, 0)}</span>
              </div>

              <div className="text-slate-200">
                Last Day ({prevWorkingDate || "-"}):{" "}
                <span className="font-semibold">{formatNumber(prevWorkingAchievedQty, 0)}</span>
              </div>

              <div className={varianceQty >= 0 ? "text-emerald-400" : "text-rose-400"}>
                Var: <span className="font-semibold">{formatNumber(varianceQty, 0)}</span>
              </div>

              <div className="mt-1 flex items-center justify-end gap-1 text-[8px]">
                <span className="badge badge-outline border-slate-600 bg-slate-900/80 px-1.5 py-0.5">
                  <span className="uppercase tracking-wide text-[7px] text-slate-400">MP</span>
                  <span className="ml-1 text-[9px] font-semibold text-emerald-300">
                    {manpowerPresent ? formatNumber(manpowerPresent, 0) : "-"}
                  </span>
                </span>

                {wip ? (
                  <span className="badge badge-outline border-cyan-600 bg-slate-900/80 px-1.5 py-0.5">
                    <span className="uppercase tracking-wide text-[7px] text-slate-400">WIP</span>
                    <span className="ml-1 text-[9px] font-semibold text-cyan-300">
                      {formatNumber(wip, 0)}
                    </span>
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE */}
        <div className="space-y-1.5">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[9px] text-slate-400">
              <span className="uppercase tracking-wide">Quality</span>
              <span className="badge border-emerald-500/50 bg-emerald-500/10 text-[8px] text-emerald-200">
                Q Hour: <span className="font-semibold">{qualityHourLabel}</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 overflow-hidden">
              <MiniKpi label="RFT%" value={rft} color="#22c55e" />
              <MiniKpi label="DHU%" value={dhu} color="#f97316" />
              <MiniKpi label="Defect RATE" value={defectRate} color="#e11d48" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[9px] text-slate-400">
              <span className="uppercase tracking-wide">Production</span>
              <span className="badge border-sky-500/50 bg-sky-500/10 text-[8px] text-sky-200">
                P Hour: <span className="font-semibold">{prodHourLabel}</span>
              </span>
            </div>
            <div className="flex gap-1.5">
              <MiniKpi label="Hourly EFF" value={hourlyEff} color="#0ea5e9" />
              <MiniKpi label="AVG EFF" value={avgEff} color="#6366f1" />
            </div>
          </div>
        </div>

        {/* BOTTOM: media */}
        {(imageSrc || videoSrc) && (
          <div className="grid grid-cols-2 gap-1.5 border-t border-slate-800 pt-1.5">
            {imageSrc && (
              <div className="rounded-xl border border-cyan-500/60 bg-slate-950/90 overflow-hidden">
                <div className="flex items-center justify-between px-2 py-0.5 text-[9px] uppercase tracking-wide bg-gradient-to-r from-cyan-500/15 to-transparent text-cyan-200">
                  <span>Image</span>
                  <span className="opacity-60">View</span>
                </div>
                <div className="h-16 bg-slate-900 flex items-center justify-center overflow-hidden">
                  <img src={imageSrc} alt={`${line} image`} className="w-full h-full object-cover" />
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
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="none"
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

function MiniKpi({ label, value, color }) {
  const pct = clampPercent(value);
  const display = formatNumber(pct, 1);

  return (
    <div className="flex-1 min-w-[0] flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/90 px-1.5 py-1">
      <div className="flex-shrink-0">
        <KpiPie value={pct} label="" color={color} size={26} animate={true} />
      </div>
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-[8px] uppercase tracking-wide text-slate-400 truncate">{label}</span>
        <span className="text-[11px] font-semibold text-slate-50">{display}%</span>
      </div>
    </div>
  );
}
