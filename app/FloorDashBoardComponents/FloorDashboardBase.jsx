// app/FloorDashBoardComponents/FloorDashboardBase.jsx
"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/hooks/useAuth";
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

/* ---------- OPTIONS ---------- */

const factoryOptions = ["K-1", "K-2", "K-3"];
const buildingOptions = ["A-2", "B-2", "A-3", "B-3", "A-4", "B-4", "A-5", "B-5"];
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
  "Line-12", // ✅ fixed typo (Lin-12)
  "Line-13",
  "Line-14",
  "Line-15",
];

const REFRESH_INTERVAL_MS = 10000;

function formatNumber(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toFixed(digits);
}

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ✅ normalize key parts for safer matching (case/space difference)
function norm(v) {
  return String(v || "").trim().toLowerCase();
}

// 🔹 segment key = line+buyer+style (dashboard identity)
function makeSegmentKey(line, buyer, style) {
  return `${norm(line)}__${norm(buyer)}__${norm(style)}`;
}

// 🔹 style media key = factory+building+buyer+style+colorModel
function makeStyleMediaKey(factory, building, buyer, style, colorModel) {
  return `${norm(factory)}__${norm(building)}__${norm(buyer)}__${norm(style)}__${norm(
    colorModel
  )}`;
}

// ✅ pick latest header doc if duplicates exist
function pickLatest(a, b) {
  const da = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
  const db = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
  return db >= da ? b : a;
}

/* ---------- KPI TILE DESIGN ---------- */

const KPI_TONE_MAP = {
  emerald: {
    wrap: "border-emerald-500/25 bg-emerald-900/10",
    icon: "text-emerald-300",
    value: "text-emerald-100",
    label: "text-emerald-200/80",
  },
  sky: {
    wrap: "border-sky-500/25 bg-sky-900/10",
    icon: "text-sky-300",
    value: "text-sky-100",
    label: "text-sky-200/80",
  },
  amber: {
    wrap: "border-amber-500/25 bg-amber-900/10",
    icon: "text-amber-300",
    value: "text-amber-100",
    label: "text-amber-200/80",
  },
  rose: {
    wrap: "border-rose-500/25 bg-rose-900/10",
    icon: "text-rose-300",
    value: "text-rose-100",
    label: "text-rose-200/80",
  },
  violet: {
    wrap: "border-violet-500/25 bg-violet-900/10",
    icon: "text-violet-300",
    value: "text-violet-100",
    label: "text-violet-200/80",
  },
};

function KpiTile({ icon: Icon, label, value, suffix = "", tone = "sky" }) {
  const t = KPI_TONE_MAP[tone] || KPI_TONE_MAP.sky;
  return (
    <div
      className={`rounded-2xl border ${t.wrap} px-3 py-2 flex items-center gap-2.5 shadow-[0_10px_24px_rgba(0,0,0,0.35)]`}
    >
      <div className={`p-2 rounded-xl bg-slate-950/40 border border-slate-700/50`}>
        <Icon className={`w-4 h-4 ${t.icon}`} />
      </div>
      <div className="min-w-0">
        <div className={`text-[10px] uppercase tracking-wide ${t.label}`}>
          {label}
        </div>
        <div className={`text-lg font-extrabold leading-5 ${t.value}`}>
          {value}
          {suffix ? <span className="text-xs font-bold ml-1">{suffix}</span> : null}
        </div>
      </div>
    </div>
  );
}

