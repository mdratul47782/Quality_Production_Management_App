// app/components/ProductionInputForm.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";

const lines = ["Line-1", "Line-2", "Line-3"];

const buyers = [
  "Decathlon - knit",
  "Decathlon - woven",
  "walmart",
  "Columbia",
  "ZXY",
  "CTC",
  "DIESEL",
  "Sports Group Denmark",
  "Identity",
  "Fifth Avenur",
];

const initialForm = {
  buyer: "",
  style: "",
  total_manpower: "",
  manpower_present: "",
  manpower_absent: "",
  working_hour: "",
  plan_quantity: "",
  plan_efficiency_percent: "",
  smv: "",
  capacity: "",
};

// ---------- helper ----------
function computeTargetPreview({ manpower_present, working_hour, smv, plan_efficiency_percent }) {
  const mp = Number(manpower_present);
  const hr = Number(working_hour);
  const smvNum = Number(smv);
  const eff = Number(plan_efficiency_percent);

  if (!Number.isFinite(mp) || mp <= 0) return "";
  if (!Number.isFinite(hr) || hr <= 0) return "";
  if (!Number.isFinite(smvNum) || smvNum <= 0) return "";
  if (!Number.isFinite(eff) || eff <= 0) return "";

  const totalMinutes = mp * hr * 60;
  const effFactor = eff / 100;
  const target = (totalMinutes / smvNum) * effFactor;
  if (!Number.isFinite(target) || target <= 0) return "";
  return Math.round(target);
}

