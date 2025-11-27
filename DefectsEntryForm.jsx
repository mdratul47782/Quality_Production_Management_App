"use client";
import { useAuth } from "@/app/hooks/useAuth";
import React, { useEffect, useMemo, useState } from "react";

// -------- helpers --------
const hourOptions = ["1st Hour", "2nd Hour", "3rd Hour", "4th Hour"];

const defectOptions = [
  "301 - OPEN SEAM",
  "302 - SKIP STITCH",
  "303 - RUN OFF STITCH",
];

const lineOptions = ["Line-1", "Line-2", "Line-3"];

function toLocalDateLabel(d = new Date()) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function todayIsoForApi() {
  return new Date().toISOString();
}

function getUserIdFromAuth(auth) {
  return auth?.user?.id || auth?.user?._id || auth?.id || auth?._id || null;
}

// Searchable Defect Picker Component (dark themed)
function SearchableDefectPicker({
  options,
  onSelect,
  placeholder = "Search defect by name...",
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [hi, setHi] = React.useState(0);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 50);
    return options.filter((o) => o.toLowerCase().includes(q)).slice(0, 50);
  }, [query, options]);

  React.useEffect(() => {
    setHi(0);
  }, [query, open]);

  const selectValue = (val) => {
    onSelect(val);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter"))
            setOpen(true);
          if (!filtered.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHi((i) => Math.min(i + 1, filtered.length - 1));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((i) => Math.max(i - 1, 0));
          }
          if (e.key === "Enter") {
            e.preventDefault();
            selectValue(filtered[hi]);
          }
          if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="w-full rounded-xl border border-emerald-500/30 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />

      {open && (
        <div className="absolute z-20 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-slate-700 bg-slate-900/95 shadow-xl backdrop-blur">
          {filtered.length ? (
            filtered.map((opt, idx) => (
              <button
                type="button"
                key={opt}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectValue(opt)}
                className={`block w-full px-3 py-2 text-left text-sm transition ${
                  idx === hi
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "text-slate-200 hover:bg-slate-800/80"
                }`}
              >
                {opt}
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-sm text-slate-400">No results</div>
          )}
        </div>
      )}
    </div>
  );
}

