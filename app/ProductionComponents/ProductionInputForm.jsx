// app/components/ProductionInputForm.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";

const lines = ["Line-1", "Line-2", "Line-3","Line-4","Line-5","Line-6","Line-7","Line-8","Line-9","Line-10","Line-11","Line-12","Line-13","Line-14","Line-15"];

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
  run_day: "",
  color_model: "",
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
function computeTargetPreview({
  manpower_present,
  working_hour,
  smv,
  plan_efficiency_percent,
}) {
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

    if (!form.buyer || !form.style || !form.run_day || !form.color_model) {
      setError("Buyer, Style, Run day and Color/Model are required.");
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
        run_day: Number(form.run_day),
        color_model: form.color_model,
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
      run_day:
        header.run_day != null ? header.run_day.toString() : "",
      color_model: header.color_model || "",
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
      } catch (e) {}

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
    <div className="space-y-4 ">
      {/* Card wrapper */}
      <div className="card card-bordered shadow-md border-slate-200 bg-base-100 rounded-3xl">
        {/* Card header strip */}
        <div className="border-b border-slate-200 bg-gray-300 px-4 py-3 flex flex-wrap items-center justify-between gap-3 ">
          <div>
            <h2 className="text-sm md:text-base font-semibold text-slate-900">
              Target Setter Header
            </h2>
            <p className="text-[14px] text-slate-900 mt-0.5 font-bold">
              Building:&nbsp;
              <span className="badge badge-xs border-0 bg-amber-500/50 text-amber-700 font-bold p-4 text-[14px] ">
                {assignedBuilding || "Not assigned"}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {/* Date */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-900">
                Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                className="input input-sm bg-slate-50 border-slate-200 text-black font-semibold focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>

            {/* Line */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-900">
                Line
              </label>
              <select
                value={selectedLine}
                onChange={handleLineChange}
                className="select select-sm bg-slate-50 border-slate-200 text-black font-semibold focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 min-w-[120px]"
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

        {/* Card body */}
        <div className="card-body gap-4">
          {/* Messages */}
          {error && (
            <div className="alert alert-error py-2 px-3 text-xs">
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="alert alert-success py-2 px-3 text-xs">
              <span>{success}</span>
            </div>
          )}

          {/* Form + Existing list side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* Form section (left) */}
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/40 p-3 md:p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs md:text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {editingId ? "Edit Target Header" : "New Target Header"}
                </h3>
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                  <span className="badge badge-ghost badge-xs border-slate-200 font-semibold text-white-700 p-3">
                    {selectedDate || "Select date"}
                  </span>
                  <span className="badge badge-ghost badge-xs border-slate-200 font-semibold text-white-700 p-3">
                    {selectedLine || "Select line"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Buyer */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                    Buyer
                  </label>
                  <select
                    name="buyer"
                    value={form.buyer}
                    onChange={handleChange}
                    className="select select-sm bg-slate-50 border-slate-200 text-xs text-black font-semibold focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
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
                  placeholder="Style no"
                />

                <Field
                  label="Run day"
                  name="run_day"
                  value={form.run_day}
                  onChange={handleChange}
                  placeholder="0"
                  type="number"
                />

                <Field
                  label="Color/Model"
                  name="color_model"
                  value={form.color_model}
                  onChange={handleChange}
                  placeholder="Color"
                />

                <Field
                  label="Total Man Power"
                  name="total_manpower"
                  value={form.total_manpower}
                  onChange={handleChange}
                  placeholder="0"
                  type="number"
                />

                <Field
                  label="Manpower Present"
                  name="manpower_present"
                  value={form.manpower_present}
                  onChange={handleChange}
                  placeholder="0"
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
                  placeholder="0"
                  type="number"
                />

                <Field
                  label="Plan Quantity"
                  name="plan_quantity"
                  value={form.plan_quantity}
                  onChange={handleChange}
                  placeholder="0"
                  type="number"
                />

                <Field
                  label="Plan Efficiency (%)"
                  name="plan_efficiency_percent"
                  value={form.plan_efficiency_percent}
                  onChange={handleChange}
                  placeholder="0"
                  type="number"
                />

                <Field
                  label="SMV (minutes)"
                  name="smv"
                  value={form.smv}
                  onChange={handleChange}
                  placeholder="0"
                  type="number"
                />

                <Field
                  label="Capacity"
                  name="capacity"
                  value={form.capacity}
                  onChange={handleChange}
                  placeholder="0"
                  type="number"
                />

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
                    className="btn btn-sm btn-ghost border border-slate-200 text-xs font-semibold text-slate-800"
                    disabled={busy}
                  >
                    Cancel
                  </button>
                )}

                <button
                  type="submit"
                  className="btn btn-sm bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 border-0 disabled:opacity-70"
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

            {/* Existing headers list (right) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs md:text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span className="w-1 h-5 rounded-full bg-emerald-400/80 " />
                  Existing Targets
                </h3>
                <p className="text-[14px]  text-slate-600 p-2 font-bold">
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
                      className="border border-slate-200 rounded-xl p-2.5 flex flex-col gap-2 text-xs bg-amber-50/40 hover:bg-amber-50/70 transition-colors"
                    >
                      {/* Details grid */}
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-700">
                        <p className="font-semibold">Buyer</p>
                        <p className="font-semibold text-slate-900">
                          {h.buyer}
                        </p>

                        <p className="font-semibold">Style</p>
                        <p className="font-semibold text-slate-900">
                          {h.style}
                        </p>

                        <p className="font-semibold">Style no / name</p>
                        <p className="text-slate-900">{h.style}</p>

                        <p className="font-semibold">Run day</p>
                        <p className="text-slate-900">{h.run_day}</p>

                        <p className="font-semibold">Color/Model</p>
                        <p className="text-slate-900">{h.color_model}</p>

                        <p className="font-semibold">Total Man Power</p>
                        <p className="text-slate-900">{h.total_manpower}</p>

                        <p className="font-semibold">Manpower Present</p>
                        <p className="text-slate-900">
                          {h.manpower_present}
                        </p>

                        <p className="font-semibold">Manpower Absent</p>
                        <p className="text-slate-900">
                          {h.manpower_absent}
                        </p>

                        <p className="font-semibold">
                          Working Hour (for this style)
                        </p>
                        <p className="text-slate-900">{h.working_hour}</p>

                        <p className="font-semibold">Plan Quantity</p>
                        <p className="text-slate-900">{h.plan_quantity}</p>

                        <p className="font-semibold">Plan Efficiency (%)</p>
                        <p className="text-slate-900">
                          {h.plan_efficiency_percent}
                        </p>

                        <p className="font-semibold">SMV (minutes)</p>
                        <p className="text-slate-900">{h.smv}</p>

                        <p className="font-semibold">Capacity</p>
                        <p className="text-slate-900">{h.capacity}</p>

                        <p className="font-semibold">Target</p>
                        <p className="text-slate-900">
                          {h.target_full_day ?? "-"}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(h)}
                          className="btn btn-xs btn-outline border-amber-300 text-amber-800 hover:bg-amber-50 font-semibold"
                          disabled={busy}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(h._id)}
                          className="btn btn-xs btn-outline border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60 font-semibold"
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
        </div>
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
        className="text-[11px] font-semibold uppercase tracking-wide text-slate-900"
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
        className="input input-sm bg-slate-50 border-slate-200 text-xs text-black font-semibold placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:bg-slate-100"
        placeholder={placeholder}
      />
    </div>
  );
}
