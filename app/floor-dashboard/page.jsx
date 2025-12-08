// app/floor-dashboard/page.jsx
"use client";

import { useState, useEffect } from "react";

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

  // 🔁 Auto-load + auto-refresh when factory/building/date/line changes
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

  return (
    <div className="space-y-4">
      {/* Filter Panel */}
      <div className="card bg-base-100 border border-base-200 shadow-sm">
        <div className="card-body p-3 text-xs space-y-2">
          <div className="flex flex-wrap items-end gap-3">
            {/* Factory */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold uppercase">
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
              <label className="block text-[11px] font-semibold uppercase">
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
              <label className="block text-[11px] font-semibold uppercase">
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
              <label className="block text-[11px] font-semibold uppercase">
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
            <LineCard key={row.line} lineData={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function LineCard({ lineData }) {
  const { line, quality, production } = lineData;

  return (
    <div className="card bg-base-100 border border-base-200 shadow-sm">
      <div className="card-body p-3 space-y-2 text-[11px]">
        {/* Header */}
        <div className="font-semibold text-xs border-b border-base-200 pb-1">
          {line}
        </div>

        {/* Quality block */}
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-2 space-y-1">
          <div className="font-semibold text-[11px]">Quality</div>
          <Row
            label="RFT%"
            value={`${formatNumber(quality?.rftPercent ?? 0, 1)} %`}
          />
          <Row
            label="DHU%"
            value={`${formatNumber(quality?.dhuPercent ?? 0, 1)} %`}
          />
          <Row
            label="Defect Rate%"
            value={`${formatNumber(quality?.defectRatePercent ?? 0, 1)} %`}
          />

          {/* 👉 Quality current hour */}
          <div className="flex justify-between text-[11px] text-slate-1000 pt-1">
            <span>Quality Current Hour</span>
            <span>{quality?.currentHour ?? "-"}</span>
          </div>
        </div>

        {/* Production block */}
        <div className="rounded-md bg-sky-50 border border-sky-200 p-2 space-y-1">
          <div className="font-semibold text-[11px]">Production</div>

          <Row
            label="Target Quantity"
            value={formatNumber(production?.targetQty ?? 0, 0)}
          />
          <Row
            label="Achieve Quantity"
            value={formatNumber(production?.achievedQty ?? 0, 0)}
          />
          <Row
            label="Variance Quantity"
            value={formatNumber(production?.varianceQty ?? 0, 0)}
            valueClass={
              (production?.varianceQty ?? 0) >= 0
                ? "text-emerald-700"
                : "text-red-700"
            }
          />
          <Row
            label="Hourly Efficiency"
            value={`${formatNumber(
              production?.currentHourEfficiency ?? 0,
              1
            )} %`}
          />
          <Row
            label="Average Efficiency"
            value={`${formatNumber(
              production?.avgEffPercent ?? 0,
              1
            )} %`}
          />

          <div className="flex justify-between text-[11px] text-slate-1000 pt-1">
            <span>Production Current Hour</span>
            <span>{production?.currentHour ?? "-"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, valueClass = "" }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className={`font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}