export default function ProductionInputForm() {
  const { auth, loading: authLoading } = useAuth();

  // ---------- date (local) ----------
  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dhaka",
    []
  );

  const computeTodayKey = () =>
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date()); // YYYY-MM-DD

  const [selectedDate, setSelectedDate] = useState(computeTodayKey);
  const [selectedLine, setSelectedLine] = useState("");

  // ---------- form + list state ----------
  const [form, setForm] = useState(initialForm);
  const [headers, setHeaders] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const [loadingHeaders, setLoadingHeaders] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const assignedBuilding = auth?.assigned_building || "";

  // ---------- computed target preview ----------
  const targetPreview = useMemo(
    () => computeTargetPreview(form),
    [
      form.manpower_present,
      form.working_hour,
      form.smv,
      form.plan_efficiency_percent,
    ]
  );

  const busy = saving || loadingHeaders || authLoading;

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  // ---------- input change ----------
  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => {
      const next = { ...prev, [name]: value };

      // auto manpower_absent = total - present
      if (name === "total_manpower" || name === "manpower_present") {
        const total = Number(next.total_manpower);
        const present = Number(next.manpower_present);

        if (
          next.total_manpower !== "" &&
          next.manpower_present !== "" &&
          Number.isFinite(total) &&
          Number.isFinite(present)
        ) {
          const diff = total - present;
          next.manpower_absent = diff >= 0 ? diff.toString() : "0";
        } else {
          next.manpower_absent = "";
        }
      }

      return next;
    });
  };

  const handleLineChange = (e) => {
    const value = e.target.value;
    setSelectedLine(value);
    setHeaders([]);
    resetForm();
    setError("");
    setSuccess("");
  };

  const handleDateChange = (e) => {
    const value = e.target.value;
    setSelectedDate(value);
    setHeaders([]);
    resetForm();
    setError("");
    setSuccess("");
  };

  // ---------- fetch headers for building + line + date ----------
  useEffect(() => {
    if (authLoading) return;
    if (!assignedBuilding) return;
    if (!selectedLine || !selectedDate) {
      setHeaders([]);
      return;
    }

    const fetchHeaders = async () => {
      try {
        setLoadingHeaders(true);
        setError("");
        setSuccess("");

        const url = new URL(
          "/api/target-setter-header",
          window.location.origin
        );
        url.searchParams.set("assigned_building", assignedBuilding);
        url.searchParams.set("line", selectedLine);
        url.searchParams.set("date", selectedDate);

        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to load headers.");
        }

        setHeaders(json.data || []);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load target headers.");
        setHeaders([]);
      } finally {
        setLoadingHeaders(false);
      }
    };

    fetchHeaders();
  }, [authLoading, assignedBuilding, selectedLine, selectedDate]);

  // ---------- submit (create / update) ----------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!auth?.assigned_building) {
      setError("Supervisor not authenticated or no assigned building.");
      return;
    }

    if (!selectedLine) {
      setError("Please select a line first.");
      return;
    }

    if (!selectedDate) {
      setError("Please select a date.");
      return;
    }

    if (!form.buyer || !form.style) {
      setError("Buyer and style are required.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        date: selectedDate,
        assigned_building: auth.assigned_building,
        line: selectedLine,
        buyer: form.buyer,
        style: form.style,
        total_manpower: Number(form.total_manpower),
        manpower_present: Number(form.manpower_present),
        manpower_absent:
          form.manpower_absent !== ""
            ? Number(form.manpower_absent)
            : undefined,
        working_hour: Number(form.working_hour),
        plan_quantity: Number(form.plan_quantity),
        plan_efficiency_percent: Number(form.plan_efficiency_percent),
        smv: Number(form.smv),
        capacity: Number(form.capacity),
      };

      const endpoint = editingId
        ? `/api/target-setter-header/${editingId}`
        : "/api/target-setter-header";

      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || "Failed to save target setter header."
        );
      }

      setSuccess(
        editingId
          ? "Target header updated successfully."
          : "Target header created successfully."
      );
      resetForm();

      // refetch list
      if (assignedBuilding && selectedLine && selectedDate) {
        try {
          const url = new URL(
            "/api/target-setter-header",
            window.location.origin
          );
          url.searchParams.set("assigned_building", assignedBuilding);
          url.searchParams.set("line", selectedLine);
          url.searchParams.set("date", selectedDate);

          const listRes = await fetch(url, { cache: "no-store" });
          const listJson = await listRes.json();
          if (listRes.ok && listJson.success) {
            setHeaders(listJson.data || []);
          }
        } catch (err) {
          console.error("Refetch error:", err);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong while saving.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- edit existing ----------
  const handleEdit = (header) => {
    setError("");
    setSuccess("");
    setEditingId(header._id);

    setForm({
      buyer: header.buyer || "",
      style: header.style || "",
      total_manpower:
        header.total_manpower != null
          ? header.total_manpower.toString()
          : "",
      manpower_present:
        header.manpower_present != null
          ? header.manpower_present.toString()
          : "",
      manpower_absent:
        header.manpower_absent != null
          ? header.manpower_absent.toString()
          : "",
      working_hour:
        header.working_hour != null ? header.working_hour.toString() : "",
      plan_quantity:
        header.plan_quantity != null ? header.plan_quantity.toString() : "",
      plan_efficiency_percent:
        header.plan_efficiency_percent != null
          ? header.plan_efficiency_percent.toString()
          : "",
      smv: header.smv != null ? header.smv.toString() : "",
      capacity:
        header.capacity != null ? header.capacity.toString() : "",
    });

    // make sure filter controls remain aligned
    setSelectedLine(header.line);
    if (header.date) setSelectedDate(header.date);
  };

  const handleCancelEdit = () => {
    resetForm();
    setError("");
    setSuccess("");
  };

  // ---------- delete ----------
 const handleDelete = async (id) => {
  const ok = window.confirm("Delete this target header?");
  if (!ok) return;

  setError("");
  setSuccess("");
  setDeletingId(id);

  try {
    const res = await fetch(`/api/target-setter-header/${id}`, {
      method: "DELETE",
    });

    let json = {};
    try {
      json = await res.json();
    } catch (e) {
      // ignore if no json
    }

    // 🔹 If it's 404 (not found), treat as "already deleted"
    if (res.status === 404) {
      setSuccess("Header was already deleted (404). Syncing list.");
      setHeaders((prev) => prev.filter((h) => h._id !== id));
      if (editingId === id) resetForm();
      return;
    }

    if (!res.ok || !json.success) {
      throw new Error(json.message || "Failed to delete header.");
    }

    setSuccess("Target header deleted.");
    setHeaders((prev) => prev.filter((h) => h._id !== id));
    if (editingId === id) resetForm();
  } catch (err) {
    console.error(err);
    setError(err.message || "Something went wrong while deleting.");
  } finally {
    setDeletingId(null);
  }
};

  // ---------- UI ----------
  return (
    <div className="space-y-4">
      {/* Top info */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm md:text-base font-semibold text-slate-900">
            Target Setter Header
          </h2>
          <p className="text-xs text-slate-500">
            Building:{" "}
            <span className="font-medium">
              {assignedBuilding || "— (not assigned)"}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date */}
          <div className="flex flex-col">
            <label className="text-[11px] font-medium text-slate-600">
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="h-8 rounded-md border border-slate-300 px-2 text-xs text-slate-900"
            />
          </div>

          {/* Line */}
          <div className="flex flex-col">
            <label className="text-[11px] font-medium text-slate-600">
              Line
            </label>
            <select
              value={selectedLine}
              onChange={handleLineChange}
              className="h-8 rounded-md border border-slate-300 px-2 text-xs text-slate-900 bg-white"
            >
              <option value="">Select line</option>
              {lines.map((line) => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">
          {error}
        </div>
      )}
      {success && (
        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5">
          {success}
        </div>
      )}

      {/* Form Card */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm p-3 md:p-4 space-y-3"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs md:text-sm font-semibold text-slate-900">
            {editingId ? "Edit Target Header" : "New Target Header"}
          </h3>
          <p className="text-[11px] text-slate-500">
            {selectedDate} • {selectedLine || "Select a line"}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Buyer */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-600">
              Buyer
            </label>
            <select
              name="buyer"
              value={form.buyer}
              onChange={handleChange}
              className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900
                         focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">Select buyer</option>
              {buyers.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <Field
            label="Style"
            name="style"
            value={form.style}
            onChange={handleChange}
            placeholder="Style no / name"
          />

          <Field
            label="Total Man Power"
            name="total_manpower"
            value={form.total_manpower}
            onChange={handleChange}
            placeholder="32"
            type="number"
          />

          <Field
            label="Manpower Present"
            name="manpower_present"
            value={form.manpower_present}
            onChange={handleChange}
            placeholder="30"
            type="number"
          />

          <Field
            label="Manpower Absent (auto)"
            name="manpower_absent"
            value={form.manpower_absent}
            onChange={handleChange}
            placeholder="Auto = Total - Present"
            type="number"
            readOnly
          />

          <Field
            label="Working Hour (for this style)"
            name="working_hour"
            value={form.working_hour}
            onChange={handleChange}
            placeholder="2.5"
            type="number"
          />

          <Field
            label="Plan Quantity"
            name="plan_quantity"
            value={form.plan_quantity}
            onChange={handleChange}
            placeholder="2000"
            type="number"
          />

          <Field
            label="Plan Efficiency (%)"
            name="plan_efficiency_percent"
            value={form.plan_efficiency_percent}
            onChange={handleChange}
            placeholder="90"
            type="number"
          />

          <Field
            label="SMV (minutes)"
            name="smv"
            value={form.smv}
            onChange={handleChange}
            placeholder="1.2"
            type="number"
          />

          <Field
            label="Capacity"
            name="capacity"
            value={form.capacity}
            onChange={handleChange}
            placeholder="1800"
            type="number"
          />

          {/* Target preview (read-only; real value from backend) */}
          <Field
            label="Target (preview, auto)"
            name="target_preview"
            value={targetPreview === "" ? "" : targetPreview.toString()}
            onChange={() => {}}
            placeholder="Auto from manpower, hour, SMV, efficiency"
            type="number"
            readOnly
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
              disabled={busy}
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:opacity-70"
            disabled={busy || !selectedLine}
          >
            {saving
              ? "Saving..."
              : editingId
              ? "Update Target"
              : "Save Target"}
          </button>
        </div>
      </form>

      {/* Existing headers list */}
      <div className="rounded-2xl border border-slate-200 bg-white/80 shadow-sm p-3 md:p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs md:text-sm font-semibold text-slate-900">
            Existing Targets
          </h3>
          <p className="text-[11px] text-slate-500">
            {selectedLine && selectedDate
              ? `${selectedDate} • ${selectedLine}`
              : "Select date & line"}
          </p>
        </div>

        {loadingHeaders ? (
          <p className="text-xs text-slate-500">Loading...</p>
        ) : !selectedLine ? (
          <p className="text-xs text-slate-500">
            Select a line to see existing target headers.
          </p>
        ) : headers.length === 0 ? (
          <p className="text-xs text-slate-500">
            No target headers for this date and line yet.
          </p>
        ) : (
          <div className="space-y-2">
            {headers.map((h) => (
              <div
                key={h._id}
                className="border border-slate-200 rounded-lg p-2 flex flex-col gap-1 text-xs bg-white"
              >
                <div className="flex flex-wrap justify-between gap-1">
                  <div className="font-semibold text-slate-900">
                    {h.style}{" "}
                    <span className="text-[10px] text-slate-500">
                      ({h.buyer})
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Target:{" "}
                    <span className="font-semibold text-emerald-700">
                      {h.target_full_day ?? "-"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
                  <span>
                    MP: {h.manpower_present}/{h.total_manpower}
                  </span>
                  <span>WH: {h.working_hour}</span>
                  <span>SMV: {h.smv}</span>
                  <span>Eff: {h.plan_efficiency_percent}%</span>
                  <span>Cap: {h.capacity}</span>
                </div>

                <div className="flex justify-end gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => handleEdit(h)}
                    className="px-2 py-1 rounded-md border border-slate-300 text-[11px] text-slate-700 hover:bg-slate-50"
                    disabled={busy}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(h._id)}
                    className="px-2 py-1 rounded-md border border-red-300 text-[11px] text-red-600 hover:bg-red-50 disabled:opacity-60"
                    disabled={busy || deletingId === h._id}
                  >
                    {deletingId === h._id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- small field component ----------
function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  readOnly = false,
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={name}
        className="text-[11px] font-medium uppercase tracking-wide text-slate-600"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        value={value}
        onChange={readOnly ? undefined : onChange}
        type={type}
        readOnly={readOnly}
        className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900
                   focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500
                   disabled:bg-slate-50"
        placeholder={placeholder}
      />
    </div>
  );
}
