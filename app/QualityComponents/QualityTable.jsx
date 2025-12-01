"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/hooks/useAuth";

const HOUR_COLUMNS = [
  "1st Hour",
  "2nd Hour",
  "3rd Hour",
  "4th Hour",
  "5th Hour",
  "6th Hour",
  "7th Hour",
  "8th Hour",
  "9th Hour",
  "10th Hour",
  "11th Hour",
  "12th Hour",
];

const STATIC_LINE_OPTIONS = ["Line-1", "Line-2", "Line-3","Line-4","Line-5","Line-6","Line-7","Line-8","Line-9","Line-10","Line-11","Line-12","Line-13","Line-14","Line-15"];

function formatDateInput(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toLocalDateLabelFromInput(inputValue) {
  if (!inputValue) return "";
  const d = new Date(inputValue + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}


export default function QualityTable() {
  const { auth } = useAuth();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedDate, setSelectedDate] = useState(() => formatDateInput());
  const [selectedLine, setSelectedLine] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [toast, setToast] = useState(null);

  const building = useMemo(
    () => auth?.assigned_building || auth?.building || "",
    [auth]
  );

  const viewingDateLabel = useMemo(
    () => toLocalDateLabelFromInput(selectedDate),
    [selectedDate]
  );

  const showToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSummary = async () => {
    if (!building) {
      setRows([]);
      setError("No building is assigned to your account.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const dateIso = new Date(selectedDate + "T00:00:00").toISOString();
      let url = `/api/hourly-inspections?date=${encodeURIComponent(
        dateIso
      )}&limit=1000&building=${encodeURIComponent(building)}`;

      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) throw new Error(json?.message || "Failed to load summary");

      setRows(json?.data || []);
    } catch (e) {
      console.error("Summary load error:", e);
      setError(e.message || "Failed to load summary");
      showToast(e.message || "Failed to load summary", "error");
    } finally {
      setLoading(false);
    }
  };

  // initial + auto refresh
  useEffect(() => {
    if (!auth) return;

    fetchSummary();

    if (!autoRefresh) return;

    const id = setInterval(() => {
      fetchSummary();
    }, 15000); // 15s

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, selectedDate, building, autoRefresh]);

  // line options
  const lineOptions = useMemo(() => {
    const set = new Set(STATIC_LINE_OPTIONS);
    rows.forEach((r) => {
      if (r.line) set.add(r.line);
    });
    return Array.from(set);
  }, [rows]);

  // filter by line
  const filteredRows = useMemo(() => {
    if (!selectedLine) return rows;
    return rows.filter((r) => r.line === selectedLine);
  }, [rows, selectedLine]);

  // pivot: defect x hour
  const defectRows = useMemo(() => {
    const map = {};

    filteredRows.forEach((row) => {
      const hourLabel = row.hourLabel || row.hour;
      if (!Array.isArray(row.selectedDefects)) return;

      row.selectedDefects.forEach((d) => {
        if (!d?.name) return;
        const name = d.name;
        const qty = Number(d.quantity || 0);

        if (!map[name]) {
          map[name] = {
            name,
            perHour: {},
            total: 0,
          };
        }

        if (hourLabel) {
          map[name].perHour[hourLabel] =
            (map[name].perHour[hourLabel] || 0) + qty;
        }
        map[name].total += qty;
      });
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredRows]);

  // per-hour + totals + rates
  const {
    perHourInspected,
    perHourPassed,
    perHourAfterRepair,
    perHourDefectivePieces,
    perHourDefects,
    totalInspected,
    totalPassed,
    totalAfterRepair,
    totalDefectivePieces,
    totalDefectsAll,
    defectiveRatePerHour,
    rftPerHour,
    dhuPerHour,
    defectiveRateTotal,
    rftTotal,
    dhuTotal,
  } = useMemo(() => {
    const perHourInspected = {};
    const perHourPassed = {};
    const perHourAfterRepair = {};
    const perHourDefectivePieces = {};
    const perHourDefects = {};

    HOUR_COLUMNS.forEach((h) => {
      perHourInspected[h] = 0;
      perHourPassed[h] = 0;
      perHourAfterRepair[h] = 0;
      perHourDefectivePieces[h] = 0;
      perHourDefects[h] = 0;
    });

    let totalInspected = 0;
    let totalPassed = 0;
    let totalAfterRepair = 0;
    let totalDefectivePieces = 0;
    let totalDefectsAll = 0;

    filteredRows.forEach((r) => {
      const hourLabel = r.hourLabel || r.hour;
      if (!HOUR_COLUMNS.includes(hourLabel)) return;

      const inspected = Number(r.inspectedQty || 0);
      const passed = Number(r.passedQty || 0);
      const afterRepair = Number(r.afterRepair || 0);
      const defective = Number(r.defectivePcs || 0);

      perHourInspected[hourLabel] += inspected;
      perHourPassed[hourLabel] += passed;
      perHourAfterRepair[hourLabel] += afterRepair;
      perHourDefectivePieces[hourLabel] += defective;

      totalInspected += inspected;
      totalPassed += passed;
      totalAfterRepair += afterRepair;
      totalDefectivePieces += defective;

      let defectsThisRow = 0;
      if (Array.isArray(r.selectedDefects)) {
        defectsThisRow = r.selectedDefects.reduce(
          (sum, d) => sum + Number(d.quantity || 0),
          0
        );
      }
      perHourDefects[hourLabel] += defectsThisRow;
      totalDefectsAll += defectsThisRow;
    });

    const defectiveRatePerHour = {};
    const rftPerHour = {};
    const dhuPerHour = {};

    HOUR_COLUMNS.forEach((h) => {
      const inspected = perHourInspected[h];
      const defective = perHourDefectivePieces[h];
      const defects = perHourDefects[h];

      defectiveRatePerHour[h] =
        inspected > 0 ? ((defective / inspected) * 100).toFixed(2) : "0.00";
      rftPerHour[h] =
        inspected > 0 ? ((perHourPassed[h] / inspected) * 100).toFixed(2) : "0.00";
      dhuPerHour[h] =
        inspected > 0 ? ((defects / inspected) * 100).toFixed(2) : "0.00";
    });

    const defectiveRateTotal =
      totalInspected > 0
        ? ((totalDefectivePieces / totalInspected) * 100).toFixed(2)
        : "0.00";
    const rftTotal =
      totalInspected > 0
        ? ((totalPassed / totalInspected) * 100).toFixed(2)
        : "0.00";
    const dhuTotal =
      totalInspected > 0
        ? ((totalDefectsAll / totalInspected) * 100).toFixed(2)
        : "0.00";

    return {
      perHourInspected,
      perHourPassed,
      perHourAfterRepair,
      perHourDefectivePieces,
      perHourDefects,
      totalInspected,
      totalPassed,
      totalAfterRepair,
      totalDefectivePieces,
      totalDefectsAll,
      defectiveRatePerHour,
      rftPerHour,
      dhuPerHour,
      defectiveRateTotal,
      rftTotal,
      dhuTotal,
    };
  }, [filteredRows]);

  // top 3 defects
  const topDefects = useMemo(() => {
    if (!totalDefectsAll) return [];
    return defectRows.slice(0, 3).map((d, idx) => ({
      rank: idx + 1,
      name: d.name,
      qty: d.total,
      percent: ((d.total / totalDefectsAll) * 100).toFixed(2),
    }));
  }, [defectRows, totalDefectsAll]);

  // last update time
  const lastUpdate = useMemo(() => {
    if (!filteredRows.length) return null;
    let latest = null;

    filteredRows.forEach((r) => {
      const t = r.updatedAt || r.createdAt;
      if (!t) return;
      const time = new Date(t).getTime();
      if (latest === null || time > latest) latest = time;
    });

    return latest ? new Date(latest) : null;
  }, [filteredRows]);

  const lastUpdateLabel = lastUpdate ? lastUpdate.toLocaleTimeString() : "-";

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className="fixed right-4 top-4 z-50">
          <div
            className={`flex items-start gap-2 rounded-lg border px-4 py-3 shadow-lg ${
              toast.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : toast.type === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-blue-200 bg-blue-50 text-blue-800"
            }`}
          >
            <span className="text-lg">
              {toast.type === "success"
                ? "✅"
                : toast.type === "error"
                ? "⚠️"
                : "ℹ️"}
            </span>
            <div className="text-sm">
              <p className="font-medium">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-2 text-xs opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl p-4 md:p-6">
        {/* PAGE HEADER */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-black">
              Endline Defect Summary —{" "}
              <span className="text-indigo-600">
                {auth?.user_name || "User"} {building && `(${building})`}
              </span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
            <span className="text-gray-600">Pick date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-md bg-gray-300 text-gray-700 border border-gray-700 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => setSelectedDate(formatDateInput())}
              className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium hover:bg-gray-100 text-gray-700"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md bg-green-600 px-4 py-1 text-xs font-semibold text-white hover:bg-green-700"
            >
              Print
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* MAIN CARD: TABLE + KPIs */}
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          {/* top info row (last update, viewing date, line filter, refresh/auto) */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                Last update:{" "}
                <span className="font-semibold text-gray-800">
                  {lastUpdateLabel}
                </span>
              </span>
              <span>
                Viewing date:{" "}
                <span className="font-semibold text-gray-800">
                  {viewingDateLabel}
                </span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span>Line:</span>
                <select
                  value={selectedLine}
                  onChange={(e) => setSelectedLine(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                >
                  <option value="">All Lines</option>
                  {lineOptions.map((line) => (
                    <option key={line} value={line}>
                      {line}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={fetchSummary}
                className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium hover:bg-gray-100"
              >
                Refresh
              </button>

              <button
                type="button"
                onClick={() => setAutoRefresh((v) => !v)}
                className={`rounded-md px-3 py-1 text-xs font-medium ${
                  autoRefresh
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-gray-300 bg-white text-gray-700"
                }`}
              >
                Auto: {autoRefresh ? "On" : "Off"}
              </button>

              {loading && <span>Loading...</span>}
            </div>
          </div>

          {/* main table */}
          <div className="w-full overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-2 text-left text-[11px] font-semibold text-black">
                    Defect Name/Code
                  </th>
                  {HOUR_COLUMNS.map((h) => (
                    <th
                      key={h}
                      className="border px-2 py-2 text-center text-[11px] font-semibold text-black"
                    >
                      {h}
                    </th>
                  ))}
                  <th className="border px-2 py-2 text-center text-[11px] font-semibold text-black">
                    Total Defects
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* defect rows */}
                {defectRows.map((row) => (
                  <tr key={row.name} className="hover:bg-gray-50">
                    <td className="border px-2 py-1 font-medium text-gray-700">
                      {row.name}
                    </td>
                    {HOUR_COLUMNS.map((h) => (
                      <td
                        key={h}
                        className="border px-2 py-1 text-center text-gray-700"
                      >
                        {row.perHour[h] || 0}
                      </td>
                    ))}
                    <td className="border px-2 py-1 text-center font-semibold text-gray-800">
                      {row.total}
                    </td>
                  </tr>
                ))}

                {/* TOTAL DEFECTS row */}
                <tr className="bg-gray-50 font-semibold text-gray-800">
                  <td className="border px-2 py-1">Total Defects</td>
                  {HOUR_COLUMNS.map((h) => (
                    <td
                      key={h}
                      className="border px-2 py-1 text-center text-gray-800"
                    >
                      {perHourDefects[h] || 0}
                    </td>
                  ))}
                  <td className="border px-2 py-1 text-center">
                    {totalDefectsAll}
                  </td>
                </tr>

                {/* INSPECTED row */}
                <tr className="bg-white text-gray-800">
                  <td className="border px-2 py-1 font-semibold">
                    Inspected Quantity
                  </td>
                  {HOUR_COLUMNS.map((h) => (
                    <td
                      key={h}
                      className="border px-2 py-1 text-center text-gray-800"
                    >
                      {perHourInspected[h] || 0}
                    </td>
                  ))}
                  <td className="border px-2 py-1 text-center font-semibold">
                    {totalInspected}
                  </td>
                </tr>

                {/* PASSED row */}
                <tr className="bg-white text-gray-800">
                  <td className="border px-2 py-1 font-semibold">
                    Passed Quantity
                  </td>
                  {HOUR_COLUMNS.map((h) => (
                    <td
                      key={h}
                      className="border px-2 py-1 text-center text-gray-800"
                    >
                      {perHourPassed[h] || 0}
                    </td>
                  ))}
                  <td className="border px-2 py-1 text-center font-semibold">
                    {totalPassed}
                  </td>
                </tr>

                {/* RECEIVE AFTER REPAIR */}
                <tr className="bg-white text-gray-800">
                  <td className="border px-2 py-1 font-semibold">
                    Receive After Repair
                  </td>
                  {HOUR_COLUMNS.map((h) => (
                    <td
                      key={h}
                      className="border px-2 py-1 text-center text-gray-800"
                    >
                      {perHourAfterRepair[h] || 0}
                    </td>
                  ))}
                  <td className="border px-2 py-1 text-center font-semibold">
                    {totalAfterRepair}
                  </td>
                </tr>

                {/* DEFECTIVE PIECES */}
                <tr className="bg-white text-gray-800">
                  <td className="border px-2 py-1 font-semibold">
                    Defective Pieces
                  </td>
                  {HOUR_COLUMNS.map((h) => (
                    <td
                      key={h}
                      className="border px-2 py-1 text-center text-gray-800"
                    >
                      {perHourDefectivePieces[h] || 0}
                    </td>
                  ))}
                  <td className="border px-2 py-1 text-center font-semibold">
                    {totalDefectivePieces}
                  </td>
                </tr>

                {/* DEFECTIVE RATE % row */}
                <tr>
                  <td className="border bg-red-600 px-2 py-1 text-left text-xs font-semibold text-white">
                    Defective Rate
                  </td>
                  {HOUR_COLUMNS.map((h) => {
                    const v = Number(defectiveRatePerHour[h] || 0);
                    const active = v > 0;
                    return (
                      <td
                        key={h}
                        className={`border px-2 py-1 text-center text-xs ${
                          active
                            ? "bg-red-50 text-red-700"
                            : "bg-gray-50 text-gray-400"
                        }`}
                      >
                        {v.toFixed(2)}%
                      </td>
                    );
                  })}
                  <td className="border bg-red-100 px-2 py-1 text-center text-xs font-bold text-red-700">
                    {defectiveRateTotal}%
                  </td>
                </tr>

                {/* RFT% row */}
                <tr>
                  <td className="border bg-green-600 px-2 py-1 text-left text-xs font-semibold text-white">
                    RFT%
                  </td>
                  {HOUR_COLUMNS.map((h) => {
                    const v = Number(rftPerHour[h] || 0);
                    let colorClass = "bg-green-50 text-green-700";
                    if (!v) colorClass = "bg-gray-50 text-gray-400";
                    else if (v < 90)
                      colorClass = "bg-red-50 text-red-700";
                    else if (v < 95)
                      colorClass = "bg-yellow-50 text-yellow-700";
                    return (
                      <td
                        key={h}
                        className={`border px-2 py-1 text-center text-xs ${colorClass}`}
                      >
                        {v.toFixed(2)}%
                      </td>
                    );
                  })}
                  <td className="border bg-green-100 px-2 py-1 text-center text-xs font-bold text-green-700">
                    {rftTotal}%
                  </td>
                </tr>

                {/* DHU% row */}
                <tr>
                  <td className="border bg-red-600 px-2 py-1 text-left text-xs font-semibold text-white">
                    DHU%
                  </td>
                  {HOUR_COLUMNS.map((h) => {
                    const v = Number(dhuPerHour[h] || 0);
                    const active = v > 0;
                    return (
                      <td
                        key={h}
                        className={`border px-2 py-1 text-center text-xs ${
                          active
                            ? "bg-red-50 text-red-700"
                            : "bg-gray-50 text-gray-400"
                        }`}
                      >
                        {v.toFixed(2)}%
                      </td>
                    );
                  })}
                  <td className="border bg-red-100 px-2 py-1 text-center text-xs font-bold text-red-700">
                    {dhuTotal}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* bottom totals row like screenshot */}
          <div className="mt-3 border-t border-gray-200 pt-2 text-[11px] text-gray-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-4">
                <span>
                  <span className="font-semibold">Total Inspected:</span>{" "}
                  {totalInspected}
                </span>
                <span>
                  <span className="font-semibold">Total Passed:</span>{" "}
                  {totalPassed}
                </span>
                <span>
                  <span className="font-semibold">Total Defective Pcs:</span>{" "}
                  {totalDefectivePieces}
                </span>
                <span>
                  <span className="font-semibold">Total Defects:</span>{" "}
                  {totalDefectsAll}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700">
                  Total Defect Rate: {defectiveRateTotal}%
                </span>
                <span className="rounded-full bg-yellow-100 px-3 py-1 font-semibold text-yellow-800">
                  Total DHU%: {dhuTotal}%
                </span>
                <span className="rounded-full bg-green-100 px-3 py-1 font-semibold text-green-700">
                  Total RFT%: {rftTotal}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* TOP 3 DEFECTS CARD */}
        <div className="mt-6 rounded-lg border border-red-700 bg-red-700 text-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-[11px] md:text-xs">
            <div className="font-semibold">
              TOP THREE (3) DEFECTS - {viewingDateLabel}
            </div>
            <div className="flex items-center gap-2">
              <span>Select date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded border border-red-200 bg-white px-2 py-0.5 text-[11px] text-gray-800"
              />
            </div>
          </div>

          <div className="bg-red-600/80 px-4 pb-4 pt-2">
            {topDefects.length === 0 ? (
              <div className="rounded border border-red-300 bg-red-500/40 p-4 text-center text-xs">
                No defects to rank.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-red-500">
                      <th className="border border-red-300 px-2 py-1 text-left">
                        RANK
                      </th>
                      <th className="border border-red-300 px-2 py-1 text-left">
                        DEFECT NAME
                      </th>
                      <th className="border border-red-300 px-2 py-1 text-right">
                        DEFECT QTY
                      </th>
                      <th className="border border-red-300 px-2 py-1 text-right">
                        DEFECT %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topDefects.map((d) => (
                      <tr key={d.rank} className="bg-red-500/40">
                        <td className="border border-red-300 px-2 py-1 font-semibold">
                          #{d.rank}
                        </td>
                        <td className="border border-red-300 px-2 py-1">
                          {d.name}
                        </td>
                        <td className="border border-red-300 px-2 py-1 text-right font-semibold">
                          {d.qty}
                        </td>
                        <td className="border border-red-300 px-2 py-1 text-right">
                          {d.percent}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
