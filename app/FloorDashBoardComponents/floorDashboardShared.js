// app/FloorDashBoardComponents/floorDashboardShared.js
import React from "react";
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

/* Options */
export const factoryOptions = ["K-1", "K-2", "K-3"];
export const buildingOptions = ["A-2", "B-2", "A-3", "B-3", "A-4", "B-4", "A-5", "B-5"];
export const lineOptions = [
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

/* Defaults */
export const DEFAULT_FACTORY = "K-2";
export const DEFAULT_BUILDING = "A-2";

/* Refresh knobs (TV lighter) */
export const REFRESH_INTERVAL_TV_MS = 15000; // ✅ less pressure than 10s
export const REFRESH_INTERVAL_FULL_MS = 10000;
export const HEADER_REFRESH_MS = 60000; // ✅ headers don’t need 10s refresh

/* ---------------- date helpers ---------------- */
export function todayKeyDhaka() {
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
}

/* ---------------- utils ---------------- */

export function formatNumber(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toFixed(digits);
}

export function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function norm(v) {
  return String(v || "").trim().toLowerCase();
}

export function makeSegmentKey(line, buyer, style) {
  return `${line || ""}__${buyer || ""}__${style || ""}`;
}

export function makeStyleMediaKey(factory, building, buyer, style, colorModel) {
  return `${norm(factory)}__${norm(building)}__${norm(buyer)}__${norm(style)}__${norm(
    colorModel
  )}`;
}

export function pickLatest(a, b) {
  const ta = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
  const tb = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
  return tb > ta ? b : a;
}

/* ---------------- KPI TILE DESIGN ---------------- */

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

export function KpiTile({ label, value, tone = "emerald", icon: Icon }) {
  const toneMap = KPI_TONE_MAP[tone] || KPI_TONE_MAP.emerald;

  return (
    <div
      className={`
        group relative overflow-hidden rounded-xl border ${toneMap.card}
        bg-gradient-to-br p-2 sm:p-2.5 ring-1
        transition-transform duration-200 hover:translate-y-0.5
        min-h-[36px]
      `}
    >
      <div className="pointer-events-none absolute -inset-px rounded-[0.9rem] bg-[radial-gradient(100px_50px_at_0%_0%,rgba(255,255,255,0.12),transparent)]" />
      <div className="relative flex items-center justify-between gap-2">
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
        <div className="text-right text-lg sm:text-xl font-extrabold tabular-nums tracking-tight text-white leading-none">
          {value}
        </div>
      </div>
    </div>
  );
}

/* ✅ Pie (TV: animate off by default = less CPU) */
export function KpiPie({ value, label, color, size = 40, animate = false }) {
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
        <span className="text-[8px] uppercase tracking-wide text-slate-400 text-center">
          {label}
        </span>
      ) : null}
    </div>
  );
}

export function TvStatBox({ label, value, accent = "", big = false }) {
  return (
    <div
      className={`rounded-xl border bg-slate-950/90 px-2 py-1 flex flex-col justify-center leading-tight ${
        accent || "border-slate-600 text-slate-100"
      }`}
    >
      <span className="text-[10px] uppercase tracking-wide text-slate-400 leading-none">
        {label}
      </span>
      <span className={`font-semibold leading-none ${big ? "text-[14px]" : "text-[13px]"}`}>
        {value}
      </span>
    </div>
  );
}

export function VarianceBarChart({ data }) {
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

  const maxAbsRaw = safe.reduce((max, d) => Math.max(max, Math.abs(d.varianceQty || 0)), 0);
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
        <Bar dataKey="varianceQty" radius={[3, 3, 0, 0]}>
          {safe.map((entry, idx) => (
            <Cell key={idx} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* auth defaults */
export function getDefaultFactoryBuilding(auth) {
  return {
    factory: auth?.factory || DEFAULT_FACTORY,
    building: auth?.assigned_building || auth?.building || DEFAULT_BUILDING,
  };
}

/* sort rows */
export function sortRowsByLineAndStyle(rows) {
  const getLineNumber = (lineName = "") => {
    const match = lineName.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  return [...(rows || [])].sort((a, b) => {
    const lnDiff = getLineNumber(a.line) - getLineNumber(b.line);
    if (lnDiff !== 0) return lnDiff;
    return String(a.style || "").localeCompare(String(b.style || ""));
  });
}
