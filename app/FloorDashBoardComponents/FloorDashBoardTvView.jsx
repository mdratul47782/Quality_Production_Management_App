// app/FloorDashBoardComponents/FloorDashBoardTvView.jsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Gauge, TrendingUp, Activity, AlertTriangle } from "lucide-react";
import { useAuth } from "@/app/hooks/useAuth";

import {
  factoryOptions,
  buildingOptions,
  lineOptions,
  REFRESH_INTERVAL_TV_MS,
  HEADER_REFRESH_MS,
  clampPercent,
  formatNumber,
  makeSegmentKey,
  makeStyleMediaKey,
  pickLatest,
  sortRowsByLineAndStyle,
  toNumber,
  KpiTile,
  KpiPie,
  TvStatBox,
  VarianceBarChart,
  todayKeyDhaka,
  getDefaultFactoryBuilding,
} from "./floorDashboardShared";

export default function FloorDashBoardTvView() {
  const { auth } = useAuth();

  // ✅ init defaults
  const initRef = useRef(false);

  const [factory, setFactory] = useState("K-2");
  const [building, setBuilding] = useState("A-2");
  const [date, setDate] = useState(() => todayKeyDhaka());
  const [line, setLine] = useState("ALL");

  const [rows, setRows] = useState([]);
  const [headerMap, setHeaderMap] = useState({});
  const [styleMediaMap, setStyleMediaMap] = useState({});
  const [currentWip, setCurrentWip] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ TV: refresh only main dashboard frequently
  const [refreshTick, setRefreshTick] = useState(0);
  const [headerTick, setHeaderTick] = useState(0);

  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  // ✅ once auth is ready, set defaults (do not overwrite user changes later)
  useEffect(() => {
    if (initRef.current) return;

    const { factory: f, building: b } = getDefaultFactoryBuilding(auth);
    setFactory(f || "K-2");
    setBuilding(b || "A-2");

    initRef.current = true;
  }, [auth]);

  const sortedRows = useMemo(() => sortRowsByLineAndStyle(rows), [rows]);

  // ✅ Polling: dashboard only (lighter)
  useEffect(() => {
    const id = setInterval(() => setRefreshTick((p) => p + 1), REFRESH_INTERVAL_TV_MS);
    const onFocus = () => setRefreshTick((p) => p + 1);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // ✅ Headers refresh slower (lighter)
  useEffect(() => {
    const id = setInterval(() => setHeaderTick((p) => p + 1), HEADER_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  // 1) Main dashboard segments
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

  // 2) Headers (TargetSetterHeader) - slower refresh
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

  // 3) Style media (image/video) - fetch only when filters change (not every refreshTick)
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

  // ✅ TV: auto-slide
  useEffect(() => setCurrentCardIndex(0), [sortedRows.length, factory, building, date, line]);

  useEffect(() => {
    if (sortedRows.length <= 1) return;
    const id = setInterval(() => {
      setCurrentCardIndex((prev) => (sortedRows.length === 0 ? 0 : (prev + 1) % sortedRows.length));
    }, 10000);
    return () => clearInterval(id);
  }, [sortedRows.length]);

  const hasData = sortedRows.length > 0;
  const safeIndex = sortedRows.length > 0 ? currentCardIndex % sortedRows.length : 0;
  const currentRow = sortedRows[safeIndex];

  // ✅ TV: fetch WIP only for current segment (BIG pressure cut)
  useEffect(() => {
    if (!factory || !building || !date || !currentRow) {
      setCurrentWip(null);
      return;
    }

    const segKey = makeSegmentKey(currentRow.line, currentRow.buyer, currentRow.style);
    const header = headerMap[segKey];

    const buyer = header?.buyer || currentRow.buyer || "";
    const style = header?.style || currentRow.style || "";
    if (!currentRow.line || !buyer || !style) {
      setCurrentWip(null);
      return;
    }

    const controller = new AbortController();

    const fetchWip = async () => {
      try {
        const params = new URLSearchParams({
          factory,
          assigned_building: building,
          line: currentRow.line,
          buyer,
          style,
          date,
        });

        const res = await fetch(`/api/style-wip?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = await res.json();

        if (res.ok && json.success) setCurrentWip(json.data || null);
        else setCurrentWip(null);
      } catch (e) {
        if (e?.name === "AbortError") return;
        console.error(e);
        setCurrentWip(null);
      }
    };

    fetchWip();
    return () => controller.abort();
  }, [factory, building, date, currentRow, headerMap, refreshTick]);

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

              {/* ✅ nav buttons */}
              <div className="ml-auto flex items-center gap-2">
                <Link
                  href="/floor-dashboard"
                  className="btn btn-xs bg-slate-900 border border-slate-700 text-slate-100 hover:bg-slate-800"
                >
                  TV View
                </Link>
                <Link
                  href="/floor-dashboard/full"
                  className="btn btn-xs bg-cyan-600 border border-cyan-400 text-slate-950 hover:bg-cyan-500"
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
        <div className="flex-1 min-h-0 overflow-hidden">
          {!hasData && !loading && !error && (
            <p className="text-[11px] text-slate-500">No data for this factory/building/date yet.</p>
          )}

          {hasData && currentRow && (
            <div className="flex-1 min-h-0 flex flex-col space-y-2">
              <div className="flex-1 min-h-0">
                {(() => {
                  const segKey = makeSegmentKey(currentRow.line, currentRow.buyer, currentRow.style);
                  const header = headerMap[segKey];

                  const buyerForMedia = header?.buyer || currentRow?.buyer || "";
                  const styleForMedia = header?.style || currentRow?.style || "";
                  const colorForMedia =
                    header?.color_model ||
                    header?.colorModel ||
                    header?.color ||
                    header?.color_model_name ||
                    currentRow?.colorModel ||
                    currentRow?.color ||
                    "";

                  const mediaKey = makeStyleMediaKey(
                    factory,
                    building,
                    buyerForMedia,
                    styleForMedia,
                    colorForMedia
                  );

                  return (
                    <TvLineCard
                      lineData={currentRow}
                      header={header}
                      styleMedia={styleMediaMap[mediaKey]}
                      wipData={currentWip}
                      factory={factory}
                      building={building}
                      date={date}
                      refreshTick={refreshTick}
                    />
                  );
                })()}
              </div>

              {/* dots */}
              <div className="flex flex-col items-center gap-1 text-[9px] text-slate-400 pb-1">
                <div className="flex items-center gap-1 flex-wrap justify-center">
                  {sortedRows.map((row, idx) => {
                    const segKey = makeSegmentKey(row.line, row.buyer, row.style);
                    return (
                      <button
                        key={`${segKey}__${idx}`}
                        type="button"
                        onClick={() => setCurrentCardIndex(idx)}
                        className={`h-2 rounded-full transition-all duration-300 ${
                          idx === safeIndex
                            ? "w-5 bg-sky-400"
                            : "w-2 bg-slate-600 hover:bg-slate-400"
                        }`}
                      />
                    );
                  })}
                </div>
                <div className="text-center">
                  Showing <span className="mx-1 font-semibold text-sky-300">{safeIndex + 1}</span> of{" "}
                  <span className="mx-1 font-semibold text-slate-200">{sortedRows.length}</span>
                  {" "}segments • Auto slide every 10s
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------ TV CARD (same design, lighter video) ------------ */

function TvLineCard({ lineData, header, styleMedia, wipData, factory, building, date, refreshTick }) {
  const { line, quality, production } = lineData || {};

  const buyer = header?.buyer || lineData?.buyer || "-";
  const style = header?.style || lineData?.style || "-";
  const item = header?.item || header?.style_item || header?.Item || "Item";

  const colorModel =
    header?.color_model ||
    header?.colorModel ||
    header?.color ||
    header?.color_model_name ||
    "-";

  const runDay = header?.run_day ?? header?.runDay ?? "-";
  const smv = header?.smv ?? "-";

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
    production?.manpowerPresent ??
    header?.manpower_present ??
    header?.manpowerPresent ??
    0;

  const totalInput = wipData?.capacity ?? 0;
  const wip = wipData?.wip ?? 0;
  const totalAchieved = wipData?.totalAchieved ?? 0;

  const isBehind = varianceQty < 0;
  const headerId = header?._id || header?.id || "";

  const [varianceLoading, setVarianceLoading] = useState(false);
  const [varianceChartData, setVarianceChartData] = useState([]);

  const getHourNum = (rec) => {
    const h =
      rec?.hour ??
      rec?.hourIndex ??
      rec?.hour_no ??
      rec?.hourNo ??
      rec?.hourNumber ??
      rec?.index ??
      null;
    const hn = toNumber(h, null);
    return Number.isFinite(hn) ? hn : null;
  };

  const getVarianceNum = (rec) => {
    const v =
      rec?.varianceQty ??
      rec?.variance ??
      rec?.variance_qty ??
      rec?.varianceQuantity ??
      rec?.varianceThisHour ??
      rec?.variance_this_hour ??
      rec?.production?.varianceQty ??
      rec?.production?.variance ??
      0;
    return toNumber(v, 0);
  };

  const ordinal = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "";
    const j = x % 10,
      k = x % 100;
    if (j === 1 && k !== 11) return `${x}st`;
    if (j === 2 && k !== 12) return `${x}nd`;
    if (j === 3 && k !== 13) return `${x}rd`;
    return `${x}th`;
  };

  useEffect(() => {
    if (!factory || !building || !line || !date) {
      setVarianceChartData([]);
      return;
    }

    const controller = new AbortController();

    const fetchVariance = async () => {
      try {
        setVarianceLoading(true);

        const params = new URLSearchParams();
        if (headerId) params.set("headerId", headerId);
        else {
          params.set("assigned_building", building);
          params.set("line", line);
          params.set("date", date);
          if (factory) params.set("factory", factory);
        }

        const res = await fetch(`/api/hourly-productions?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = await res.json();

        if (!res.ok || !json.success) {
          setVarianceChartData([]);
          return;
        }

        const list = json.data || [];
        const normalized = list
          .map((rec) => {
            const hour = getHourNum(rec);
            const variance = Math.round(getVarianceNum(rec));
            return {
              hour,
              hourLabel: hour != null ? `${ordinal(hour)} Hour` : "-",
              varianceQty: variance,
            };
          })
          .filter((d) => d.hour != null)
          .sort((a, b) => a.hour - b.hour);

        setVarianceChartData(normalized);
      } catch (e) {
        if (e?.name === "AbortError") return;
        console.error(e);
        setVarianceChartData([]);
      } finally {
        setVarianceLoading(false);
      }
    };

    fetchVariance();
    return () => controller.abort();
  }, [factory, building, line, date, headerId, refreshTick]);

  return (
    <div
      className={`relative w-full rounded-3xl border-2 shadow-[0_0_80px_rgba(0,0,0,0.9)] overflow-hidden
      bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900
      ${isBehind ? "border-rose-500/70" : "border-emerald-500/70"}`}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_0%_0%,rgba(45,212,191,0.25),transparent),radial-gradient(1000px_500px_at_100%_0%,rgba(56,189,248,0.25),transparent)]" />

      <div className="relative flex flex-col gap-3 p-3 md:p-4 lg:p-4 text-xs md:text-sm min-h-[380px] sm:min-h-[420px] lg:min-h-[460px]">
        {/* TOP meta row */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-slate-800/70 pb-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="badge badge-lg border-slate-600 bg-slate-900/80 text-amber-100">
              Buyer:&nbsp;<span className="font-semibold text-amber-300">{buyer}</span>
            </span>
            <span className="badge badge-lg border-fuchsia-500/70 bg-fuchsia-500/10 text-fuchsia-100">
              Style:&nbsp;<span className="font-semibold text-fuchsia-300">{style}</span>
            </span>
            <span className="badge badge-lg border-emerald-500/70 bg-emerald-500/10 text-emerald-100">
              Run Day:&nbsp;<span className="font-semibold text-emerald-300">{runDay}</span>
            </span>
            <span className="badge badge-lg border-emerald-500/70 bg-emerald-500/10 text-emerald-100">
              SMV:&nbsp;<span className="font-semibold text-emerald-300">{smv}</span>
            </span>
            <span className="badge badge-lg border-emerald-500/70 bg-emerald-500/10 text-emerald-100">
              Man Power:&nbsp;<span className="font-semibold text-emerald-300">{manpowerPresent}</span>
            </span>
            <span className="badge badge-lg border-fuchsia-300/70 bg bg-emerald-500/10 text-fuchsia-500/70">
              Color/Model:&nbsp;<span className="font-semibold text-emerald-300">{colorModel}</span>
            </span>
            <span className="badge badge-lg border-emerald-500/70 bg-emerald-500/10 text-emerald-100">
              Item:&nbsp;<span className="font-semibold text-emerald-300">{item}</span>
            </span>
          </div>

          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Line</div>
            <div className="text-3xl md:text-4xl font-semibold text-cyan-300 drop-shadow-[0_0_24px_rgba(34,211,238,0.9)]">
              {line}
            </div>
          </div>
        </div>

        {/* MAIN AREA */}
        <div className="grid flex-1 min-h-0 gap-2 md:grid-cols-2 lg:grid-cols-12">
          {/* IMAGE */}
          <div className="md:col-span-1 lg:col-span-3 flex flex-col min-h-0">
            <div className="flex-1 min-h-[150px] sm:min-h-[170px] lg:min-h-0 rounded-2xl border border-cyan-500/70 bg-slate-950/95 overflow-hidden flex flex-col">
              <div className="px-3 py-1.5 text-[10px] md:text-xs uppercase tracking-[0.14em] text-cyan-200 bg-gradient-to-r from-cyan-500/25 to-transparent border-b border-cyan-500/40 flex items-center justify-between">
                <span>STYLE IMAGE</span>
                <span className="text-[10px] text-cyan-200/70">View</span>
              </div>
              <div className="relative flex-1 bg-black/90">
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={`${line} image`}
                    className="absolute inset-0 m-auto max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-slate-500">No image attached</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* VIDEO (lighter) */}
          <div className="md:col-span-1 lg:col-span-3 flex flex-col min-h-0">
            <div className="flex-1 min-h-[150px] sm:min-h-[170px] lg:min-h-0 rounded-2xl border border-emerald-500/70 bg-slate-950/95 overflow-hidden flex flex-col">
              <div className="px-3 py-1.5 text-[10px] md:text-xs uppercase tracking-[0.14em] text-emerald-200 bg-gradient-to-r from-emerald-500/25 to-transparent border-b border-emerald-500/40 flex items-center justify-between">
                <span>LIVE VIDEO</span>
                <span className="text-[10px] text-emerald-200/70">Auto Play</span>
              </div>
              <div className="relative flex-1 bg-black/90">
                {videoSrc ? (
                  <video
                    src={videoSrc}
                    className="absolute inset-0 m-auto max-w-full max-h-full object-contain"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="none"   // ✅ less RAM + less network pressure
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-slate-500">No video attached</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* STATS + VARIANCE */}
          <div className="md:col-span-2 lg:col-span-6 flex flex-col gap-2.5 min-h-0">
            {/* PLAN vs ACHV */}
            <div className="rounded-2xl border border-sky-700 bg-gradient-to-br from-sky-900/50 via-slate-950 to-slate-900/95 p-3 md:p-3.5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="uppercase tracking-wide text-sky-200">Plan vs Achieved</span>
                <span className="badge badge-outline border-sky-500/60 bg-slate-950/80 text-[10px] text-sky-100">
                  Plan: {formatNumber(planPercent, 1)}%
                </span>
              </div>

              <div className="mt-1 flex flex-col lg:flex-row items-center gap-3">
                {/* ✅ animate off in TV */}
                <KpiPie value={planPercent} label="" color="#22d3ee" size={96} animate={false} />

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
                  <TvStatBox
                    label={`Last Day (${prevWorkingDate || "-"})`}
                    value={formatNumber(prevWorkingAchievedQty || 0, 0)}
                    accent="text-slate-200 border-slate-500/80"
                  />
                </div>
              </div>
            </div>

            {/* QUALITY + EFF + VARIANCE */}
            <div className="rounded-2xl border border-amber-600 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900/95 p-3 flex flex-col gap-2 min-h-0">
              <div className="flex items-center justify-between text-[11px]">
                <span className="uppercase tracking-wide text-amber-200">Production & Quality</span>
                <div className="flex flex-wrap gap-1">
                  <span className="badge border-emerald-500/60 bg-emerald-500/10 text-[11px] text-emerald-100">
                    Q Hour: <span className="font-semibold">{qualityHourLabel}</span>
                  </span>
                  <span className="badge border-sky-500/60 bg-sky-500/10 text-[11px] text-sky-100">
                    P Hour: <span className="font-semibold">{prodHourLabel}</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                <KpiTile label="RFT%" value={`${formatNumber(rft, 1)}%`} tone="emerald" icon={Gauge} />
                <KpiTile
                  label="DEFECT RATE%"
                  value={`${formatNumber(defectRate, 1)}%`}
                  tone="red"
                  icon={AlertTriangle}
                />
                <KpiTile label="DHU%" value={`${formatNumber(dhu, 1)}%`} tone="amber" icon={Activity} />
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

              <div className="mt-1 space-y-1 min-h-0">
                <div className="flex items-center justify-between text-[11px] text-slate-200">
                  <span className="uppercase tracking-wide text-amber-200">Hourly Variance</span>
                  {varianceLoading ? (
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                      <span className="loading loading-spinner loading-xs" />
                      Loading...
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Green = ahead, Red = behind</span>
                  )}
                </div>

                <div className="h-24 sm:h-28 md:h-32 lg:h-36 w-full">
                  <VarianceBarChart data={varianceChartData} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* end */}
      </div>
    </div>
  );
}
