// app/floor-compare/page.jsx
"use client";

import React, { Fragment, useEffect, useMemo, useState } from "react";

import {
    ResponsiveContainer,
    LineChart,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    BarChart,
    Bar,
} from "recharts";
import {
    ArrowLeftRight,
    CalendarDays,
    Factory,
    Layers,
    TrendingUp,
    ShieldCheck,
} from "lucide-react";

const factoryOptions = ["K-1", "K-2", "K-3"];
const buildingOptions = ["", "A-2", "B-2", "A-3", "B-3", "A-4", "B-4", "A-5", "B-5"];
const groupByOptions = [
    { value: "line", label: "Line-wise" },
    { value: "building", label: "Floor-wise" },
    { value: "segment", label: "Line + Buyer + Style" },
];

const LINES = Array.from({ length: 15 }).map((_, i) => `Line-${i + 1}`);

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}
function daysAgoIso(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
}
function n(v, digits = 0) {
    const x = Number(v);
    if (!Number.isFinite(x)) return "-";
    return x.toFixed(digits);
}
function pct(v, digits = 1) {
    const x = Number(v);
    if (!Number.isFinite(x)) return "-";
    return `${x.toFixed(digits)}%`;
}

function KpiCard({ icon: Icon, title, value, sub }) {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 p-3 shadow-sm">
            <div className="pointer-events-none absolute -inset-8 bg-[radial-gradient(700px_240px_at_0%_0%,rgba(56,189,248,0.16),transparent),radial-gradient(700px_240px_at_100%_0%,rgba(16,185,129,0.14),transparent)]" />
            <div className="relative flex items-start justify-between gap-3">
                <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-300/80">
                        {title}
                    </div>
                    <div className="mt-1 text-xl font-extrabold tracking-tight text-white tabular-nums">
                        {value}
                    </div>
                    {sub ? <div className="mt-1 text-[11px] text-slate-300/70">{sub}</div> : null}
                </div>
                {Icon ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-100">
                        <Icon className="h-5 w-5" />
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function buildingLabel(factory, b) {
    return `${factory} • ${b}`;
}

export default function FloorComparePage() {
    const [factory, setFactory] = useState("K-2");
    const [building, setBuilding] = useState(""); // "" => ALL floors
    const [groupBy, setGroupBy] = useState("segment");
    const [line, setLine] = useState("ALL");

    const [from, setFrom] = useState(() => daysAgoIso(6));
    const [to, setTo] = useState(() => todayIso());

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // fetch compare
    useEffect(() => {
        if (!factory || !from || !to) return;

        let cancelled = false;

        const fetchRange = async () => {
            try {
                setLoading(true);
                setError("");

                const params = new URLSearchParams({ factory, from, to, groupBy, line });
                if (building) params.append("building", building);

                const res = await fetch(`/api/floor-compare?${params.toString()}`, {
                    cache: "no-store",
                });
                const json = await res.json();

                if (!res.ok || !json?.success) {
                    throw new Error(json?.message || "Failed to load compare data");
                }

                if (!cancelled) setData(json);
            } catch (e) {
                if (!cancelled) {
                    console.error(e);
                    setError(e?.message || "Failed to load compare data");
                    setData(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchRange();
        return () => {
            cancelled = true;
        };
    }, [factory, building, from, to, groupBy, line]);

    const summaryProd = data?.summary?.production || {};
    const summaryQual = data?.summary?.quality || {};
    const series = data?.series || [];
    const rows = data?.rows || [];
    const metaBuildings = data?.meta?.buildings || [];
    const metaLines = data?.meta?.lines || LINES;

    const productionTrend = useMemo(() => {
        return series.map((d) => ({
            date: d.date,
            target: Number(d.production?.targetQty ?? 0),
            achieved: Number(d.production?.achievedQty ?? 0),
            variance: Number(d.production?.varianceQty ?? 0),
            eff: Number(d.production?.effPercent ?? 0),
        }));
    }, [series]);

    const qualityTrend = useMemo(() => {
        return series.map((d) => ({
            date: d.date,
            inspected: Number(d.quality?.totalInspected ?? 0),
            rft: Number(d.quality?.rftPercent ?? 0),
            dhu: Number(d.quality?.dhuPercent ?? 0),
            defectRate: Number(d.quality?.defectRatePercent ?? 0),
        }));
    }, [series]);

    // grouped rows for segment view:
    const rowsByBuildingLine = useMemo(() => {
        const map = {}; // building -> line -> [rows]
        for (const r of rows) {
            const b = r.building || "UNKNOWN";
            const l = r.line || "UNKNOWN";
            if (!map[b]) map[b] = {};
            if (!map[b][l]) map[b][l] = [];
            map[b][l].push(r);
        }

        // stable sort inside each line
        Object.keys(map).forEach((b) => {
            Object.keys(map[b]).forEach((l) => {
                map[b][l].sort((a, c) => {
                    const bs = String(a.buyer || "").localeCompare(String(c.buyer || ""));
                    if (bs !== 0) return bs;
                    return String(a.style || "").localeCompare(String(c.style || ""));
                });
            });
        });

        return map;
    }, [rows]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <div className="mx-auto max-w-7xl px-3 py-4">
                {/* Header */}
                <div className="mb-4 flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-900/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <ArrowLeftRight className="h-5 w-5 text-cyan-300" />
                                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
                                    Floor Compare (Date Range)
                                </h1>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-300/70">
                                Keep charts ✅ — breakdown grouped by Building → Line → Buyer/Style when needed
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                <Factory className="h-4 w-4 text-sky-300" />
                                <select
                                    value={factory}
                                    onChange={(e) => setFactory(e.target.value)}
                                    className="bg-transparent outline-none"
                                >
                                    {factoryOptions.map((f) => (
                                        <option key={f} value={f} className="bg-slate-900">
                                            {f}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                <Layers className="h-4 w-4 text-emerald-300" />
                                <select
                                    value={building}
                                    onChange={(e) => setBuilding(e.target.value)}
                                    className="bg-transparent outline-none"
                                >
                                    {buildingOptions.map((b) => (
                                        <option key={b || "ALL"} value={b} className="bg-slate-900">
                                            {b ? b : "ALL Floors"}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                <select
                                    value={groupBy}
                                    onChange={(e) => setGroupBy(e.target.value)}
                                    className="bg-transparent outline-none"
                                >
                                    {groupByOptions.map((o) => (
                                        <option key={o.value} value={o.value} className="bg-slate-900">
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                <select
                                    value={line}
                                    onChange={(e) => setLine(e.target.value)}
                                    className="bg-transparent outline-none"
                                >
                                    <option value="ALL" className="bg-slate-900">
                                        ALL Lines
                                    </option>
                                    {LINES.map((ln) => (
                                        <option key={ln} value={ln} className="bg-slate-900">
                                            {ln}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                <CalendarDays className="h-4 w-4 text-amber-300" />
                                <input
                                    type="date"
                                    value={from}
                                    onChange={(e) => setFrom(e.target.value)}
                                    className="bg-transparent outline-none"
                                />
                                <span className="text-slate-400">to</span>
                                <input
                                    type="date"
                                    value={to}
                                    onChange={(e) => setTo(e.target.value)}
                                    className="bg-transparent outline-none"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setFrom(daysAgoIso(6));
                                    setTo(todayIso());
                                }}
                                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10"
                            >
                                Last 7 days
                            </button>
                        </div>
                    </div>

                    {error ? (
                        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                            {error}
                        </div>
                    ) : null}
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <KpiCard
                        icon={TrendingUp}
                        title="Total Target"
                        value={n(summaryProd.totalTargetQty, 0)}
                        sub={`Avg/day: ${n(summaryProd.avgTargetPerDay, 0)}`}
                    />
                    <KpiCard
                        icon={TrendingUp}
                        title="Total Achieved"
                        value={n(summaryProd.totalAchievedQty, 0)}
                        sub={`Avg/day: ${n(summaryProd.avgAchievedPerDay, 0)}`}
                    />
                    <KpiCard
                        icon={TrendingUp}
                        title="Total Variance"
                        value={n(summaryProd.totalVarianceQty, 0)}
                        sub={`Days: ${summaryProd.daysCount ?? 0}`}
                    />
                    <KpiCard
                        icon={ShieldCheck}
                        title="Avg Efficiency"
                        value={pct(summaryProd.avgEffPercent, 1)}
                        sub={`Inspected: ${n(summaryQual.totalInspected, 0)}`}
                    />
                </div>

                <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <KpiCard
                        icon={ShieldCheck}
                        title="RFT%"
                        value={pct(summaryQual.rftPercent, 1)}
                        sub={`Defect Rate: ${pct(summaryQual.defectRatePercent, 1)}`}
                    />
                    <KpiCard
                        icon={ShieldCheck}
                        title="DHU%"
                        value={pct(summaryQual.dhuPercent, 1)}
                        sub={`Defective Pcs: ${n(summaryQual.totalDefectivePcs, 0)}`}
                    />
                    <KpiCard
                        icon={ShieldCheck}
                        title="Total Defects"
                        value={n(summaryQual.totalDefects, 0)}
                        sub={`Passed: ${n(summaryQual.totalPassed, 0)}`}
                    />
                </div>

                {/* Charts (KEEP) */}
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-3">
                        <div className="mb-2 text-[11px] uppercase tracking-wider text-slate-300/80">
                            Target vs Achieved (Daily)
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={productionTrend}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                    <XAxis dataKey="date" tick={{ fill: "#cbd5e1", fontSize: 10 }} />
                                    <YAxis tick={{ fill: "#cbd5e1", fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#020617",
                                            border: "1px solid #1f2937",
                                            fontSize: 11,
                                            color: "#e5e7eb",
                                        }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 10, color: "#e5e7eb" }} />
                                    <Bar dataKey="target" name="Target" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="achieved" name="Achieved" fill="#22c55e" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-3">
                        <div className="mb-2 text-[11px] uppercase tracking-wider text-slate-300/80">
                            Efficiency Trend (Daily)
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={productionTrend}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                    <XAxis dataKey="date" tick={{ fill: "#cbd5e1", fontSize: 10 }} />
                                    <YAxis tick={{ fill: "#cbd5e1", fontSize: 10 }} domain={[0, 100]} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#020617",
                                            border: "1px solid #1f2937",
                                            fontSize: 11,
                                            color: "#e5e7eb",
                                        }}
                                        formatter={(v) => pct(v, 1)}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 10, color: "#e5e7eb" }} />
                                    <Line
                                        type="monotone"
                                        dataKey="eff"
                                        name="Eff%"
                                        stroke="#eab308"
                                        strokeWidth={2.5}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-slate-900/40 p-3">
                        <div className="mb-2 text-[11px] uppercase tracking-wider text-slate-300/80">
                            Quality Trend (Daily)
                        </div>
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={qualityTrend}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                    <XAxis dataKey="date" tick={{ fill: "#cbd5e1", fontSize: 10 }} />
                                    <YAxis tick={{ fill: "#cbd5e1", fontSize: 10 }} domain={[0, 100]} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#020617",
                                            border: "1px solid #1f2937",
                                            fontSize: 11,
                                            color: "#e5e7eb",
                                        }}
                                        formatter={(v) => pct(v, 1)}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 10, color: "#e5e7eb" }} />
                                    <Line type="monotone" dataKey="rft" name="RFT%" stroke="#22c55e" dot={false} />
                                    <Line type="monotone" dataKey="dhu" name="DHU%" stroke="#f97316" dot={false} />
                                    <Line
                                        type="monotone"
                                        dataKey="defectRate"
                                        name="Defect Rate%"
                                        stroke="#ef4444"
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Range Breakdown (Grouped when Segment + ALL Floors) */}
                <div className="mt-4 rounded-3xl border border-white/10 bg-slate-900/40 p-3">
                    <div className="mb-2 text-[11px] uppercase tracking-wider text-slate-300/80">
                        Range Breakdown (Grouped) — {rows.length}
                    </div>

                    {loading ? (
                        <div className="text-[12px] text-slate-300/70">Loading...</div>
                    ) : rows.length === 0 ? (
                        <div className="text-[12px] text-slate-300/70">No data in this date range.</div>
                    ) : (
                        <div className="overflow-auto">
                            <table className="min-w-[1200px] w-full text-[11px]">
                                <thead className="sticky top-0 bg-slate-950/60 backdrop-blur">
                                    <tr className="text-left text-slate-200">
                                        <th className="px-2 py-2 w-[140px]">Building</th>
                                        <th className="px-2 py-2 w-[110px]">Line</th>
                                        <th className="px-2 py-2 w-[220px]">Buyer</th>
                                        <th className="px-2 py-2 w-[110px]">Style</th>
                                        <th className="px-2 py-2">Target</th>
                                        <th className="px-2 py-2">Achieved</th>
                                        <th className="px-2 py-2">Variance</th>
                                        <th className="px-2 py-2">Avg Eff%</th>
                                        <th className="px-2 py-2">Inspected</th>
                                        <th className="px-2 py-2">RFT%</th>
                                        <th className="px-2 py-2">DHU%</th>
                                        <th className="px-2 py-2">Defect Rate%</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-white/5">
{groupBy === "segment" ? (
  (building ? [building] : metaBuildings).map((b) => (
    <Fragment key={`build-${b}`}>
      {/* ✅ ALWAYS show building header: K-2 • A-2, then all lines under it */}
      <tr className="bg-white/5">
        <td colSpan={12} className="px-2 py-2 font-extrabold text-sky-200">
          {buildingLabel(factory, b)}
        </td>
      </tr>

      {/* Line blocks (Line-1 ... Line-15) */}
      {metaLines.map((ln) => {
        const list = (rowsByBuildingLine?.[b]?.[ln] || []).filter(Boolean);

        // if filter line = specific, skip others
        if (line !== "ALL" && ln !== line) return null;

        return (
          <Fragment key={`line-${b}-${ln}`}>
            <tr className="bg-slate-950/40">
              {/* ✅ don't repeat buildingLabel here (already in header) */}
              <td className="px-2 py-2 text-slate-300/40">—</td>
              <td className="px-2 py-2 font-bold text-emerald-200">{ln}</td>
              <td colSpan={10} className="px-2 py-2 text-slate-300/60">
                Buyer/Style segments in selected range
              </td>
            </tr>

            {list.length === 0 ? (
              <tr key={`empty-${b}-${ln}`} className="hover:bg-white/5">
                <td className="px-2 py-2">{b}</td>
                <td className="px-2 py-2">{ln}</td>
                <td className="px-2 py-2 text-slate-300/60">-</td>
                <td className="px-2 py-2 text-slate-300/60">-</td>
                <td className="px-2 py-2 tabular-nums">0</td>
                <td className="px-2 py-2 tabular-nums">0</td>
                <td className="px-2 py-2 tabular-nums">0</td>
                <td className="px-2 py-2 tabular-nums">0%</td>
                <td className="px-2 py-2 tabular-nums">0</td>
                <td className="px-2 py-2 tabular-nums">0%</td>
                <td className="px-2 py-2 tabular-nums">0%</td>
                <td className="px-2 py-2 tabular-nums">0%</td>
              </tr>
            ) : (
              list.map((r) => (
                <tr key={r.key} className="hover:bg-white/5">
                  <td className="px-2 py-2">{r.building}</td>
                  <td className="px-2 py-2">{r.line}</td>
                  <td className="px-2 py-2">
                    <span className="font-semibold text-white">{r.buyer || "-"}</span>
                  </td>
                  <td className="px-2 py-2">
                    <span className="font-semibold text-white">{r.style || "-"}</span>
                  </td>

                  <td className="px-2 py-2 tabular-nums">{n(r.production?.targetQty, 0)}</td>
                  <td className="px-2 py-2 tabular-nums">{n(r.production?.achievedQty, 0)}</td>
                  <td className="px-2 py-2 tabular-nums">{n(r.production?.varianceQty, 0)}</td>
                  <td className="px-2 py-2 tabular-nums">{pct(r.production?.avgEffPercent, 1)}</td>

                  <td className="px-2 py-2 tabular-nums">{n(r.quality?.totalInspected, 0)}</td>
                  <td className="px-2 py-2 tabular-nums">{pct(r.quality?.rftPercent, 1)}</td>
                  <td className="px-2 py-2 tabular-nums">{pct(r.quality?.dhuPercent, 1)}</td>
                  <td className="px-2 py-2 tabular-nums">{pct(r.quality?.defectRatePercent, 1)}</td>
                </tr>
              ))
            )}
          </Fragment>
        );
      })}
    </Fragment>
  ))
) : (
  // non-segment fallback
  rows.map((r) => (
    <tr key={r.key} className="hover:bg-white/5">
                                                <td className="px-2 py-2">{r.building || "-"}</td>
                                                <td className="px-2 py-2">{r.line || r.key}</td>
                                                <td className="px-2 py-2">{r.buyer || "-"}</td>
                                                <td className="px-2 py-2">{r.style || "-"}</td>

                                                <td className="px-2 py-2 tabular-nums">{n(r.production?.targetQty, 0)}</td>
                                                <td className="px-2 py-2 tabular-nums">{n(r.production?.achievedQty, 0)}</td>
                                                <td className="px-2 py-2 tabular-nums">{n(r.production?.varianceQty, 0)}</td>
                                                <td className="px-2 py-2 tabular-nums">{pct(r.production?.avgEffPercent, 1)}</td>

                                                <td className="px-2 py-2 tabular-nums">{n(r.quality?.totalInspected, 0)}</td>
                                                <td className="px-2 py-2 tabular-nums">{pct(r.quality?.rftPercent, 1)}</td>
                                                <td className="px-2 py-2 tabular-nums">{pct(r.quality?.dhuPercent, 1)}</td>
                                                <td className="px-2 py-2 tabular-nums">{pct(r.quality?.defectRatePercent, 1)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
