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

// Searchable Defect Picker Component
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
        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm "
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />

      {open && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow text-black">
          {filtered.length ? (
            filtered.map((opt, idx) => (
              <button
                type="button"
                key={opt}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectValue(opt)}
                className={`block w-full text-left px-2 py-1.5 text-sm ${
                  idx === hi
                    ? "bg-emerald-50 text-emerald-700"
                    : "hover:bg-gray-50"
                }`}
              >
                {opt}
              </button>
            ))
          ) : (
            <div className="px-2 py-2 text-sm text-gray-500">No results</div>
          )}
        </div>
      )}
    </div>
  );
}

// Main Endline Dashboard Component
export default function EndlineDashboard() {
  const { auth } = useAuth();

  // ---- helpers from auth ----
  const userId = useMemo(() => getUserIdFromAuth(auth), [auth]);
  const todayLabel = useMemo(() => toLocalDateLabel(), []);

  const getBuilding = () =>
    auth?.assigned_building || auth?.building || "";
  const getFactory = () =>
    auth?.factory || auth?.assigned_factory || "";

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

  const [editingId, setEditingId] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

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
      const building = getBuilding();
      const factory = getFactory();

      let url = `/api/hourly-inspections?date=${encodeURIComponent(
        dateParam
      )}&limit=500`;
      if (userId) url += `&userId=${userId}`;
      if (building) url += `&building=${encodeURIComponent(building)}`;
      if (factory) url += `&factory=${encodeURIComponent(factory)}`;

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

  // ---- form helpers ----
  const setField = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleDefectQty = (index, value) => {
    setForm((prev) => {
      const updatedDefects = [...prev.selectedDefects];
      updatedDefects[index].quantity = value;
      return { ...prev, selectedDefects: updatedDefects };
    });
  };

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

  const removeDefect = (index) => {
    setForm((prev) => {
      const updatedDefects = [...prev.selectedDefects];
      updatedDefects.splice(index, 1);
      return { ...prev, selectedDefects: updatedDefects };
    });
  };

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

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    try {
      setDeleting(id);
      const factory = getFactory();
      const url = `/api/hourly-inspections?id=${id}${
        factory ? `&factory=${encodeURIComponent(factory)}` : ""
      }`;

      const res = await fetch(url, {
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

  const validate = () => {
    if (!form.hour) return "Please select Working Hour.";
    if (!form.line) return "Please select Line.";
    return "";
  };

  const save = async () => {
    const msg = validate();
    if (msg) {
      showToast(msg, "error");
      return;
    }

    // duplicate check (per building + line + hour in current list)
    const isDuplicate = rows.some(
      (row) =>
        row.hourLabel === form.hour &&
        row.line === form.line &&
        row.building === getBuilding() &&
        row._id !== editingId
    );

    if (isDuplicate && !editingId) {
      showToast(
        `An entry for ${form.hour} - ${form.line} already exists. Please edit the existing entry instead of creating a new one.`,
        "error"
      );
      return;
    }

    if (!userId) {
      showToast("Missing user identity (auth).", "error");
      return;
    }

    try {
      setSaving(true);

      const building = getBuilding();
      const factory = getFactory();

      if (!building) {
        showToast(
          "Building information is missing. Please login again.",
          "error"
        );
        return;
      }
      if (!factory) {
        showToast(
          "Factory information is missing. Please login again.",
          "error"
        );
        return;
      }

      const payload = {
        hour: form.hour,
        line: form.line,
        building,
        factory,
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
      let json;

      if (editingId) {
        const url = `/api/hourly-inspections?id=${editingId}${
          factory ? `&factory=${encodeURIComponent(factory)}` : ""
        }`;

        res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        json = await res.json();
        if (!res.ok) {
          console.error("Update error:", json);
          throw new Error(json?.message || "Failed to update");
        }
        showToast("Entry updated successfully!", "success");
      } else {
        const requestBody = {
          userId: userId,
          userName: auth?.user_name || auth?.user?.user_name || "User",
          building,
          factory,
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

        let parsedJson = {};
        try {
          parsedJson =
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

        json = parsedJson;
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
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
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-black">
              Endline Hourly Dashboard —{" "}
              <span className="text-indigo-600">
                {auth?.user_name || "User"}{" "}
                {auth?.factory && `| Factory: ${auth.factory}`}{" "}
                {auth?.assigned_building && `(${auth.assigned_building})`}
              </span>
            </h1>
            <p className="text-sm text-gray-600">Today: {todayLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchToday}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-black text-sm hover:bg-gray-100"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}


        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Left: Form */}
          <div className="md:sticky md:top-4 md:h-fit">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-black">
                  {editingId ? "Edit Hour Entry" : "Add New Hour Entry"}
                </h2>
                {editingId && (
                  <button
                    onClick={resetForm}
                    className="text-xs text-gray-500 hover:text-black underline"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              {/* Line Picker */}
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-black">
                  Select Line
                </label>
                <select
                  value={form.line}
                  onChange={(e) => setField("line", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
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
                <label className="mb-1 block text-xs font-medium text-black">
                  Working Hour
                </label>
                <select
                  value={form.hour}
                  onChange={(e) => setField("hour", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
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
                <label className="mb-1 block text-xs font-medium text-black">
                  Add Defect
                </label>
                <SearchableDefectPicker
                  options={defectOptions}
                  onSelect={handleSelectDefect}
                />
              </div>

              {/* Selected Defects */}
              {form.selectedDefects.length > 0 && (
                <div className="mb-3 space-y-1">
                  {form.selectedDefects.map((d, i) => (
                    <div
                      key={`${d.name}-${i}`}
                      className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1"
                    >
                      <span className="flex-1 truncate text-xs font-medium text-black">
                        {d.name}
                      </span>
                      <input
                        type="number"
                        min="0"
                        placeholder="Qty"
                        value={d.quantity}
                        onChange={(e) => handleDefectQty(i, e.target.value)}
                        className="w-16 rounded border border-gray-300 px-1 py-0.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => removeDefect(i)}
                        className="rounded border border-gray-300 px-2 py-0.5 text-xs text-black hover:bg-gray-200"
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
                  <label className="mb-1 block text-xs font-medium text-black">
                    Inspected Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.inspectedQty}
                    onChange={(e) => setField("inspectedQty", e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-black">
                    Passed Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.passedQty}
                    onChange={(e) => setField("passedQty", e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-black">
                    Defective Pcs
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.defectivePcs}
                    onChange={(e) => setField("defectivePcs", e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-black">
                    After Repair
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.afterRepair}
                    onChange={(e) => setField("afterRepair", e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingId ? "Update" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-100"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
          {/* Right: Entries */}
          <div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-black">
                  Today&apos;s Entries ({rows.length})
                </h2>
                {loading && (
                  <span className="text-xs text-gray-500">Loading...</span>
                )}
              </div>

              {rows.length === 0 ? (
                <div className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  No entries yet for {todayLabel}.
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Group entries by line */}
                  {lineOptions.map((line) => {
                    const lineEntries = rows.filter((r) => r.line === line);

                    if (lineEntries.length === 0) return null;

                    const lineInspected = lineEntries.reduce((acc, r) => acc + (r.inspectedQty || 0), 0);
                    const linePassed = lineEntries.reduce((acc, r) => acc + (r.passedQty || 0), 0);
                    const lineDefects = lineEntries.reduce((acc, r) => acc + (r.totalDefects || 0), 0);
                    const lineRFT = lineInspected > 0 ? ((linePassed / lineInspected) * 100).toFixed(1) : 0;

                    return (
                      <div key={line} className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                        {/* Line Header with Metrics */}
                        <div className="mb-3 rounded-lg border border-blue-300 bg-blue-200 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <h3 className="text-sm font-semibold text-gray-800">
                                {line} - Hourly Entries
                              </h3>
                              <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                                {lineEntries.length} {lineEntries.length === 1 ? 'entry' : 'entries'}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-4">
                              <div className="text-center">
                                <div className="text-xs text-gray-500">Inspected</div>
                                <div className="text-sm font-semibold text-blue-600">{lineInspected}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-gray-500">Passed</div>
                                <div className="text-sm font-semibold text-green-600">{linePassed}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-gray-500">Defects</div>
                                <div className="text-sm font-semibold text-red-600">{lineDefects}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-gray-500">RFT%</div>
                                <div className={`text-sm font-semibold ${lineRFT >= 95 ? 'text-green-600' :
                                  lineRFT >= 90 ? 'text-yellow-600' : 'text-red-600'
                                  }`}>
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
                              className={`rounded border p-3 ${editingId === r._id
                                ? "border-indigo-300 bg-indigo-50"
                                : "border-gray-200 hover:bg-gray-50"
                                }`}
                            >
                              <div className="mb-1 flex items-center justify-between">
                                <div className="text-sm font-semibold text-gray-800">
                                  {r.hourLabel}
                                  {r.building && ` (${r.building})`}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">
                                    {new Date(
                                      r.updatedAt || r.createdAt
                                    ).toLocaleTimeString()}
                                  </span>
                                  <button
                                    onClick={() => handleEdit(r)}
                                    className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-200"
                                    title="Edit"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDelete(r._id)}
                                    disabled={deleting === r._id}
                                    className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 hover:bg-red-200 disabled:opacity-50"
                                    title="Delete"
                                  >
                                    {deleting === r._id ? "..." : "Delete"}
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs text-black md:grid-cols-5">
                                <div>
                                  <span className="text-gray-500">Inspected:</span>{" "}
                                  {r.inspectedQty}
                                </div>
                                <div>
                                  <span className="text-gray-500">Passed:</span>{" "}
                                  {r.passedQty}
                                </div>
                                <div>
                                  <span className="text-gray-500">Def.Pcs:</span>{" "}
                                  {r.defectivePcs}
                                </div>
                                <div>
                                  <span className="text-gray-500">After Repair:</span>{" "}
                                  {r.afterRepair}
                                </div>
                                <div>
                                  <span className="text-gray-500">Total Defects:</span>{" "}
                                  {r.totalDefects}
                                </div>
                              </div>
                              {Array.isArray(r.selectedDefects) &&
                                r.selectedDefects.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {r.selectedDefects.map((d, i) => (
                                      <span
                                        key={`${d.name}-${i}`}
                                        className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-black"
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
                    const noLineEntries = rows.filter((r) => !r.line || !lineOptions.includes(r.line));
                    if (noLineEntries.length === 0) return null;

                    const otherInspected = noLineEntries.reduce((acc, r) => acc + (r.inspectedQty || 0), 0);
                    const otherPassed = noLineEntries.reduce((acc, r) => acc + (r.passedQty || 0), 0);
                    const otherDefects = noLineEntries.reduce((acc, r) => acc + (r.totalDefects || 0), 0);
                    const otherRFT = otherInspected > 0 ? ((otherPassed / otherInspected) * 100).toFixed(1) : 0;

                    return (
                      <div className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                        {/* Other Entries Header with Metrics */}
                        <div className="mb-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <h3 className="text-sm font-semibold text-gray-800">
                                Other Entries
                              </h3>
                              <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                                {noLineEntries.length} {noLineEntries.length === 1 ? 'entry' : 'entries'}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-4">
                              <div className="text-center">
                                <div className="text-xs text-gray-500">Inspected</div>
                                <div className="text-sm font-semibold text-blue-600">{otherInspected}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-gray-500">Passed</div>
                                <div className="text-sm font-semibold text-green-600">{otherPassed}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-gray-500">Defects</div>
                                <div className="text-sm font-semibold text-red-600">{otherDefects}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-gray-500">RFT%</div>
                                <div className={`text-sm font-semibold ${otherRFT >= 95 ? 'text-green-600' :
                                  otherRFT >= 90 ? 'text-yellow-600' : 'text-red-600'
                                  }`}>
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
                              className={`rounded border p-3 ${editingId === r._id
                                ? "border-indigo-300 bg-indigo-50"
                                : "border-gray-200 hover:bg-gray-50"
                                }`}
                            >
                              <div className="mb-1 flex items-center justify-between">
                                <div className="text-sm font-semibold text-gray-800">
                                  {r.hourLabel} - {r.line || "No Line"}{" "}
                                  {r.building && `(${r.building})`}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">
                                    {new Date(
                                      r.updatedAt || r.createdAt
                                    ).toLocaleTimeString()}
                                  </span>
                                  <button
                                    onClick={() => handleEdit(r)}
                                    className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-200"
                                    title="Edit"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDelete(r._id)}
                                    disabled={deleting === r._id}
                                    className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 hover:bg-red-200 disabled:opacity-50"
                                    title="Delete"
                                  >
                                    {deleting === r._id ? "..." : "Delete"}
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs text-black md:grid-cols-5">
                                <div>
                                  <span className="text-gray-500">Inspected:</span>{" "}
                                  {r.inspectedQty}
                                </div>
                                <div>
                                  <span className="text-gray-500">Passed:</span>{" "}
                                  {r.passedQty}
                                </div>
                                <div>
                                  <span className="text-gray-500">Def.Pcs:</span>{" "}
                                  {r.defectivePcs}
                                </div>
                                <div>
                                  <span className="text-gray-500">After Repair:</span>{" "}
                                  {r.afterRepair}
                                </div>
                                <div>
                                  <span className="text-gray-500">Total Defects:</span>{" "}
                                  {r.totalDefects}
                                </div>
                              </div>
                              {Array.isArray(r.selectedDefects) &&
                                r.selectedDefects.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {r.selectedDefects.map((d, i) => (
                                      <span
                                        key={`${d.name}-${i}`}
                                        className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-black"
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