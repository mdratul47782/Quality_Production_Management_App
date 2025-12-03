// app/ProductionComponents/LineDailyWorkingBoard.jsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";

// --------- helpers ----------
const lineOptions = [
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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatNumber(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toFixed(digits);
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ===================================================================================
// MAIN COMPONENT – select line & date, fetch headers, render one hourly card per header
// ===================================================================================

export default function HourlyProductionBoard() {
  const { auth, loading: authLoading } = useAuth();

  const [selectedLine, setSelectedLine] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [headers, setHeaders] = useState([]);
  const [loadingHeaders, setLoadingHeaders] = useState(false);
  const [error, setError] = useState("");

  const assignedBuilding = auth?.assigned_building || "";

  // Fetch headers by building + line + date
  useEffect(() => {
    if (authLoading) return;

    if (!assignedBuilding || !selectedLine || !selectedDate) {
      setHeaders([]);
      return;
    }

    const controller = new AbortController();

    const fetchHeaders = async () => {
      try {
        setLoadingHeaders(true);
        setError("");

        const params = new URLSearchParams({
          assigned_building: assignedBuilding,
          line: selectedLine,
          date: selectedDate,
        });

        const res = await fetch(
          `/api/target-setter-header?${params.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to load target headers");
        }

        setHeaders(json.data || []);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error(err);
        setError(err.message || "Failed to load target headers");
        setHeaders([]);
      } finally {
        setLoadingHeaders(false);
      }
    };

    fetchHeaders();

    return () => controller.abort();
  }, [authLoading, assignedBuilding, selectedLine, selectedDate]);

  if (authLoading) {
    return (
      <div className="card bg-base-100 border border-base-200 shadow-sm">
        <div className="card-body py-2 px-3 text-xs">
          Loading user...
        </div>
      </div>
    );
  }

  if (!auth) {
    return (
      <div className="card bg-yellow-50 border border-yellow-300 shadow-sm">
        <div className="card-body py-2 px-3 text-xs">
          No user logged in. Please sign in to see hourly production.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Top filter panel */}
      <div className="card bg-base-100 border border-base-200 shadow-sm">
        <div className="card-body p-3 space-y-2 text-xs">
          <div className="flex flex-wrap items-end gap-4">
            {/* Building chip */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-slate-1000 uppercase">
                Building
              </div>
              <div className="badge bg-slate-100 border border-amber-500 text-[11px] font-semibold text-slate-900 px-3 py-2">
                <span className="mr-1 text-slate-500">Assigned:</span>
                <span>{assignedBuilding || "Not assigned"}</span>
              </div>
            </div>

            {/* Line select */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-1000 uppercase">
                Line
              </label>
              <select
                className="select select-xs select-bordered bg-slate-400 font-semibold text-xs min-w-[120px] text-black"
                value={selectedLine}
                onChange={(e) => setSelectedLine(e.target.value)}
              >
                <option value="">Select line</option>
                {lineOptions.map((line) => (
                  <option key={line} value={line}>
                    {line}
                  </option>
                ))}
              </select>
            </div>

            {/* Date select */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-1000 uppercase">
                Date
              </label>
              <input
                type="date"
                className="input input-xs input-bordered bg-amber-300 font-semibold text-xs text-black"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>

          {/* Status / messages */}
          {error && (
            <div className="alert alert-error py-1 px-2 text-[11px]">
              <span>{error}</span>
            </div>
          )}

          {selectedLine && !loadingHeaders && headers.length === 0 && (
            <div className="text-[11px] text-slate-600">
              No target headers for{" "}
              <span className="font-semibold">{assignedBuilding}</span> •{" "}
              <span className="font-semibold">{selectedLine}</span> •{" "}
              <span className="font-semibold">{selectedDate}</span>
            </div>
          )}

          {loadingHeaders && (
            <div className="text-[11px] text-slate-600 flex items-center gap-2">
              <span className="loading loading-spinner loading-xs" />
              <span>Loading target headers...</span>
            </div>
          )}
        </div>
      </div>

      {/* One card per header (e.g. 2h + 6h for same day) */}
      {headers.map((header) => (
        <HourlyHeaderCard key={header._id} header={header} auth={auth} />
      ))}

      {headers.length === 0 && !loadingHeaders && !error && selectedLine && (
        <div className="text-[11px] text-slate-500">
          When you create target headers for this line & date, they will show
          here with hourly input cards.
        </div>
      )}
    </div>
  );
}
// CHILD: One hourly card per TargetSetterHeader (for a specific style segment)
// 
function HourlyHeaderCard({ header, auth }) {
  const [selectedHour, setSelectedHour] = useState(1);
  const [achievedInput, setAchievedInput] = useState("");
  const [hourlyRecords, setHourlyRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Capacity + WIP state
  const [capacityInput, setCapacityInput] = useState("");
  const [capacityRecord, setCapacityRecord] = useState(null);
  const [capacitySaving, setCapacitySaving] = useState(false);
  const [capacityLoading, setCapacityLoading] = useState(false);
  const [wipInfo, setWipInfo] = useState(null);
  const [wipLoading, setWipLoading] = useState(false);

  const productionUserId =
    auth?.user?.id || auth?.user?._id || auth?.id || auth?._id || "";

  // 🔁 helper – reload only WIP (for realtime update after save)
  const refreshWip = async () => {
    if (!header) return;
    try {
      setWipLoading(true);

      const wipParams = new URLSearchParams({
        assigned_building: header.assigned_building,
        line: header.line,
        buyer: header.buyer,
        style: header.style,
        date: header.date,
      });

      const resWip = await fetch(`/api/style-wip?${wipParams.toString()}`, {
        cache: "no-store",
      });

      if (resWip.ok) {
        const jsonWip = await resWip.json();
        if (jsonWip.success) {
          setWipInfo(jsonWip.data);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWipLoading(false);
    }
  };

  // reset when header changes
  useEffect(() => {
    setSelectedHour(1);
    setAchievedInput("");
    setHourlyRecords([]);
    setError("");
    setMessage("");

    setCapacityInput("");
    setCapacityRecord(null);
    setWipInfo(null);
  }, [header?._id]);

  // Load existing hourly records for this header + user
  useEffect(() => {
    if (!header?._id || !productionUserId) return;

    const controller = new AbortController();

    const fetchRecords = async () => {
      try {
        setLoadingRecords(true);
        setError("");
        setMessage("");

        const params = new URLSearchParams({
          headerId: header._id,
          productionUserId: productionUserId,
        });

        const res = await fetch(
          `/api/hourly-productions?${params.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to load hourly records");
        }

        setHourlyRecords(json.data || []);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error(err);
        setError(err.message || "Failed to load hourly records");
        setHourlyRecords([]);
      } finally {
        setLoadingRecords(false);
      }
    };

    fetchRecords();

    return () => controller.abort();
  }, [header?._id, productionUserId]);

  // Capacity + WIP fetch for this style/building/line/buyer/date (initial)
  useEffect(() => {
    if (!header) return;

    const controller = new AbortController();

    const fetchCapacityAndWip = async () => {
      try {
        setCapacityLoading(true);
        setWipLoading(true);

        const baseParams = new URLSearchParams({
          assigned_building: header.assigned_building,
          line: header.line,
          buyer: header.buyer,
          style: header.style,
        });

        // Capacity
        try {
          const resCap = await fetch(
            `/api/style-capacities?${baseParams.toString()}`,
            {
              cache: "no-store",
              signal: controller.signal,
            }
          );

          if (resCap.ok) {
            const jsonCap = await resCap.json();
            if (jsonCap.success) {
              const doc = jsonCap.data?.[0] || null;
              setCapacityRecord(doc);
              setCapacityInput(
                doc?.capacity != null ? String(doc.capacity) : ""
              );
            }
          }
        } catch (err) {
          if (err.name !== "AbortError") console.error(err);
        }

        // WIP
        try {
          const wipParams = new URLSearchParams({
            assigned_building: header.assigned_building,
            line: header.line,
            buyer: header.buyer,
            style: header.style,
            date: header.date,
          });

          const resWip = await fetch(`/api/style-wip?${wipParams.toString()}`, {
            cache: "no-store",
            signal: controller.signal,
          });

          if (resWip.ok) {
            const jsonWip = await resWip.json();
            if (jsonWip.success) {
              setWipInfo(jsonWip.data);
            }
          }
        } catch (err) {
          if (err.name !== "AbortError") console.error(err);
        }
      } finally {
        setCapacityLoading(false);
        setWipLoading(false);
      }
    };

    fetchCapacityAndWip();

    return () => controller.abort();
  }, [
    header?.assigned_building,
    header?.line,
    header?.buyer,
    header?.style,
    header?.date,
  ]);

  if (!header) return null;

  // ---------- derived header values ----------
  const totalWorkingHours = header.working_hour ?? 1;
  const manpowerPresent = header.manpower_present ?? 0;
  const smv = header.smv ?? 1;
  const planEfficiencyPercent = header.plan_efficiency_percent ?? 0;
  const planEffDecimal = planEfficiencyPercent / 100;
  const targetFullDay = header.target_full_day ?? 0;

  const hoursOptions = Array.from(
    { length: Math.max(1, totalWorkingHours) },
    (_, i) => i + 1
  );

  const targetFromCapacity =
    manpowerPresent > 0 && smv > 0
      ? (manpowerPresent * 60 * planEffDecimal) / smv
      : 0;

  const targetFromFullDay =
    totalWorkingHours > 0 ? targetFullDay / totalWorkingHours : 0;

  const baseTargetPerHourRaw = targetFromCapacity || targetFromFullDay || 0;
  const baseTargetPerHour = Math.round(baseTargetPerHourRaw);

  const achievedThisHour = Math.round(Number(achievedInput) || 0);
  const selectedHourInt = Number(selectedHour) || 1;

  const hourlyEfficiency =
    manpowerPresent > 0 && smv > 0
      ? (achievedThisHour * smv * 100) / (manpowerPresent * 60)
      : 0;

  const recordsSorted = hourlyRecords
    .map((rec) => ({ ...rec, _hourNum: Number(rec.hour) }))
    .filter((rec) => Number.isFinite(rec._hourNum))
    .sort((a, b) => a._hourNum - b._hourNum);

  let runningAchieved = 0;

  const recordsDecorated = recordsSorted.map((rec) => {
    const hourN = rec._hourNum;

    const baselineToDatePrev = baseTargetPerHour * (hourN - 1);
    const cumulativeShortfallVsBasePrev = Math.max(
      0,
      baselineToDatePrev - runningAchieved
    );

    const dynTarget = baseTargetPerHour + cumulativeShortfallVsBasePrev;

    const achievedRounded = Math.round(toNum(rec.achievedQty, 0));

    const perHourVarDynamic = achievedRounded - dynTarget;

    runningAchieved += achievedRounded;

    const baselineToDate = baseTargetPerHour * hourN;
    const netVarVsBaseToDate = runningAchieved - baselineToDate;

    return {
      ...rec,
      _hourNum: hourN,
      _dynTargetRounded: Math.round(dynTarget),
      _achievedRounded: achievedRounded,
      _perHourVarDynamic: perHourVarDynamic,
      _netVarVsBaseToDate: netVarVsBaseToDate,
      _baselineToDatePrev: baselineToDatePrev,
      _cumulativeShortfallVsBasePrev: cumulativeShortfallVsBasePrev,
    };
  });

  // 👉 TOTALS for summary row
  const hasRecords = recordsDecorated.length > 0;

  const totalAchievedAll = hasRecords
    ? recordsDecorated.reduce(
        (sum, rec) => sum + (rec._achievedRounded ?? 0),
        0
      )
    : 0;

  const lastRecord = hasRecords
    ? recordsDecorated[recordsDecorated.length - 1]
    : null;

  const totalNetVarVsBaseToDate = lastRecord?._netVarVsBaseToDate ?? 0;
  const totalAvgEffPercent = hasRecords
    ? toNum(lastRecord?.totalEfficiency, 0)
    : 0;

  const previousDecorated = recordsDecorated.filter(
    (rec) => rec._hourNum < selectedHourInt
  );

  const achievedToDatePrev = previousDecorated.reduce(
    (sum, rec) => sum + (rec._achievedRounded ?? 0),
    0
  );

  const baselineToDatePrevForSelected =
    baseTargetPerHour * (selectedHourInt - 1);

  const cumulativeShortfallVsBasePrevForSelected = Math.max(
    0,
    baselineToDatePrevForSelected - achievedToDatePrev
  );

  const dynamicTargetThisHour = Math.round(
    baseTargetPerHour + cumulativeShortfallVsBasePrevForSelected
  );

  const achievedToDatePosted = recordsDecorated
    .filter((rec) => rec._hourNum <= selectedHourInt)
    .reduce((sum, rec) => sum + (rec._achievedRounded ?? 0), 0);

  const baselineToDateSelected = baseTargetPerHour * selectedHourInt;
  const netVarVsBaseToDateSelected =
    achievedToDatePosted - baselineToDateSelected;

  const previousRecord =
    previousDecorated.length > 0
      ? previousDecorated[previousDecorated.length - 1]
      : null;

  const previousVariance = previousRecord
    ? previousRecord._perHourVarDynamic
    : 0;

  const cumulativeVarianceDynamicPrev = previousDecorated.reduce(
    (sum, rec) => sum + (rec._perHourVarDynamic ?? 0),
    0
  );

  const totalAchievedBeforeSelected = previousDecorated.reduce(
    (sum, rec) => sum + (rec._achievedRounded ?? 0),
    0
  );
  const totalAchievedPreview =
    totalAchievedBeforeSelected + achievedThisHour;

  const achieveEfficiency =
    manpowerPresent > 0 && smv > 0 && selectedHourInt > 0
      ? (totalAchievedPreview * smv * 100) /
        (manpowerPresent * 60 * selectedHourInt)
      : 0;

  // ---------- save handler ----------
  const handleSave = async () => {
    try {
      setError("");
      setMessage("");

      if (!header?._id) {
        throw new Error("Missing headerId");
      }

      const hourNum = Number(selectedHour);

      const existing = hourlyRecords.find(
        (rec) => Number(rec.hour) === hourNum
      );
      if (existing) {
        setError(`You already saved data for hour ${hourNum}.`);
        return;
      }

      if (!Number.isFinite(achievedThisHour) || achievedThisHour < 0) {
        throw new Error("Please enter a valid achieved qty for this hour.");
      }

      if (!productionUserId) {
        throw new Error("Missing user id for productionUser.");
      }

      setSaving(true);

      const payload = {
        headerId: header._id,
        hour: hourNum,
        achievedQty: achievedThisHour,
        productionUser: {
          id: productionUserId,
          Production_user_name:
            auth?.user?.user_name || auth?.user_name || "Unknown",
          phone: auth?.phone || "",
          bio: auth?.role || "",
        },
      };

      const res = await fetch("/api/hourly-productions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json?.errors?.join(", ") ||
            json?.message ||
            "Failed to save hourly production record"
        );
      }

      // reload list
      const params = new URLSearchParams({
        headerId: header._id,
        productionUserId: productionUserId,
      });

      const resList = await fetch(
        `/api/hourly-productions?${params.toString()}`
      );
      const jsonList = await resList.json();
      if (resList.ok && jsonList.success) {
        setHourlyRecords(jsonList.data || []);
      }

      // 🔁 realtime WIP refresh after new production saved
      await refreshWip();

      setAchievedInput("");
      setMessage("Hourly record saved successfully.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save hourly record");
    } finally {
      setSaving(false);
    }
  };

  // ---------- Capacity save handler ----------
  const handleCapacitySave = async () => {
    try {
      setError("");
      setMessage("");

      if (!auth) {
        throw new Error("User not authenticated");
      }

      const capNum = Number(capacityInput);
      if (!Number.isFinite(capNum) || capNum < 0) {
        throw new Error("Capacity must be a non-negative number.");
      }

      const userId =
        auth?.user?.id || auth?.user?._id || auth?.id || auth?._id;

      if (!userId) {
        throw new Error("Missing user id for capacity user.");
      }

      setCapacitySaving(true);

      const payload = {
        assigned_building: header.assigned_building,
        line: header.line,
        buyer: header.buyer,
        style: header.style,
        date: header.date,
        capacity: capNum,
        user: {
          id: userId,
          user_name: auth?.user?.user_name || auth?.user_name || "Unknown",
          role: auth?.user?.role || auth?.role || "",
        },
      };

      const res = await fetch("/api/style-capacities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json?.errors?.join(", ") ||
            json?.message ||
            "Failed to save capacity."
        );
      }

      const savedDoc = json.data;

      setCapacityRecord(savedDoc);
      setCapacityInput(
        savedDoc?.capacity != null ? String(savedDoc.capacity) : ""
      );

      // 🔁 realtime WIP refresh after capacity change (if your WIP calc depends on it)
      await refreshWip();

      setMessage("Capacity saved/updated successfully.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save capacity.");
    } finally {
      setCapacitySaving(false);
    }
  };

  // ---------- UI ----------
  return (
    <div className="card bg-base-100 border border-base-200 shadow-sm">
      <div className="card-body w-full p-3 space-y-3">
        {/* Header summary */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-base-200 pb-2">
          <div className="space-y-1 text-xs">
            <div className="text-sm font-semibold tracking-wide text-slate-1000">
              {header.line} • {header.date}
            </div>
            <div className="text-[11px] text-slate-1000">
              <span className="font-semibold ">Buyer:</span> {header.buyer}
              <span className="mx-1 text-slate-1000">•</span>
              <span className="font-semibold">Style:</span> {header.style}
              <span className="mx-1 text-slate-1000">•</span>
              <span className="font-semibold">Color:</span>{" "}
              {header.color_model}
            </div>
            <div className="text-[11px] text-slate-1000">
              <span className="font-semibold">Run day:</span> {header.run_day}
              <span className="mx-1 text-slate-1000">•</span>
              <span className="font-semibold">Working hour:</span>{" "}
              {header.working_hour}h
            </div>
          </div>

          <div className="text-[11px] text-right text-slate-1000 space-y-0.5">
            <div>
              <span className="font-semibold text-slate-1000">
                Present MP:
              </span>{" "}
              {manpowerPresent}
            </div>
            <div>
              <span className="font-semibold text-slate-1000">
                Plan Eff:
              </span>{" "}
              {planEfficiencyPercent}%
            </div>
            <div>
              <span className="font-semibold text-slate-1000">SMV:</span>{" "}
              {smv}
            </div>
            <div>
              <span className="font-semibold text-slate-1000">
                Day Target:
              </span>{" "}
              {targetFullDay}
            </div>
          </div>
        </div>

        {/* Messages */}
        {(error || message) && (
          <div className="space-y-1 text-[11px]">
            {error && (
              <div className="alert alert-error py-1 px-2">
                <span>{error}</span>
              </div>
            )}
            {message && (
              <div className="alert alert-success py-1 px-2">
                <span>{message}</span>
              </div>
            )}
          </div>
        )}

        {/* Live data block */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] space-y-1.5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1">
            <span className="font-semibold text-slate-800">Live Data</span>
            <span className="text-[10px] text-slate-500">
              Hour {selectedHourInt} of {totalWorkingHours}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 ">
            <div>
              <span className="font-medium text-gray-700 ">
                Base Target / hr:
              </span>{" "}
              <span className="font-semibold text-slate-900 ">
                {formatNumber(baseTargetPerHour, 0)}
              </span>
            </div>

            <div>
              <span className="font-medium text-slate-600">
                Carry (shortfall vs base up to prev):
              </span>{" "}
              <span className="font-semibold text-amber-700">
                {formatNumber(
                  cumulativeShortfallVsBasePrevForSelected,
                  0
                )}
              </span>
            </div>

            <div className="sm:col-span-2">
              <span className="font-medium text-slate-600">
                Dynamic target this hour:
              </span>{" "}
              <span className="font-semibold text-blue-700">
                {formatNumber(dynamicTargetThisHour, 0)}
              </span>
            </div>

            <div className="sm:col-span-2">
              <span className="font-medium text-slate-600">
                Net variance vs base (to date):
              </span>{" "}
              <span
                className={`font-semibold ${
                  netVarVsBaseToDateSelected >= 0
                    ? "text-green-700"
                    : "text-red-700"
                }`}
              >
                {formatNumber(netVarVsBaseToDateSelected, 0)}
              </span>
            </div>

            <div className="sm:col-span-2">
              <span className="font-medium text-slate-600">
                Cumulative variance (prev vs dynamic):
              </span>{" "}
              <span
                className={`font-semibold ${
                  cumulativeVarianceDynamicPrev >= 0
                    ? "text-green-700"
                    : "text-red-700"
                }`}
              >
                {formatNumber(cumulativeVarianceDynamicPrev, 0)}
              </span>
            </div>

            {previousRecord && (
              <div className="sm:col-span-2">
                <span className="font-medium text-slate-600">
                  Last hour variance (Δ vs dynamic):
                </span>{" "}
                <span
                  className={`font-semibold ${
                    previousVariance >= 0
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  {formatNumber(previousVariance, 0)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Main input row */}
        <div className="overflow-x-auto">
          <table className="table table-xs w-full">
            <thead>
              <tr className="bg-base-200 text-[11px]">
                <th className="px-2 text-amber-600 ">Hour</th>
                <th className="px-2 text-amber-600">Base Target / hr</th>
                <th className="px-2 text-amber-600">
                  Dynamic Target (this hour)
                </th>
                <th className="px-2 text-amber-600">
                  Achieved Qty (this hour)
                </th>
                <th className="px-2 text-amber-600">Hourly Eff %</th>
                <th className="px-2 text-amber-600">AVG Eff % (preview)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-2 align-top">
                  <select
                    className="select select-xs select-bordered w-28 text-[11px]"
                    value={selectedHour}
                    onChange={(e) => setSelectedHour(Number(e.target.value))}
                  >
                    {hoursOptions.map((hVal) => (
                      <option key={hVal} value={hVal}>
                        {hVal} hr
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-gray-500">
                    Current hour (1 ~ {totalWorkingHours})
                  </p>
                </td>

                <td className="px-2 align-top">
                  <div className="rounded border  bg-gray-50 px-2 py-1 text-black text-[11px] border-amber-500">
                    {formatNumber(baseTargetPerHour, 0)}
                  </div>
                  <p className="mt-1 text-[10px] text-gray-500 leading-tight">
                    (MP × 60 × Plan% ÷ SMV)
                  </p>
                </td>

                <td className="px-2 align-top">
                  <div className="rounded border border-amber-500 bg-amber-50 px-2 py-1 text-black text-[11px]">
                    {formatNumber(dynamicTargetThisHour, 0)}
                  </div>
                  <p className="mt-1 text-[10px] text-amber-700 leading-tight">
                    Base + shortfall vs base (prev hours)
                  </p>
                </td>

                <td className="px-2 align-top">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="input input-xs input-bordered w-full text-[11px] border-amber-500"
                    value={achievedInput}
                    onChange={(e) => setAchievedInput(e.target.value)}
                    placeholder="Output this hour"
                  />
                  <p className="mt-1 text-[10px] text-gray-500">
                    Actual pieces this hour
                  </p>
                </td>

                <td className="px-2 align-top">
                  <div className="rounded border border-base-200 bg-gray-50 px-2 py-1 text-black text-[11px]">
                    {formatNumber(hourlyEfficiency)}
                  </div>
                  <p className="mt-1 text-[10px] text-gray-500 leading-tight ">
                    (Output × SMV × 100) ÷ (MP × 60)
                  </p>
                </td>

                <td className="px-2 align-top">
                  <div className="rounded border border-base-200 bg-gray-50 px-2 py-1 text-black text-[11px]">
                    {formatNumber(achieveEfficiency)}
                  </div>
                  <p className="mt-1 text-[10px] text-gray-500 leading-tight">
                    (Total produce min ÷ Total available min) × 100
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Save button */}
        <div className="flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={handleSave}
            className="btn btn-xs btn-primary px-3"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Hour"}
          </button>
        </div>

        {/* ✅ FIXED WIP BLOCK – no <td> inside <div> */}
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">WIP</span>

            <div className="flex items-center gap-3">
              <span className="text-slate-1000 font-bold"> Capacity   </span>
              <input
                type="number"
                min="0"
                step="1"
                className="input input-xxs input-bordered w-15 h-10 text-[12px] font-bold "
                value={capacityInput}
                onChange={(e) => setCapacityInput(e.target.value)}
                placeholder="0"
              />
              <button
                type="button"
                onClick={handleCapacitySave}
                className="btn btn-xs btn-primary"
                disabled={capacitySaving || wipLoading}
              >
                {capacitySaving ? "Saving..." : "Save / Update Capacity"}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-slate-600 mr-1">
                Produced ( With past days + Today ):
              </span>
              <span className="font-bold text-slate-1000">
                {wipLoading || capacityLoading
                  ? "..."
                  : wipInfo
                  ? formatNumber(wipInfo.totalAchieved, 0)
                  : "-"}
              </span>
            </div>

            <div>
              <span className="text-slate-1000 mr-1 ">WIP:</span>
              <span
                className={`font-bold ${
                  (wipInfo?.wip ?? 0) > 0
                    ? "text-amber-1000"
                    : "text-emerald-1000"
                }`}
              >
                {wipLoading || capacityLoading
                  ? "..."
                  : wipInfo
                  ? formatNumber(wipInfo.wip, 0)
                  : "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Posted hourly records */}
        <div className="mt-1">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <h3 className="font-semibold text-[12px]">
              Posted hourly records
            </h3>
            {loadingRecords && (
              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                <span className="loading loading-spinner loading-xs" />
                Loading...
              </span>
            )}
          </div>

          {recordsDecorated.length === 0 ? (
            <p className="text-[11px] text-slate-500">
              No hourly records saved yet for this header.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-xs w-full border-t">
                <thead>
                  <tr className="bg-base-200 text-[11px]">
                    <th className="px-2">Hour</th>
                    <th className="px-2">Target</th>
                    <th className="px-2">Achieved</th>
                    <th className="px-2">Δ Var (hr vs dynamic)</th>
                    <th className="px-2">Net Var vs Base (to date)</th>
                    <th className="px-2">Hourly Eff %</th>
                    <th className="px-2">Achieve Eff</th>
                    <th className="px-2">AVG Eff %</th>
                    <th className="px-2">Updated At</th>
                  </tr>
                </thead>
                <tbody>
                  {recordsDecorated.map((rec) => (
                    <tr key={rec._id} className="border-b text-[11px]">
                      <td className="px-2 py-1">{rec._hourNum}</td>
                      <td className="px-2 py-1">
                        {formatNumber(rec._dynTargetRounded, 0)}
                      </td>
                      <td className="px-2 py-1">{rec._achievedRounded}</td>
                      <td
                        className={`px-2 py-1 ${
                          (rec._perHourVarDynamic ?? 0) >= 0
                            ? "text-green-700"
                            : "text-red-700"
                        }`}
                      >
                        {formatNumber(rec._perHourVarDynamic ?? 0, 0)}
                      </td>
                      <td
                        className={`px-2 py-1 ${
                          (rec._netVarVsBaseToDate ?? 0) >= 0
                            ? "text-green-700"
                            : "text-red-700"
                        }`}
                      >
                        {formatNumber(rec._netVarVsBaseToDate ?? 0, 0)}
                      </td>
                      <td className="px-2 py-1">
                        {formatNumber(rec.hourlyEfficiency)}
                      </td>
                      <td className="px-2 py-1">
                        {formatNumber(rec.achieveEfficiency)}
                      </td>
                      <td className="px-2 py-1">
                        {formatNumber(rec.totalEfficiency)}
                      </td>
                      <td className="px-2 py-1">
                        {rec.updatedAt
                          ? new Date(rec.updatedAt).toLocaleTimeString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* ✅ SUMMARY ROW */}
                {hasRecords && (
                  <tfoot>
                    <tr className="bg-amber-300 text-[13px] font-bold ">
                      <td className="px-2 py-1">Total</td>
                      <td className="px-2 py-1 ">-</td>
                      {/* Total Achieved */}
                      <td className="px-1 py-1 ">
                        {formatNumber(totalAchievedAll, 0)}
                      </td>
                      <td className="px-2 py-1 ">-</td>
                      {/* Final Net Var vs Base (to date) */}
                      <td
                        className={`px-2 py-1  ${
                          totalNetVarVsBaseToDate >= 0
                            ? "text-green-700"
                            : "text-red-700"
                        }`}
                      >
                        {formatNumber(totalNetVarVsBaseToDate, 0)}
                      </td>
                      <td className="px-2 py-1 ">-</td>
                      <td className="px-2 py-1">-</td>
                      {/* Final AVG Eff % (overall) */}
                      <td className="px-2 py-1">
                        {formatNumber(totalAvgEffPercent)}
                      </td>
                      <td className="px-2 py-1">-</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
