// app/floor-summary/page.jsx
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
  LabelList,
} from "recharts";

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

// 🔹 Serial order for line labels
const lineOrder = [
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

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

const labelColor = "#000000";
const topLabelColor = "#e5e7eb";

const MIN_BAR_HEIGHT_FOR_LABEL = 14; // below this, no inside label
const MIN_BAR_WIDTH_FOR_TOP_LABEL = 14; // below this, no top label

function calcTopFontSize(width, height) {
  // scale with bar size (graph size)
  const w = Number(width) || 0;
  const h = Number(height) || 0;

  // prefer width-based scaling; add small influence from height
  const size = w * 0.28 + h * 0.02;
  return clamp(size, 10, 18);
}

// 🔹 Vertical qty label (inside bar, centered by bar height)
const renderQtyLabelVertical = (props) => {
  const { x, y, width, height, value } = props;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;

  if (!height || height < MIN_BAR_HEIGHT_FOR_LABEL) return null;

  const cx = x + width / 2;
  const cy = y + height / 2;

  return (
    <text
      x={cx}
      y={cy}
      fill={labelColor}
      textAnchor="middle"
      fontSize={10}
      transform={`rotate(-90, ${cx}, ${cy})`}
    >
      {formatNumber(num, 0)}
    </text>
  );
};

// ✅ Top % label (above bar) — font size scales with graph/bar size
const renderPercentLabelTop = (props) => {
  const { x, y, width, height, value } = props;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;

  if (!width || width < MIN_BAR_WIDTH_FOR_TOP_LABEL) return null;

  const cx = x + width / 2;

  // put slightly above bar; keep inside chart area
  const fs = calcTopFontSize(width, height);
  const yy = Math.max(fs + 2, (Number(y) || 0) - 6);

  return (
    <text
      x={cx}
      y={yy}
      fill={topLabelColor}
      textAnchor="middle"
      fontSize={fs}
      fontWeight={800}
      style={{ filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.65))" }}
    >
      {formatNumber(num, 1)}%
    </text>
  );
};

// ✅ Crown label (shows only on the "best" label in achieved bar)
function makeCrownLabel(bestLabel) {
  return function renderCrownLabel(props) {
    const { x, y, width, height, value } = props; // value will be item.label
    if (!bestLabel) return null;
    if (!value || String(value) !== String(bestLabel)) return null;

    if (!height || height < 6) return null;

    const cx = x + width / 2;
    // move crown higher so it doesn't clash with top % label
    const cy = Math.max(20, (Number(y) || 0) - 26);

    return (
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        fontSize={24}
        fill="#fbbf24"
        style={{ filter: "drop-shadow(0px 3px 6px rgba(0,0,0,0.75))" }}
      >
        👑
      </text>
    );
  };
}

// 🔹 helper: get serial order index for label
function getLabelOrderIndex(label, isAllBuildings) {
  if (isAllBuildings) {
    const idx = buildingOptions.indexOf(label);
    return idx === -1 ? 999 : idx;
  }

  const idxLine = lineOrder.indexOf(label);
  if (idxLine !== -1) return idxLine;

  // fallback: try numeric part (e.g. "Line-7")
  const num = parseInt(String(label).replace(/[^\d]/g, ""), 10);
  if (Number.isFinite(num)) return num;
  return 999;
}

// fallback (only if API doesn't return best selection)
function getBestLabelFromQtyData(qtyData) {
  let best = "";
  let bestScore = -Infinity;

  for (const d of qtyData || []) {
    const target = Number(d?.target ?? 0);
    const achieved = Number(d?.achieved ?? 0);
    const plan = target > 0 ? achieved / target : 0;

    // plan% dominates, achieved breaks ties
    const score = plan * 1_000_000 + achieved;

    if (score > bestScore) {
      bestScore = score;
      best = d?.label || "";
    }
  }
  return best;
}

function MetricBox({ label, value, accent = "" }) {
  return (
    <div
      className={`rounded-xl border bg-slate-950/80 px-2 py-1.5 flex flex-col gap-0.5 ${accent}`}
    >
      <span className="text-[9px] uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className="text-[12px] font-semibold">{value}</span>
    </div>
  );
}

function BestSelectionTable({ title, rows, labelHeader = "Line" }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-wide text-amber-200">
          {title}
        </div>
        <div className="text-[10px] text-slate-400">
          Based on: Hit%, Eff%, Absenteeism%, Rejection% (Marks + Place)
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-800">
        <table className="table table-xs w-full text-[11px]">
          <thead className="bg-slate-950/60">
            <tr className="text-slate-200">
              <th className="whitespace-nowrap">{labelHeader}</th>

              <th className="whitespace-nowrap text-right">Hit %</th>
              <th className="whitespace-nowrap text-right">Marks</th>

              <th className="whitespace-nowrap text-right">Eff %</th>
              <th className="whitespace-nowrap text-right">Marks</th>

              <th className="whitespace-nowrap text-right">Abs %</th>
              <th className="whitespace-nowrap text-right">Marks</th>

              <th className="whitespace-nowrap text-right">Rej %</th>
              <th className="whitespace-nowrap text-right">Marks</th>

              <th className="whitespace-nowrap text-right">Total</th>
              <th className="whitespace-nowrap text-right">Place</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              const label =
                r.line ?? r.building ?? r.label ?? r.name ?? "—";
              const isBest = Number(r.place) === 1;

              return (
                <tr
                  key={String(label)}
                  className={
                    isBest
                      ? "bg-amber-500/10 text-amber-100"
                      : "text-slate-200"
                  }
                >
                  <td className="whitespace-nowrap font-semibold">
                    {label} {isBest ? "👑" : ""}
                  </td>

                  <td className="text-right">
                    {formatNumber(r.amountHitRatePercent ?? 0, 2)}%
                  </td>
                  <td className="text-right font-semibold">
                    {formatNumber(r.amountMarks ?? 0, 0)}
                  </td>

                  <td className="text-right">
                    {formatNumber(r.efficiencyHitRatePercent ?? 0, 2)}%
                  </td>
                  <td className="text-right font-semibold">
                    {formatNumber(r.efficiencyMarks ?? 0, 0)}
                  </td>

                  <td className="text-right">
                    {formatNumber(r.absenteeismPercent ?? 0, 2)}%
                  </td>
                  <td className="text-right font-semibold">
                    {formatNumber(r.absenteeismMarks ?? 0, 0)}
                  </td>

                  <td className="text-right">
                    {formatNumber(r.rejectionPercent ?? 0, 2)}%
                  </td>
                  <td className="text-right font-semibold">
                    {formatNumber(r.rejectionMarks ?? 0, 0)}
                  </td>

                  <td className="text-right font-extrabold text-emerald-200">
                    {formatNumber(r.totalMarks ?? 0, 0)}
                  </td>
                  <td className="text-right font-extrabold">
                    {formatNumber(r.place ?? 0, 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function FloorSummaryPage() {
  const [factory, setFactory] = useState("K-2");
  const [building, setBuilding] = useState("A-2"); // "" => All
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [summary, setSummary] = useState(null);
  const [lines, setLines] = useState([]);
  const [buildingsData, setBuildingsData] = useState([]);

  // ✅ NEW (from API)
  const [bestLineSelection, setBestLineSelection] = useState(null);
  const [bestBuildingSelection, setBestBuildingSelection] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!factory || !date) {
      setSummary(null);
      setLines([]);
      setBuildingsData([]);
      setBestLineSelection(null);
      setBestBuildingSelection(null);
      return;
    }

    let cancelled = false;

    const fetchSummary = async () => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams({ factory, date });
        if (building) params.append("building", building);

        const res = await fetch(`/api/floor-summary?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to load summary");
        }

        if (!cancelled) {
          setSummary(json.summary || null);
          setLines(json.lines || []);
          setBuildingsData(json.buildings || []);

          // ✅ NEW: best selection table data
          setBestLineSelection(json.bestLineSelection || null);
          setBestBuildingSelection(json.bestBuildingSelection || null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError(err.message || "Failed to load summary");

          setSummary(null);
          setLines([]);
          setBuildingsData([]);
          setBestLineSelection(null);
          setBestBuildingSelection(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSummary();
    const intervalId = setInterval(fetchSummary, 10000); // auto refresh

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [factory, building, date]);

  const production = summary?.production || {};
  const quality = summary?.quality || {};

  const isAllBuildings = !building; // "" => All

  // 🔹 Efficiency chart data (sorted serially)
  const effChartData = useMemo(() => {
    const src = isAllBuildings ? buildingsData : lines;
    const mapped = (src || []).map((item) => ({
      label: isAllBuildings ? item.building : item.line,
      hourlyEff: Number(item.production?.currentHourEfficiency ?? 0),
      avgEff: Number(item.production?.avgEffPercent ?? 0),
    }));

    return mapped.sort(
      (a, b) =>
        getLabelOrderIndex(a.label, isAllBuildings) -
        getLabelOrderIndex(b.label, isAllBuildings)
    );
  }, [lines, buildingsData, isAllBuildings]);

  // 🔹 Quality chart data (sorted same order)
  const qualityChartData = useMemo(() => {
    const src = isAllBuildings ? buildingsData : lines;
    const mapped = (src || []).map((item) => ({
      label: isAllBuildings ? item.building : item.line,
      rft: Number(item.quality?.rftPercent ?? 0),
      dhu: Number(item.quality?.dhuPercent ?? 0),
      defectRate: Number(item.quality?.defectRatePercent ?? 0),
    }));

    return mapped.sort(
      (a, b) =>
        getLabelOrderIndex(a.label, isAllBuildings) -
        getLabelOrderIndex(b.label, isAllBuildings)
    );
  }, [lines, buildingsData, isAllBuildings]);

  // 🔹 Qty chart data (sorted same order)
  const qtyChartData = useMemo(() => {
    const src = isAllBuildings ? buildingsData : lines;
    const mapped = (src || []).map((item) => {
      const target = Number(item.production?.targetQty ?? 0);
      const achieved = Number(item.production?.achievedQty ?? 0);
      const planPercent = target > 0 ? (achieved / target) * 100 : null;

      return {
        label: isAllBuildings ? item.building : item.line,
        target,
        achieved,
        planPercent,
      };
    });

    return mapped.sort(
      (a, b) =>
        getLabelOrderIndex(a.label, isAllBuildings) -
        getLabelOrderIndex(b.label, isAllBuildings)
    );
  }, [lines, buildingsData, isAllBuildings]);

  // ✅ Best label for crown (NOW from API marks+place)
  const bestQtyLabel = useMemo(() => {
    const apiBest = isAllBuildings
      ? bestBuildingSelection?.bestLabel
      : bestLineSelection?.bestLabel;

    if (apiBest) return apiBest;

    // fallback for older API
    return getBestLabelFromQtyData(qtyChartData);
  }, [isAllBuildings, bestBuildingSelection, bestLineSelection, qtyChartData]);

  // ✅ Best selection table rows
  const selectionRows = isAllBuildings
    ? bestBuildingSelection?.rows || []
    : bestLineSelection?.rows || [];

  const selectionTitle = isAllBuildings
    ? "Best Floor Selection (Up to Date)"
    : "Best Line Selection (Up to Date)";

  const selectionLabelHeader = isAllBuildings ? "Floor" : "Line";

  const overallPlanPercent =
    Number(production.totalTargetQty) > 0
      ? clampPercent(
          (Number(production.totalAchievedQty) /
            Number(production.totalTargetQty)) *
            100
        )
      : 0;

  const hasChartData = isAllBuildings
    ? buildingsData.length > 0
    : lines.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 py-3 px-2 text-slate-100">
      <div className="max-w-7xl mx-auto space-y-4">
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
                  className="select select-xs bg-amber-300 text-gray-950 select-bordered min-w-[120px]"
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
                  Floor{/* Building */}
                </label>
                <select
                  className="select select-xs bg-amber-300 text-gray-950 select-bordered min-w-[120px]"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                >
                  <option value="">All</option>
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
                  className="input input-xs bg-amber-300 text-gray-950 input-bordered"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
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

        {/* Summary section */}
        <div className="grid gap-3 md:grid-cols-2">
          {/* Production summary */}
          <div className="rounded-2xl border border-sky-700 bg-slate-950/90 p-3 shadow-[0_12px_36px_rgba(0,0,0,0.7)]">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-sky-300">
                  Production Summary
                </div>
                <div className="text-[10px] text-slate-400">
                  {factory}{" "}
                  {building
                    ? `• ${building}`
                    : "• All buildings (factory view)"}
                </div>
              </div>
              <div className="text-right text-[9px] text-slate-400">
                <div>Date</div>
                <div className="font-semibold text-slate-100">{date}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <MetricBox
                label="Total Target"
                value={formatNumber(production.totalTargetQty ?? 0, 0)}
                accent="border-sky-500/60 text-sky-300"
              />
              <MetricBox
                label="Total Achieved"
                value={formatNumber(production.totalAchievedQty ?? 0, 0)}
                accent="border-emerald-500/60 text-emerald-300"
              />
              <MetricBox
                label="Total Variance"
                value={formatNumber(production.totalVarianceQty ?? 0, 0)}
                accent={
                  (production.totalVarianceQty ?? 0) >= 0
                    ? "border-emerald-500/60 text-emerald-300"
                    : "border-rose-500/60 text-rose-300"
                }
              />
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
              <MetricBox
                label="Avg Eff%"
                value={`${formatNumber(production.avgEffPercent ?? 0, 1)} %`}
                accent="border-indigo-500/60 text-indigo-300"
              />
              <MetricBox
                label="Current Hr Eff%"
                value={
                  production.currentHour != null
                    ? `${formatNumber(
                        production.currentHourEfficiency ?? 0,
                        1
                      )} % (Hr ${production.currentHour})`
                    : "-"
                }
                accent="border-amber-500/60 text-amber-300"
              />
              <MetricBox
                label="Plan%"
                value={`${formatNumber(overallPlanPercent, 1)} %`}
                accent="border-cyan-500/60 text-cyan-300"
              />
            </div>
          </div>

          {/* Quality summary */}
          <div className="rounded-2xl border border-emerald-700 bg-slate-950/90 p-3 shadow-[0_12px_36px_rgba(0,0,0,0.7)]">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-emerald-300">
                  Quality Summary
                </div>
                <div className="text-[10px] text-slate-400">
                  {factory}{" "}
                  {building
                    ? `• ${building}`
                    : "• All buildings (factory view)"}
                </div>
              </div>
              <div className="text-right text-[9px] text-slate-400">
                <div>Quality Hr</div>
                <div className="font-semibold text-emerald-200">
                  {quality.currentHour ?? "-"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-[11px]">
              <MetricBox
                label="Inspected"
                value={formatNumber(quality.totalInspected ?? 0, 0)}
                accent="border-slate-600 text-slate-200"
              />
              <MetricBox
                label="Passed"
                value={formatNumber(quality.totalPassed ?? 0, 0)}
                accent="border-emerald-500/60 text-emerald-300"
              />
              <MetricBox
                label="Def. Pcs"
                value={formatNumber(quality.totalDefectivePcs ?? 0, 0)}
                accent="border-rose-500/60 text-rose-300"
              />
              <MetricBox
                label="Defects"
                value={formatNumber(quality.totalDefects ?? 0, 0)}
                accent="border-amber-500/60 text-amber-300"
              />
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
              <MetricBox
                label="RFT%"
                value={`${formatNumber(quality.rftPercent ?? 0, 1)} %`}
                accent="border-emerald-500/60 text-emerald-300"
              />
              <MetricBox
                label="DHU%"
                value={`${formatNumber(quality.dhuPercent ?? 0, 1)} %`}
                accent="border-amber-500/60 text-amber-300"
              />
              <MetricBox
                label="Defect Rate%"
                value={`${formatNumber(quality.defectRatePercent ?? 0, 1)} %`}
                accent="border-rose-500/60 text-rose-300"
              />
            </div>
          </div>
        </div>

        {/* ✅ Best Selection Table (Excel-like) */}
        {selectionRows.length > 0 && (
          <BestSelectionTable
            title={selectionTitle}
            rows={selectionRows}
            labelHeader={selectionLabelHeader}
          />
        )}

        {/* Charts */}
        {hasChartData ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {/* Efficiency bar chart */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] uppercase tracking-wide text-sky-300">
                  {isAllBuildings
                    ? "Floor Efficiency (Hr vs Avg)"
                    : "Line Efficiency (Hr vs Avg)"}
                </div>
                <div className="text-[9px] text-slate-400">
                  Bars capped at 0–150%
                </div>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={effChartData}
                    margin={{ top: 24, right: 10, left: 0, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#e5e7eb", fontSize: 10 }}
                      interval={0}
                      height={50}
                    />
                    <YAxis
                      tick={{ fill: "#e5e7eb", fontSize: 10 }}
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 150]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#020617",
                        border: "1px solid #1f2937",
                        fontSize: 11,
                        color: "#e5e7eb",
                      }}
                      formatter={(value) => `${formatNumber(value, 1)} %`}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 10, color: "#e5e7eb" }}
                    />

                    <Bar
                      dataKey="hourlyEff"
                      name="Hr Eff%"
                      fill="#22c55e"
                      radius={[4, 4, 0, 0]}
                    >
                      <LabelList
                        dataKey="hourlyEff"
                        content={renderPercentLabelTop}
                      />
                    </Bar>

                    <Bar
                      dataKey="avgEff"
                      name="Avg Eff%"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    >
                      <LabelList
                        dataKey="avgEff"
                        content={renderPercentLabelTop}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quality bar chart */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] uppercase tracking-wide text-emerald-300">
                  {isAllBuildings
                    ? "Floor Quality (RFT / DHU / Defect Rate)"
                    : "Line Quality (RFT / DHU / Defect Rate)"}
                </div>
                <div className="text-[9px] text-slate-400">
                  {isAllBuildings
                    ? "Per-building quality percentages"
                    : "Per-line quality percentages"}
                </div>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={qualityChartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#e5e7eb", fontSize: 10 }}
                      interval={0}
                      height={50}
                    />
                    <YAxis
                      tick={{ fill: "#e5e7eb", fontSize: 10 }}
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 150]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#020617",
                        border: "1px solid #1f2937",
                        fontSize: 11,
                        color: "#e5e7eb",
                      }}
                      formatter={(value) => `${formatNumber(value, 1)} %`}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 10, color: "#e5e7eb" }}
                    />
                    <Bar
                      dataKey="rft"
                      name="RFT%"
                      fill="#22c55e"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="dhu"
                      name="DHU%"
                      fill="#eab308"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="defectRate"
                      name="Defect Rate%"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Qty bar chart */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 lg:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] uppercase tracking-wide text-cyan-300">
                  {isAllBuildings
                    ? "Floor Target vs Achieved (Qty)"
                    : "Line Target vs Achieved (Qty)"}
                </div>

                <div className="text-[10px] text-slate-300/70">
                  Best:{" "}
                  <span className="font-semibold text-amber-300">
                    {bestQtyLabel || "-"}
                  </span>{" "}
                  <span className="ml-1">👑</span>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={qtyChartData}
                    margin={{ top: 28, right: 10, left: 0, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#e5e7eb", fontSize: 10 }}
                      interval={0}
                      height={60}
                    />
                    <YAxis
                      tick={{ fill: "#e5e7eb", fontSize: 10 }}
                      tickFormatter={(v) => formatNumber(v, 0)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#020617",
                        border: "1px solid #1f2937",
                        fontSize: 11,
                        color: "#e5e7eb",
                      }}
                      formatter={(value) => formatNumber(value, 0)}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 10, color: "#e5e7eb" }}
                    />

                    <Bar
                      dataKey="target"
                      name={isAllBuildings ? "Target Qty (Floor)" : "Target Qty"}
                      fill="#38bdf8"
                      radius={[4, 4, 0, 0]}
                    >
                      <LabelList
                        dataKey="target"
                        content={renderQtyLabelVertical}
                      />
                    </Bar>

                    <Bar
                      dataKey="achieved"
                      name={
                        isAllBuildings ? "Achieved Qty (Floor)" : "Achieved Qty"
                      }
                      fill="oklch(60.3% 0.11 240.79)"
                      radius={[4, 4, 0, 0]}
                    >
                      <LabelList
                        dataKey="achieved"
                        content={renderQtyLabelVertical}
                      />
                      <LabelList
                        dataKey="planPercent"
                        content={renderPercentLabelTop}
                      />
                      <LabelList
                        dataKey="label"
                        content={makeCrownLabel(bestQtyLabel)}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          !loading &&
          !error && (
            <p className="text-[11px] text-slate-500">
              No data for this factory / building / date yet.
            </p>
          )
        )}
      </div>
    </div>
  );
}