export default function FloorDashboardBase({
  forcedView = "grid",
  refreshMs = REFRESH_INTERVAL_MS,
}) {
  const router = useRouter();
  const { auth } = useAuth();

  const [factory, setFactory] = useState("K-2");
  const [building, setBuilding] = useState("A-2");
  const [date, setDate] = useState(() => {
    // default today in Asia/Dhaka style (en-CA = YYYY-MM-DD)
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    return `${y}-${m}-${d}`;
  });
  const [line, setLine] = useState("ALL");

  const [rows, setRows] = useState([]); // segments from /api/floor-dashboard
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ headerMap: ALL info must come from production header (TargetSetterHeader)
  const [headerMap, setHeaderMap] = useState({}); // segKey -> header doc

  // ✅ styleMediaMap: ONLY image/video (style-wise) from /api/style-media (date-wise)
  const [styleMediaMap, setStyleMediaMap] = useState({}); // styleMediaKey -> doc

  // ✅ wip per segment (uses header/row buyer/style)
  const [wipMap, setWipMap] = useState({}); // segKey -> wip data

  const [refreshTick, setRefreshTick] = useState(0);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [touched, setTouched] = useState(false);

  const viewMode = forcedView;

  // ✅ default factory/floor from auth (fallback K-2/A-2 if auth null)
  useEffect(() => {
    if (touched) return;

    const f =
      auth?.factory ||
      auth?.assigned_factory ||
      auth?.assignedFactory ||
      auth?.user?.factory ||
      auth?.user?.assigned_factory ||
      auth?.user?.assignedFactory ||
      "";

    const b =
      auth?.assigned_building ||
      auth?.building ||
      auth?.assignedBuilding ||
      auth?.user?.assigned_building ||
      auth?.user?.building ||
      auth?.user?.assignedBuilding ||
      "";

    if (f) setFactory(f);
    if (b) setBuilding(b);
  }, [auth, touched]);

  // multi-style support: sort by line no + style
  const sortedRows = useMemo(() => {
    if (!rows || rows.length === 0) return [];

    return [...rows].sort((a, b) => {
      const aNo = Number(String(a.line || "").replace(/[^\d]/g, "")) || 0;
      const bNo = Number(String(b.line || "").replace(/[^\d]/g, "")) || 0;
      const lnDiff = aNo - bNo;
      if (lnDiff !== 0) return lnDiff;
      return String(a.style || "").localeCompare(String(b.style || ""));
    });
  }, [rows]);

  // global polling (TV-safe: pauses when tab hidden)
  useEffect(() => {
    let id = null;

    const tick = () => setRefreshTick((p) => p + 1);

    const start = () => {
      if (id) return;
      id = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "hidden")
          return;
        tick();
      }, refreshMs);
    };

    start();

    const handleFocus = tick;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (id) clearInterval(id);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshMs]);

  // 1) Main dashboard segments
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
          assigned_building: building,
          date,
        });
        if (line && line !== "ALL") params.append("line", line);

        const res = await fetch(`/api/floor-dashboard?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          setRows([]);
          setError(json?.message || "Failed to load dashboard");
          return;
        }

        setRows(json.data || []);
      } catch (err) {
        if (err?.name === "AbortError") return;
        setRows([]);
        setError("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
    return () => controller.abort();
  }, [factory, building, date, line, refreshTick]);

  // 2) Load headers (TargetSetterHeader) for selected day
  useEffect(() => {
    if (!factory || !building || !date) {
      setHeaderMap({});
      return;
    }

    // 🔋 reduce network pressure (headers change rarely)
    const headerEvery = viewMode === "tv" ? 6 : 6; // ~60s if refreshMs=10s
    if (!(refreshTick === 0 || refreshTick % headerEvery === 0)) return;

    let cancelled = false;

    const fetchHeaders = async () => {
      try {
        const params = new URLSearchParams({
          factory,
          assigned_building: building,
          date,
        });
        if (line && line !== "ALL") params.append("line", line);

        const res = await fetch(
          `/api/target-setter-header?${params.toString()}`,
          { cache: "no-store" }
        );

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
        if (!cancelled) setHeaderMap({});
      }
    };

    fetchHeaders();
    return () => {
      cancelled = true;
    };
  }, [factory, building, date, line, refreshTick, viewMode]);

  // ✅ 3) Load Style Media (style-wise image/video) for selected date
  useEffect(() => {
    if (!factory || !building || !date) {
      setStyleMediaMap({});
      return;
    }

    // 🔋 reduce media polling (videos/images change rarely)
    const mediaEvery = viewMode === "tv" ? 12 : 12; // ~120s
    if (!(refreshTick === 0 || refreshTick % mediaEvery === 0)) return;

    let cancelled = false;

    const fetchStyleMedia = async () => {
      try {
        const params = new URLSearchParams({
          factory,
          assigned_building: building,
          date, // ✅ date-wise match
        });

        const res = await fetch(`/api/style-media?${params.toString()}`, {
          cache: "no-store",
        });
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
      } catch (err) {
        if (!cancelled) setStyleMediaMap({});
      }
    };

    fetchStyleMedia();
    return () => {
      cancelled = true;
    };
  }, [factory, building, date, refreshTick, viewMode]);

  // 4) Load WIP (TV-safe)
  //    - TV view: fetch ONLY the current card's WIP (cached; refreshes occasionally)
  //    - Full view: fetch all segments, but much less frequently
  useEffect(() => {
    if (!factory || !building || !date) {
      setWipMap({});
      return;
    }

    // TV: 1 request per card (cached) + periodic refresh
    if (viewMode === "tv") {
      const list = sortedRows.length ? sortedRows : rows;
      if (!list || list.length === 0) {
        setWipMap({});
        return;
      }

      const idx = list.length > 0 ? currentCardIndex % list.length : 0;
      const row = list[idx];
      if (!row) {
        setWipMap({});
        return;
      }

      const segKey = makeSegmentKey(row.line, row.buyer, row.style);
      const header = headerMap[segKey];

      const buyer = header?.buyer || row.buyer || "";
      const style = header?.style || row.style || "";

      if (!row.line || !buyer || !style) return;

      // refresh rule:
      // - always fetch if not cached yet for this segKey
      // - otherwise refresh every ~30s (refreshTick % 3)
      const shouldRefresh =
        !wipMap[segKey] || refreshTick === 0 || refreshTick % 3 === 0;

      if (!shouldRefresh) return;

      const controller = new AbortController();
      let cancelled = false;

      (async () => {
        const params = new URLSearchParams({
          factory,
          assigned_building: building,
          line: row.line,
          buyer,
          style,
          date,
        });

        try {
          const res = await fetch(`/api/style-wip?${params.toString()}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          const json = await res.json();
          if (!cancelled && res.ok && json.success) {
            setWipMap((prev) => ({ ...prev, [segKey]: json.data }));
          }
        } catch (_) {
          // ignore abort/errors (TV stability)
        }
      })();

      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    // FULL view: WIP for all lines is expensive — poll it slower (~90s)
    const shouldFetchAll = refreshTick === 0 || refreshTick % 9 === 0;
    if (!shouldFetchAll) return;

    if (!rows || rows.length === 0) {
      setWipMap({});
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      const newMap = {};

      for (const row of rows) {
        const segKey = makeSegmentKey(row.line, row.buyer, row.style);
        const header = headerMap[segKey];

        const buyer = header?.buyer || row.buyer || "";
        const style = header?.style || row.style || "";

        if (!row.line || !buyer || !style) continue;

        const params = new URLSearchParams({
          factory,
          assigned_building: building,
          line: row.line,
          buyer,
          style,
          date,
        });

        try {
          const res = await fetch(`/api/style-wip?${params.toString()}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          const json = await res.json();
          if (res.ok && json.success && !cancelled) newMap[segKey] = json.data;
        } catch (_) {
          // ignore per-line errors
        }

        if (cancelled) break;
      }

      if (!cancelled) setWipMap(newMap);
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    factory,
    building,
    date,
    rows,
    sortedRows,
    currentCardIndex,
    headerMap,
    refreshTick,
    viewMode,
  ]);

  // 5) TV MODE: auto-slide
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

  const hasData = sortedRows.length > 0;
  const safeIndex =
    sortedRows.length > 0 ? currentCardIndex % sortedRows.length : 0;
  const currentRow = sortedRows[safeIndex];

  // ✅ allow vertical scroll inside content
  const contentWrapperClass =
    viewMode === "tv"
      ? "flex-1 min-h-0 overflow-hidden"
      : "flex-1 min-h-0 overflow-y-auto pr-1";

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
                  onChange={(e) => {
                    setFactory(e.target.value);
                    setTouched(true);
                  }}
                >
                  <option value="">Select factory</option>
                  {factoryOptions.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* Floor */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase text-amber-100">
                  Floor
                </label>
                <select
                  className="select select-xs bg-amber-300/95 select-bordered min-w-[120px] text-slate-900"
                  value={building}
                  onChange={(e) => {
                    setBuilding(e.target.value);
                    setTouched(true);
                  }}
                >
                  <option value="">Select floor</option>
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
                  className="input input-xs bg-amber-300/95 input-bordered min-w-[150px] text-slate-900"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setTouched(true);
                  }}
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
                  onChange={(e) => {
                    setLine(e.target.value);
                    setTouched(true);
                  }}
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
                  className="select select-xs bg-amber-300/95 select-bordered min-w-[140px] text-slate-900"
                  value={viewMode}
                  onChange={(e) => {
                    const next = e.target.value;
                    router.push(
                      next === "tv"
                        ? "/floor-dashboard/tv"
                        : "/floor-dashboard/full"
                    );
                  }}
                >
                  <option value="grid">Full View (All Line&apos;s)</option>
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

            {error ? (
              <div className="text-[11px] text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <div className={contentWrapperClass}>
          {/* EMPTY */}
          {!hasData && !loading && (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              No data found for selected filters.
            </div>
          )}

          {/* GRID VIEW */}
          {hasData && viewMode === "grid" && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 pb-2">
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

          {/* TV VIEW */}
          {hasData && viewMode === "tv" && currentRow && (
            <div className="flex-1 min-h-0 flex flex-col space-y-2">
              <div className="flex-1 min-h-0">
                {(() => {
                  const segKey = makeSegmentKey(
                    currentRow.line,
                    currentRow.buyer,
                    currentRow.style
                  );
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
                      styleMedia={styleMediaMap[mediaKey]} // ✅ style-wise media
                      wipData={wipMap[segKey]}
                      factory={factory}
                      building={building}
                      date={date}
                      refreshTick={refreshTick} // ✅ realtime variance refresh
                      isTv={true}
                    />
                  );
                })()}
              </div>

              <div className="flex flex-col items-center justify-center text-[10px] text-slate-400 pb-1">
                Auto sliding every 10 seconds (TV Mode)
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------ GRID CARD ------------ */

function LineCard({ lineData, header, styleMedia, wipData }) {
  const { line, quality, production } = lineData || {};

  // ✅ take info from header (not style-media)
  const buyer = header?.buyer || lineData?.buyer || "-";
  const style = header?.style || lineData?.style || "-";
  const runDay = header?.run_day ?? header?.runDay ?? "-";
  const smv = header?.smv ?? "-";

  // ✅ FIX: you had bitwise OR (|). This must be || to work correctly.
  const item = header?.Item || lineData?.Item || "-";

  const colorModel =
    header?.color_model || header?.colorModel || header?.color || "-";

  // ✅ ONLY image/video from style-media (style-wise)
  const imgSrc =
    styleMedia?.imageSrc || styleMedia?.image || styleMedia?.img || "";
  const videoSrc =
    styleMedia?.videoSrc || styleMedia?.video || styleMedia?.vid || "";

  const targetQty = production?.targetQty ?? 0;
  const achievedQty = production?.achievedQty ?? 0;
  const rawPlan = targetQty > 0 ? (achievedQty / targetQty) * 100 : 0;
  const planPercent = clampPercent(rawPlan);
  const varianceQty = production?.varianceQty ?? 0;

  // ✅ NEW (no design change): previous working day achieved
  const prevWorkingDate = production?.prevWorkingDate || null;
  const prevWorkingAchievedQty = production?.prevWorkingAchievedQty ?? 0;

  const rft = clampPercent(quality?.rftPercent ?? 0);
  const dhu = clampPercent(quality?.dhuPercent ?? 0);
  const defectRate = clampPercent(quality?.defectRatePercent ?? 0);

  const hEff = clampPercent(production?.hourlyEfficiency ?? 0);
  const avgEff = clampPercent(production?.avgEfficiency ?? production?.totalEfficiency ?? 0);

  const wipToday = toNumber(wipData?.todayWip || wipData?.today || wipData?.wipToday || 0, 0);
  const wipTotal = toNumber(wipData?.totalWip || wipData?.total || wipData?.wipTotal || 0, 0);

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-950/70 via-slate-950 to-slate-900/80 shadow-[0_10px_30px_rgba(0,0,0,0.55)] overflow-hidden">
      <div className="p-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12px] font-extrabold tracking-tight text-slate-100">
            {line || "-"}
          </div>
          <div className="text-[11px] text-slate-300 truncate">
            {buyer} • {style} • {colorModel}
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            Item: <span className="text-slate-200 font-semibold">{item}</span> • Run Day:{" "}
            <span className="text-slate-200 font-semibold">{runDay}</span> • SMV:{" "}
            <span className="text-slate-200 font-semibold">{smv}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span
            className={`badge badge-outline text-[10px] ${
              varianceQty >= 0
                ? "border-emerald-500/50 text-emerald-200"
                : "border-rose-500/50 text-rose-200"
            }`}
          >
            Var {formatNumber(varianceQty, 0)}
          </span>
        </div>
      </div>

      <div className="px-3 pb-3 grid grid-cols-12 gap-2">
        {/* Media */}
        <div className="col-span-5 rounded-xl border border-slate-800/60 bg-slate-950/40 overflow-hidden">
          {videoSrc ? (
            <div className="aspect-[4/5] w-full">
              <video
                src={videoSrc}
                className="w-full h-full object-cover"
                style={{ maxHeight: "100%", maxWidth: "100%" }}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
            </div>
          ) : imgSrc ? (
            <div className="aspect-[4/5] w-full">
              <img
                src={imgSrc}
                alt="style"
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
          ) : (
            <div className="aspect-[4/5] w-full flex items-center justify-center text-[10px] text-slate-500">
              No media
            </div>
          )}
        </div>

        {/* Numbers */}
        <div className="col-span-7 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <KpiTile
              icon={TrendingUp}
              label="Plan"
              value={formatNumber(planPercent, 0)}
              suffix="%"
              tone={planPercent >= 90 ? "emerald" : planPercent >= 70 ? "amber" : "rose"}
            />
            <KpiTile
              icon={Gauge}
              label="Eff (Hr/Avg)"
              value={`${formatNumber(hEff, 0)}/${formatNumber(avgEff, 0)}`}
              suffix="%"
              tone={avgEff >= 70 ? "emerald" : avgEff >= 55 ? "amber" : "rose"}
            />
            <KpiTile
              icon={Activity}
              label="RFT"
              value={formatNumber(rft, 0)}
              suffix="%"
              tone={rft >= 90 ? "emerald" : rft >= 80 ? "amber" : "rose"}
            />
            <KpiTile
              icon={AlertTriangle}
              label="DHU"
              value={formatNumber(dhu, 0)}
              suffix="%"
              tone={dhu <= 5 ? "emerald" : dhu <= 8 ? "amber" : "rose"}
            />
          </div>

          <div className="rounded-xl border border-slate-800/60 bg-slate-950/35 p-2 text-[11px] flex items-center justify-between">
            <div className="text-slate-200 font-semibold">
              Target:{" "}
              <span className="font-semibold">{formatNumber(targetQty, 0)}</span>
            </div>

            <div className="text-slate-200">
              Achv:{" "}
              <span className="font-semibold">{formatNumber(achievedQty, 0)}</span>
            </div>

            {/* ✅ NEW line (same box, same style) */}
            <div className="text-slate-200">
              Last Day ({prevWorkingDate || "-"}):{" "}
              <span className="font-semibold">
                {formatNumber(prevWorkingAchievedQty, 0)}
              </span>
            </div>

            <div className="text-slate-400">
              Defect:{" "}
              <span className="text-slate-200 font-semibold">
                {formatNumber(defectRate, 0)}%
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/60 bg-slate-950/35 p-2 text-[11px] flex items-center justify-between">
            <div className="text-slate-200">
              WIP Today:{" "}
              <span className="text-slate-100 font-semibold">
                {formatNumber(wipToday, 0)}
              </span>
            </div>
            <div className="text-slate-200">
              WIP Total:{" "}
              <span className="text-slate-100 font-semibold">
                {formatNumber(wipTotal, 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------ TV CARD ------------ */

function TvLineCard({
  lineData,
  header,
  styleMedia,
  wipData,
  factory,
  building,
  date,
  refreshTick,
  isTv = false,
}) {
  const [varianceChartData, setVarianceChartData] = useState([]);
  const [varianceLoading, setVarianceLoading] = useState(false);

  const { line, quality, production } = lineData || {};

  // header-driven info
  const buyer = header?.buyer || lineData?.buyer || "-";
  const style = header?.style || lineData?.style || "-";
  const runDay = header?.run_day ?? header?.runDay ?? "-";
  const smv = header?.smv ?? "-";
  const item = header?.Item || lineData?.Item || "-";
  const colorModel =
    header?.color_model || header?.colorModel || header?.color || "-";

  // style media only
  const imgSrc =
    styleMedia?.imageSrc || styleMedia?.image || styleMedia?.img || "";
  const videoSrc =
    styleMedia?.videoSrc || styleMedia?.video || styleMedia?.vid || "";

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

  const hEff = clampPercent(production?.hourlyEfficiency ?? 0);
  const avgEff = clampPercent(
    production?.avgEfficiency ?? production?.totalEfficiency ?? 0
  );

  const wipToday = toNumber(
    wipData?.todayWip || wipData?.today || wipData?.wipToday || 0,
    0
  );
  const wipTotal = toNumber(
    wipData?.totalWip || wipData?.total || wipData?.wipTotal || 0,
    0
  );

  const headerId =
    header?._id?.$oid || header?._id || header?.id || header?.headerId || "";

  const getVarianceQty = (rec) => {
    const v =
      rec?.varianceQty ??
      rec?.variance ??
      rec?.variance_count ??
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

  // variance chart (hourly variance) — TV-safe polling
  useEffect(() => {
    if (!factory || !building || !line || !date) {
      setVarianceChartData([]);
      return;
    }

    // 🔋 TV: variance chart is heavy, poll slower
    if (isTv && !(refreshTick === 0 || refreshTick % 3 === 0)) return;

    const controller = new AbortController();

    const fetchVariance = async () => {
      try {
        setVarianceLoading(true);

        const params = new URLSearchParams();
        if (headerId) {
          params.set("headerId", headerId);
        } else {
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
            const hour = rec?.hour ?? rec?.hourIndex ?? rec?.h ?? null;
            const hourLabel =
              rec?.hourLabel ||
              (Number.isFinite(Number(hour)) ? `${ordinal(hour)} Hour` : "-");

            return {
              hour: toNumber(hour, null),
              hourLabel,
              varianceQty: Math.round(getVarianceQty(rec)),
            };
          })
          .filter((d) => d.hour != null)
          .sort((a, b) => a.hour - b.hour);

        setVarianceChartData(normalized);
      } catch (err) {
        if (err?.name === "AbortError") return;
        setVarianceChartData([]);
      } finally {
        setVarianceLoading(false);
      }
    };

    fetchVariance();
    return () => controller.abort();
  }, [factory, building, line, date, headerId, refreshTick, isTv]);

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-950/70 via-slate-950 to-slate-900/80 shadow-[0_10px_30px_rgba(0,0,0,0.55)] overflow-hidden flex-1 min-h-0">
        <div className="p-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[14px] md:text-[16px] font-extrabold tracking-tight text-slate-100">
              {line || "-"}
            </div>
            <div className="text-[12px] text-slate-300 truncate">
              {buyer} • {style} • {colorModel}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              Item: <span className="text-slate-200 font-semibold">{item}</span> • Run Day:{" "}
              <span className="text-slate-200 font-semibold">{runDay}</span> • SMV:{" "}
              <span className="text-slate-200 font-semibold">{smv}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`badge badge-outline text-[10px] ${
                varianceQty >= 0
                  ? "border-emerald-500/50 text-emerald-200"
                  : "border-rose-500/50 text-rose-200"
              }`}
            >
              Var {formatNumber(varianceQty, 0)}
            </span>

            <div className="flex items-center gap-2">
              <KpiPie
                value={planPercent}
                animate={!isTv}
                label=""
                color={planPercent >= 90 ? "#22c55e" : planPercent >= 70 ? "#f59e0b" : "#ef4444"}
                size={46}
              />
            </div>
          </div>
        </div>

        <div className="px-3 pb-3 grid grid-cols-12 gap-3 min-h-0">
          {/* Media */}
          <div className="col-span-5 rounded-2xl border border-slate-800/60 bg-slate-950/40 overflow-hidden min-h-0">
            {videoSrc ? (
              <div className="h-full w-full flex items-center justify-center overflow-hidden">
                <video
                  key={videoSrc}
                  src={videoSrc}
                  className="w-full h-full object-cover"
                  style={{ maxHeight: "100%", maxWidth: "100%" }}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
              </div>
            ) : imgSrc ? (
              <img
                src={imgSrc}
                alt="style"
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-[11px] text-slate-500">
                No media
              </div>
            )}
          </div>

          {/* STATS + VARIANCE */}
          <div className="col-span-7 flex flex-col gap-2.5 min-h-0">
            {/* PLAN vs ACHV */}
            <div className="rounded-2xl border border-sky-700 bg-gradient-to-br from-sky-900/50 via-slate-950 to-slate-900/95 p-3 md:p-3.5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="uppercase tracking-wide text-sky-200">
                  Plan vs Achieved
                </span>
                <span className="badge badge-outline border-sky-500/60 bg-slate-950/80 text-[10px] text-sky-100">
                  Plan: {formatNumber(planPercent, 1)}%
                </span>
              </div>

              <div className="flex items-end justify-between">
                <div className="text-slate-200 font-semibold">
                  Target:{" "}
                  <span className="font-semibold">{formatNumber(targetQty, 0)}</span>
                </div>

                <div className="text-slate-200">
                  Achv:{" "}
                  <span className="font-semibold">{formatNumber(achievedQty, 0)}</span>
                </div>

                <div className="text-slate-200">
                  Last Day ({prevWorkingDate || "-"}):{" "}
                  <span className="font-semibold">
                    {formatNumber(prevWorkingAchievedQty, 0)}
                  </span>
                </div>

                <div
                  className={varianceQty >= 0 ? "text-emerald-400" : "text-rose-400"}
                >
                  Var:{" "}
                  <span className="font-semibold">{formatNumber(varianceQty, 0)}</span>
                </div>
              </div>
            </div>

            {/* KPI GRID */}
            <div className="grid grid-cols-2 gap-2">
              <KpiTile
                icon={Gauge}
                label="Eff (Hr/Avg)"
                value={`${formatNumber(hEff, 0)}/${formatNumber(avgEff, 0)}`}
                suffix="%"
                tone={avgEff >= 70 ? "emerald" : avgEff >= 55 ? "amber" : "rose"}
              />
              <KpiTile
                icon={Activity}
                label="RFT"
                value={formatNumber(rft, 0)}
                suffix="%"
                tone={rft >= 90 ? "emerald" : rft >= 80 ? "amber" : "rose"}
              />
              <KpiTile
                icon={AlertTriangle}
                label="DHU"
                value={formatNumber(dhu, 0)}
                suffix="%"
                tone={dhu <= 5 ? "emerald" : dhu <= 8 ? "amber" : "rose"}
              />
              <KpiTile
                icon={TrendingUp}
                label="Defect"
                value={formatNumber(defectRate, 0)}
                suffix="%"
                tone={defectRate <= 5 ? "emerald" : defectRate <= 8 ? "amber" : "rose"}
              />
            </div>

            {/* WIP */}
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/35 p-3 text-[12px] flex items-center justify-between">
              <div className="text-slate-200">
                WIP Today:{" "}
                <span className="text-slate-100 font-semibold">
                  {formatNumber(wipToday, 0)}
                </span>
              </div>
              <div className="text-slate-200">
                WIP Total:{" "}
                <span className="text-slate-100 font-semibold">
                  {formatNumber(wipTotal, 0)}
                </span>
              </div>
            </div>

            {/* VARIANCE CHART */}
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/35 p-3 flex-1 min-h-[140px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-wide text-slate-300">
                  Hourly Variance (Qty)
                </span>
                {varianceLoading ? (
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <span className="loading loading-spinner loading-xs" />
                    Loading...
                  </span>
                ) : null}
              </div>

              <div className="h-[140px]">
                <VarianceBarChart data={varianceChartData} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------ PIE KPI ------------ */

function KpiPie({ value, label, color, size = 40, animate = true }) {
  const pct = clampPercent(value);
  const display = formatNumber(pct, 0);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative" style={{ width: size, height: size }}>
        <PieChart
          data={[
            { title: "value", value: pct, color },
            { title: "rest", value: 100 - pct, color: "#020617" },
          ]}
          startAngle={-90}
          lineWidth={12}
          rounded
          background="#020617"
          animate={animate}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] md:text-[13px] font-semibold text-slate-100">
            {display}%
          </span>
        </div>
      </div>
      {label ? (
        <div className="text-[9px] uppercase tracking-wide text-slate-400">
          {label}
        </div>
      ) : null}
    </div>
  );
}

/* ------------ VARIANCE CHART ------------ */

function VarianceBarChart({ data }) {
  const safe = (data || [])
    .map((d) => {
      const v = Math.round(toNumber(d.varianceQty, 0));
      const hour = toNumber(d.hour, null);
      return {
        hour: Number.isFinite(hour) ? hour : null,
        hourLabel: d.hourLabel || (Number.isFinite(hour) ? `H${hour}` : "-"),
        varianceQty: v,
        fill: v >= 0 ? "#22c55e" : "#ef4444",
      };
    })
    .filter((d) => d.hour != null)
    .sort((a, b) => a.hour - b.hour);

  if (safe.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[11px] text-slate-500">
        No hourly records yet
      </div>
    );
  }

  const maxAbsRaw = safe.reduce(
    (max, d) => Math.max(max, Math.abs(d.varianceQty || 0)),
    0
  );
  const maxAbs = Math.max(5, maxAbsRaw || 0);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={safe} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
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
          allowDecimals={false}
          tickFormatter={(v) => String(Math.round(toNumber(v, 0)))}
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
          formatter={(value) => [String(Math.round(toNumber(value, 0))), "Variance"]}
        />
        <Bar dataKey="varianceQty" radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {safe.map((entry, idx) => (
            <Cell key={idx} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