// Main Endline Dashboard Component
export default function EndlineDashboard() {
  const { auth } = useAuth();

  // ---- form state ----
  const [form, setForm] = useState({
    hour: "",
    line: "",
    selectedDefects: [],
    inspectedQty: "",
    passedQty: "",
    defectivePcs: "",
    afterRepair: "",
  });

  // ---- edit mode ----
  const [editingId, setEditingId] = useState(null);

  // ---- right panel ----
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const todayLabel = useMemo(() => toLocalDateLabel(), []);
  const userId = useMemo(() => getUserIdFromAuth(auth), [auth]);

  useEffect(() => {
    if (!auth) return;
    fetchToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  const fetchToday = async () => {
    try {
      setLoading(true);
      setError("");
      const dateParam = todayIsoForApi();
      const building = auth?.assigned_building || auth?.building || "";
      let url = `/api/hourly-inspections?date=${encodeURIComponent(
        dateParam
      )}&limit=500`;
      if (userId) url += `&userId=${userId}`;
      if (building) url += `&building=${encodeURIComponent(building)}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Failed to load data");
      setRows(json?.data || []);
    } catch (e) {
      setError(e.message || "Load error");
      showToast(e.message || "Load error", "error");
    } finally {
      setLoading(false);
    }
  };

  // ---- form field handler ----
  const setField = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // ---- handle defect quantity change ----
  const handleDefectQty = (index, value) => {
    setForm((prev) => {
      const updatedDefects = [...prev.selectedDefects];
      updatedDefects[index].quantity = value;
      return { ...prev, selectedDefects: updatedDefects };
    });
  };

  // ---- select defect ----
  const handleSelectDefect = (defect) => {
    if (!defect) return;
    setForm((prev) => {
      const currentDefects = prev.selectedDefects || [];
      if (!currentDefects.some((d) => d.name === defect)) {
        return {
          ...prev,
          selectedDefects: [...currentDefects, { name: defect, quantity: "" }],
        };
      }
      return prev;
    });
  };

  // ---- remove defect ----
  const removeDefect = (index) => {
    setForm((prev) => {
      const updatedDefects = [...prev.selectedDefects];
      updatedDefects.splice(index, 1);
      return { ...prev, selectedDefects: updatedDefects };
    });
  };

  // ---- handle edit ----
  const handleEdit = (row) => {
    setEditingId(row._id);
    setForm({
      hour: row.hourLabel || "",
      line: row.line || "",
      selectedDefects: Array.isArray(row.selectedDefects)
        ? row.selectedDefects.map((d) => ({
            name: d.name || "",
            quantity: String(d.quantity || ""),
          }))
        : [],
      inspectedQty: String(row.inspectedQty || ""),
      passedQty: String(row.passedQty || ""),
      defectivePcs: String(row.defectivePcs || ""),
      afterRepair: String(row.afterRepair || ""),
    });
  };

  // ---- handle delete ----
  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    try {
      setDeleting(id);
      const res = await fetch(`/api/hourly-inspections?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Failed to delete");

      showToast("Entry deleted successfully!", "success");
      await fetchToday();
    } catch (e) {
      showToast(e.message || "Delete failed", "error");
    } finally {
      setDeleting(null);
    }
  };

  const save = async () => {
    const msg = validate();
    if (msg) {
      showToast(msg, "error");
      return;
    }

    // ---- DUPLICATE VALIDATION ----
    const isDuplicate = rows.some(
      (row) =>
        row.hourLabel === form.hour &&
        row.line === form.line &&
        row.building === (auth?.assigned_building || auth?.building || "") &&
        row._id !== editingId
    );

    if (isDuplicate && !editingId) {
      showToast(
        `An entry for ${form.hour} - ${form.line} already exists. Please edit the existing entry instead of creating a new one.`,
        "error"
      );
      return;
    }
    // ---- END DUPLICATE VALIDATION ----

    if (!userId) {
      showToast("Missing user identity (auth).", "error");
      return;
    }

    try {
      setSaving(true);

      const building = auth?.assigned_building || auth?.building || "";
      if (!building) {
        showToast(
          "Building information is missing. Please login again.",
          "error"
        );
        return;
      }

      const payload = {
        hour: form.hour,
        line: form.line,
        building: building,
        inspectedQty: Number(form.inspectedQty || 0),
        passedQty: Number(form.passedQty || 0),
        defectivePcs: Number(form.defectivePcs || 0),
        afterRepair: Number(form.afterRepair || 0),
        selectedDefects: (form.selectedDefects || []).map((d) => ({
          name: d.name,
          quantity: Number(d.quantity || 0),
        })),
      };

      let res;

      if (editingId) {
        // Update existing entry
        res = await fetch(`/api/hourly-inspections?id=${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) {
          console.error("Update error:", json);
          throw new Error(json?.message || "Failed to update");
        }
        showToast("Entry updated successfully!", "success");
      } else {
        // Create new entry
        const requestBody = {
          userId: userId,
          userName: auth?.user_name || auth?.user?.user_name || "User",
          building: building,
          entries: [payload],
          reportDate: new Date().toISOString(),
        };

        console.log("Sending POST request:", requestBody);

        res = await fetch("/api/hourly-inspections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        const responseText = await res.text();
        console.log("POST response status:", res.status);
        console.log("POST response text (raw):", responseText);

        let json = {};
        try {
          json =
            responseText && responseText.trim()
              ? JSON.parse(responseText)
              : {};
        } catch (parseError) {
          console.error("Failed to parse response as JSON:", parseError);
          console.error("Response text was:", responseText);
          throw new Error(
            `Invalid response from server: ${responseText.substring(0, 100)}`
          );
        }

        console.log("POST response parsed:", json);

        if (!res.ok) {
          console.error("Save error - Status:", res.status);
          console.error("Save error - Response text:", responseText);
          console.error("Save error - Parsed JSON:", json);

          const errorMessage =
            json?.message ||
            json?.error ||
            (responseText &&
            responseText.length > 0 &&
            !responseText.startsWith("{")
              ? responseText
              : null) ||
            `Failed to save (Status: ${res.status})`;
          throw new Error(errorMessage);
        }
        showToast("Entry created successfully!", "success");
      }

      await fetchToday();
      resetForm();
    } catch (e) {
      showToast(e.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const validate = () => {
    if (!form.hour) return "Please select Working Hour.";
    if (!form.line) return "Please select Line.";
    return "";
  };

  const resetForm = () => {
    setForm({
      hour: "",
      line: "",
      selectedDefects: [],
      inspectedQty: "",
      passedQty: "",
      defectivePcs: "",
      afterRepair: "",
    });
    setEditingId(null);
  };

  const showToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ---- GLOBAL SUMMARY (for top cards) ----
  const {
    totalInspected,
    totalPassed,
    totalDefects,
    globalRFT,
    distinctLines,
  } = useMemo(() => {
    if (!rows || !rows.length) {
      return {
        totalInspected: 0,
        totalPassed: 0,
        totalDefects: 0,
        globalRFT: 0,
        distinctLines: 0,
      };
    }

    let inspected = 0;
    let passed = 0;
    let defects = 0;
    const lineSet = new Set();

    rows.forEach((r) => {
      inspected += r.inspectedQty || 0;
      passed += r.passedQty || 0;
      defects += r.totalDefects || 0;
      if (r.line) lineSet.add(r.line);
    });

    const rft = inspected > 0 ? (passed / inspected) * 100 : 0;

    return {
      totalInspected: inspected,
      totalPassed: passed,
      totalDefects: defects,
      globalRFT: Number(rft.toFixed(1)),
      distinctLines: lineSet.size,
    };
  }, [rows]);

  const rftColor =
    globalRFT >= 95
      ? "text-emerald-400"
      : globalRFT >= 90
      ? "text-amber-300"
      : "text-rose-400";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      {toast && (
        <div className="fixed right-4 top-4 z-50">
          <div
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ${
              toast.type === "success"
                ? "border-emerald-500/40 bg-slate-900/90 text-emerald-100"
                : toast.type === "error"
                ? "border-rose-500/40 bg-slate-900/90 text-rose-100"
                : "border-sky-500/40 bg-slate-900/90 text-sky-100"
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

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {/* Top hero + summary cards */}
        <div className="mb-6 rounded-3xl border border-emerald-500/20 bg-slate-900/80 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.45)] md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-400/80">
                Quality · Endline Inspection
              </p>
              <h1 className="mt-2 text-2xl font-semibold md:text-3xl">
                Endline Hourly Dashboard
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                {auth?.user_name || "User"}{" "}
                {auth?.assigned_building && (
                  <span className="text-slate-200">
                    · {auth.assigned_building}
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-slate-500">Today: {todayLabel}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                {rows.length} hour entries
              </span>
              <button
                onClick={fetchToday}
                className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-100 shadow-sm transition hover:border-emerald-500/60 hover:bg-slate-800"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* stats cards */}
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 shadow-sm">
              <div className="pointer-events-none absolute -right-6 -top-4 h-16 w-16 rounded-full bg-emerald-500/15 blur-xl" />
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Inspected Today
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-50">
                {totalInspected}
              </p>
              <p className="mt-1 text-xs text-slate-500">Across all hours</p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent px-4 py-3 shadow-sm">
              <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-emerald-400/25 blur-2xl" />
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-200/90">
                RFT %
              </p>
              <p className={`mt-1 text-2xl font-semibold ${rftColor}`}>
                {globalRFT}%
              </p>
              <p className="mt-1 text-xs text-emerald-100/80">
                {totalPassed} pcs passed
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 shadow-sm">
              <div className="pointer-events-none absolute -right-6 -top-4 h-16 w-16 rounded-full bg-rose-500/15 blur-xl" />
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Total Defects
              </p>
              <p className="mt-1 text-xl font-semibold text-rose-300">
                {totalDefects}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Sum of all defect types
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 shadow-sm">
              <div className="pointer-events-none absolute -right-6 -top-4 h-16 w-16 rounded-full bg-sky-500/15 blur-xl" />
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Active Lines
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-50">
                {distinctLines || 0}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Reporting inspections today
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
          {/* Left: Form */}
          <div className="md:sticky md:top-6 md:h-fit">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl md:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-200">
                  {editingId ? "Edit Hour Entry" : "Add New Hour Entry"}
                </h2>
                {editingId && (
                  <button
                    onClick={resetForm}
                    className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-300"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              {/* Line Picker */}
              <div className="mb-3">
                <label className="mb-1 block text-[11px] font-medium text-slate-300">
                  Select Line
                </label>
                <select
                  value={form.line}
                  onChange={(e) => setField("line", e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  <option value="">Select Line</option>
                  {lineOptions.map((line) => (
                    <option key={line} value={line}>
                      {line}
                    </option>
                  ))}
                </select>
              </div>

              {/* Hour Picker */}
              <div className="mb-3">
                <label className="mb-1 block text-[11px] font-medium text-slate-300">
                  Working Hour
                </label>
                <select
                  value={form.hour}
                  onChange={(e) => setField("hour", e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  <option value="">Select Hour</option>
                  {hourOptions.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Add Defect */}
              <div className="mb-3">
                <label className="mb-1 block text-[11px] font-medium text-slate-300">
                  Add Defect
                </label>
                <SearchableDefectPicker
                  options={defectOptions}
                  onSelect={handleSelectDefect}
                />
              </div>

              {/* Selected Defects */}
              {form.selectedDefects.length > 0 && (
                <div className="mb-3 space-y-1.5">
                  {form.selectedDefects.map((d, i) => (
                    <div
                      key={`${d.name}-${i}`}
                      className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-2.5 py-1.5"
                    >
                      <span className="flex-1 truncate text-xs font-medium text-slate-100">
                        {d.name}
                      </span>
                      <input
                        type="number"
                        min="0"
                        placeholder="Qty"
                        value={d.quantity}
                        onChange={(e) => handleDefectQty(i, e.target.value)}
                        className="w-16 rounded-lg border border-slate-700 bg-slate-900/80 px-1.5 py-0.5 text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeDefect(i)}
                        className="rounded-lg border border-slate-700 px-2 py-0.5 text-xs text-slate-300 transition hover:border-rose-500 hover:bg-rose-500/10 hover:text-rose-200"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-300">
                    Inspected Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.inspectedQty}
                    onChange={(e) => setField("inspectedQty", e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-300">
                    Passed Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.passedQty}
                    onChange={(e) => setField("passedQty", e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-300">
                    Defective Pcs
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.defectivePcs}
                    onChange={(e) => setField("defectivePcs", e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-300">
                    After Repair
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.afterRepair}
                    onChange={(e) => setField("afterRepair", e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingId ? "Update" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Right: Entries */}
          <div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl md:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-200">
                  Today&apos;s Entries ({rows.length})
                </h2>
                {loading && (
                  <span className="text-xs text-slate-500">Loading...</span>
                )}
              </div>

              {rows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
                  No entries yet for {todayLabel}.
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Group entries by line */}
                  {lineOptions.map((line) => {
                    const lineEntries = rows.filter((r) => r.line === line);

                    if (lineEntries.length === 0) return null;

                    const lineInspected = lineEntries.reduce(
                      (acc, r) => acc + (r.inspectedQty || 0),
                      0
                    );
                    const linePassed = lineEntries.reduce(
                      (acc, r) => acc + (r.passedQty || 0),
                      0
                    );
                    const lineDefects = lineEntries.reduce(
                      (acc, r) => acc + (r.totalDefects || 0),
                      0
                    );
                    const lineRFT =
                      lineInspected > 0
                        ? ((linePassed / lineInspected) * 100).toFixed(1)
                        : 0;

                    const lineRftColor =
                      lineRFT >= 95
                        ? "text-emerald-400"
                        : lineRFT >= 90
                        ? "text-amber-300"
                        : "text-rose-400";

                    return (
                      <div
                        key={line}
                        className="border-b border-slate-800 pb-4 last:border-b-0 last:pb-0"
                      >
                        {/* Line Header with Metrics */}
                        <div className="mb-3 rounded-2xl border border-emerald-500/25 bg-slate-900/80 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <h3 className="text-sm font-semibold text-slate-100">
                                {line} - Hourly Entries
                              </h3>
                              <span className="rounded-full bg-slate-900/80 px-2 py-1 text-xs text-slate-400">
                                {lineEntries.length}{" "}
                                {lineEntries.length === 1 ? "entry" : "entries"}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-4">
                              <div className="text-center">
                                <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                                  Inspected
                                </div>
                                <div className="text-sm font-semibold text-sky-300">
                                  {lineInspected}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                                  Passed
                                </div>
                                <div className="text-sm font-semibold text-emerald-300">
                                  {linePassed}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                                  Defects
                                </div>
                                <div className="text-sm font-semibold text-rose-300">
                                  {lineDefects}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                                  RFT%
                                </div>
                                <div
                                  className={`text-sm font-semibold ${lineRftColor}`}
                                >
                                  {lineRFT}%
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Entries for this line */}
                        <ul className="space-y-3">
                          {lineEntries.map((r) => (
                            <li
                              key={r._id}
                              className={`rounded-2xl border p-3 transition ${
                                editingId === r._id
                                  ? "border-emerald-500 bg-emerald-500/10"
                                  : "border-slate-800 bg-slate-900/60 hover:border-emerald-500/40 hover:bg-slate-900"
                              }`}
                            >
                              <div className="mb-1 flex items-center justify-between">
                                <div className="text-sm font-semibold text-slate-100">
                                  {r.hourLabel}
                                  {r.building && ` (${r.building})`}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500">
                                    {new Date(
                                      r.updatedAt || r.createdAt
                                    ).toLocaleTimeString()}
                                  </span>
                                  <button
                                    onClick={() => handleEdit(r)}
                                    className="rounded-lg bg-slate-800 px-2 py-0.5 text-xs text-slate-100 transition hover:bg-emerald-500/20 hover:text-emerald-200"
                                    title="Edit"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDelete(r._id)}
                                    disabled={deleting === r._id}
                                    className="rounded-lg bg-slate-800 px-2 py-0.5 text-xs text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
                                    title="Delete"
                                  >
                                    {deleting === r._id ? "..." : "Delete"}
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs text-slate-200 md:grid-cols-5">
                                <div>
                                  <span className="text-slate-400">
                                    Inspected:
                                  </span>{" "}
                                  {r.inspectedQty}
                                </div>
                                <div>
                                  <span className="text-slate-400">
                                    Passed:
                                  </span>{" "}
                                  {r.passedQty}
                                </div>
                                <div>
                                  <span className="text-slate-400">
                                    Def.Pcs:
                                  </span>{" "}
                                  {r.defectivePcs}
                                </div>
                                <div>
                                  <span className="text-slate-400">
                                    After Repair:
                                  </span>{" "}
                                  {r.afterRepair}
                                </div>
                                <div>
                                  <span className="text-slate-400">
                                    Total Defects:
                                  </span>{" "}
                                  {r.totalDefects}
                                </div>
                              </div>
                              {Array.isArray(r.selectedDefects) &&
                                r.selectedDefects.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {r.selectedDefects.map((d, i) => (
                                      <span
                                        key={`${d.name}-${i}`}
                                        className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200"
                                      >
                                        {d.name}: {d.quantity}
                                      </span>
                                    ))}
                                  </div>
                                )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}

                  {/* Show entries without line (if any) */}
                  {(() => {
                    const noLineEntries = rows.filter(
                      (r) => !r.line || !lineOptions.includes(r.line)
                    );
                    if (noLineEntries.length === 0) return null;

                    const otherInspected = noLineEntries.reduce(
                      (acc, r) => acc + (r.inspectedQty || 0),
                      0
                    );
                    const otherPassed = noLineEntries.reduce(
                      (acc, r) => acc + (r.passedQty || 0),
                      0
                    );
                    const otherDefects = noLineEntries.reduce(
                      (acc, r) => acc + (r.totalDefects || 0),
                      0
                    );
                    const otherRFT =
                      otherInspected > 0
                        ? ((otherPassed / otherInspected) * 100).toFixed(1)
                        : 0;

                    const otherRftColor =
                      otherRFT >= 95
                        ? "text-emerald-400"
                        : otherRFT >= 90
                        ? "text-amber-300"
                        : "text-rose-400";

                    return (
                      <div className="border-b border-slate-800 pb-4 last:border-b-0 last:pb-0">
                        {/* Other Entries Header with Metrics */}
                        <div className="mb-3 rounded-2xl border border-amber-500/25 bg-slate-900/80 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <h3 className="text-sm font-semibold text-slate-100">
                                Other Entries
                              </h3>
                              <span className="rounded-full bg-slate-900/80 px-2 py-1 text-xs text-slate-400">
                                {noLineEntries.length}{" "}
                                {noLineEntries.length === 1
                                  ? "entry"
                                  : "entries"}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-4">
                              <div className="text-center">
                                <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                                  Inspected
                                </div>
                                <div className="text-sm font-semibold text-sky-300">
                                  {otherInspected}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                                  Passed
                                </div>
                                <div className="text-sm font-semibold text-emerald-300">
                                  {otherPassed}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                                  Defects
                                </div>
                                <div className="text-sm font-semibold text-rose-300">
                                  {otherDefects}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                                  RFT%
                                </div>
                                <div
                                  className={`text-sm font-semibold ${otherRftColor}`}
                                >
                                  {otherRFT}%
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <ul className="space-y-3">
                          {noLineEntries.map((r) => (
                            <li
                              key={r._id}
                              className={`rounded-2xl border p-3 transition ${
                                editingId === r._id
                                  ? "border-emerald-500 bg-emerald-500/10"
                                  : "border-slate-800 bg-slate-900/60 hover:border-emerald-500/40 hover:bg-slate-900"
                              }`}
                            >
                              <div className="mb-1 flex items-center justify-between">
                                <div className="text-sm font-semibold text-slate-100">
                                  {r.hourLabel} - {r.line || "No Line"}{" "}
                                  {r.building && `(${r.building})`}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500">
                                    {new Date(
                                      r.updatedAt || r.createdAt
                                    ).toLocaleTimeString()}
                                  </span>
                                  <button
                                    onClick={() => handleEdit(r)}
                                    className="rounded-lg bg-slate-800 px-2 py-0.5 text-xs text-slate-100 transition hover:bg-emerald-500/20 hover:text-emerald-200"
                                    title="Edit"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDelete(r._id)}
                                    disabled={deleting === r._id}
                                    className="rounded-lg bg-slate-800 px-2 py-0.5 text-xs text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
                                    title="Delete"
                                  >
                                    {deleting === r._id ? "..." : "Delete"}
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs text-slate-200 md:grid-cols-5">
                                <div>
                                  <span className="text-slate-400">
                                    Inspected:
                                  </span>{" "}
                                  {r.inspectedQty}
                                </div>
                                <div>
                                  <span className="text-slate-400">
                                    Passed:
                                  </span>{" "}
                                  {r.passedQty}
                                </div>
                                <div>
                                  <span className="text-slate-400">
                                    Def.Pcs:
                                  </span>{" "}
                                  {r.defectivePcs}
                                </div>
                                <div>
                                  <span className="text-slate-400">
                                    After Repair:
                                  </span>{" "}
                                  {r.afterRepair}
                                </div>
                                <div>
                                  <span className="text-slate-400">
                                    Total Defects:
                                  </span>{" "}
                                  {r.totalDefects}
                                </div>
                              </div>
                              {Array.isArray(r.selectedDefects) &&
                                r.selectedDefects.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {r.selectedDefects.map((d, i) => (
                                      <span
                                        key={`${d.name}-${i}`}
                                        className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200"
                                      >
                                        {d.name}: {d.quantity}
                                      </span>
                                    ))}
                                  </div>
                                )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
