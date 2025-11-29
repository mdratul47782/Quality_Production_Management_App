// app/line-info-register/page.js
"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/app/hooks/useAuth";
import { Search, Trash2, Save } from "lucide-react";

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

const lines = ["Line-1", "Line-2", "Line-3"]

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

const makeEmptyForm = () => ({
  buyer: "",
  assigned_building: "",
  line: "",
  style: "",
  item: "",
  color: "",
  smv: "",
  runDay: "",
  date: getTodayDateString(),
});

export default function LineInfoRegisterPage() {
  const { auth } = useAuth();

  const [formValues, setFormValues] = useState(makeEmptyForm());
  const [records, setRecords] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);


 useEffect(() => {
  if (!auth) return;
  if (!auth.assigned_building) {
    setLoading(false);
    return;
  }

  setFormValues((prev) => ({
    ...prev,
    assigned_building: auth.assigned_building,
    // date আলাদা selectedDate থেকে না, নিজের ভেতরেই থাকবে
  }));

  fetchRecords(auth.assigned_building);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [auth?.assigned_building]);


  const fetchRecords = async (assignedBuilding) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (assignedBuilding)
        params.set("assigned_building", assignedBuilding);
     

      const res = await fetch(
        `/api/line-info-register?${params.toString()}`,
        { cache: "no-store" }
      );
      const result = await res.json();
      if (result.success) {
        setRecords(result.data || []);
      } else {
        console.error(result.message);
      }
    } catch (err) {
      console.error("Error fetching records:", err);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormValues({
      ...makeEmptyForm(),
      assigned_building: auth?.assigned_building || "",
      date: selectedDate,
    });
  };

  const validate = () => {
    const keys = [
      "buyer",
      "assigned_building",
      "line",
      "style",
      "item",
      "color",
      "smv",
      "runDay",
      "date",
    ];
    for (const k of keys) if (!formValues[k]) return false;
    return true;
  };

  const handleSave = async () => {
    if (!auth) return alert("Please login before submitting this form.");
    if (!validate()) return alert("Please fill in all fields.");

    setSaving(true);
    try {
      const userId = auth._id || auth.id || "";
      const payload = {
        ...formValues,
        assigned_building: auth.assigned_building,
        user: {
          id: userId,
          user_name: auth.user_name,
        },
      };

      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { ...payload, id: editingId } : payload;

      const res = await fetch("/api/line-info-register", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      alert(result.message || "Saved!");

      if (result.success) {
        await fetchRecords(auth.assigned_building);
        if (!editingId) resetForm();
      }
    } catch (err) {
      console.error(err);
      alert("Save failed. Check console for details.");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!editingId) return;
    if (!confirm("Are you sure you want to delete this line?")) return;

    try {
      const res = await fetch(
        `/api/line-info-register?id=${editingId}`,
        { method: "DELETE" }
      );
      const result = await res.json();
      alert(result.message || "Deleted");

      if (result.success) {
        await fetchRecords(auth.assigned_building);
        resetForm();
      }
    } catch (err) {
      console.error(err);
      alert("Delete failed. Check console for details.");
    }
  };

  const handleEditClick = (record) => {
  setEditingId(record._id);
  setFormValues({
    buyer: record.buyer || "",
    assigned_building: record.assigned_building || "",
    line: record.line || "",
    style: record.style || "",
    item: record.item || "",
    color: record.color || "",
    smv: record.smv || "",
    runDay: record.runDay || "",
    date: record.date || getTodayDateString(),
  });
};

  if (!auth) {
    return (
      <section className="max-w-3xl mx-auto mt-12 text-center text-gray-600">
        Please login to access line information.
      </section>
    );
  }

  if (loading) {
    return (
      <section className="max-w-3xl mx-auto bg-white border border-gray-200 min-h-[400px] shadow-lg rounded-lg mt-12 flex items-center justify-center">
        <div className="text-gray-500 text-lg">Loading...</div>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto bg-white border border-gray-200 shadow-xl rounded-2xl mt-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center bg-gradient-to-br from-blue-600 to-blue-700 text-white px-6 py-4 rounded-t-lg">
        <div className="w-12 h-12 bg-white rounded-md mr-3 flex items-center justify-center">
          <Image
            src="/HKD_LOGO.png"
            alt="HKD Outdoor Innovations Ltd. Logo"
            width={80}
            height={80}
            priority
          />
        </div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">
            HKD Outdoor Innovations Ltd.
          </h1>
          <p className="text-lg opacity-90">
            Line Info Register – {auth.assigned_building}
          </p>
          <p className="text-sm opacity-80">
            Inputter: <span className="font-semibold">{auth.user_name}</span>
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: saved lines */}
        <aside className="space-y-4">
          <div className="bg-gradient-to-br from-white to-slate-50 p-4 rounded-2xl border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-700 text-sm">
                Saved lines ({auth.assigned_building})
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="text-xs px-2 py-1 rounded bg-sky-100 text-sky-700 hover:bg-sky-200"
              >
                + New line
              </button>
            </div>

            {records.length === 0 ? (
              <p className="text-xs text-gray-500">
                No line info saved yet for this date & building.
              </p>
            ) : (
              <ul className="space-y-2 max-h-[360px] overflow-auto text-sm">
                {records.map((r) => (
                  <li
                    key={r._id}
                    className={`border rounded-lg p-2 cursor-pointer hover:border-sky-400 ${
                      editingId === r._id ? "border-sky-500 bg-sky-50" : ""
                    }`}
                    onClick={() => handleEditClick(r)}
                  >
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-800">
                        {r.line}
                      </span>
                      <span className="text-xs text-gray-500">
                        {r.buyer}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Style: <span className="font-medium">{r.style}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Item: {r.item} • Color: {r.color}
                    </div>
                    <div className="text-xs text-gray-500">
                      SMV: {r.smv} • Run Day: {r.runDay}
                    </div>
                    <div className="text-xs text-gray-400">
                      Date: {r.date}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* small preview */}
          <div className="bg-white p-4 rounded-2xl border shadow-sm">
            <h3 className="font-semibold text-gray-700 text-sm">
              Current form preview
            </h3>
            <dl className="mt-2 text-xs text-gray-600 space-y-1">
              <Row label="Date" value={formValues.date} />
              <Row
                label="Assigned Building"
                value={auth.assigned_building}
              />
              <Row label="Buyer" value={formValues.buyer} />
              <Row label="Line" value={formValues.line} />
              <Row label="Style" value={formValues.style} />
              <Row label="Item" value={formValues.item} />
              <Row label="Color" value={formValues.color} />
              <Row label="SMV" value={formValues.smv} />
              <Row label="Run Day" value={formValues.runDay} />
            </dl>
          </div>
        </aside>

        {/* RIGHT: form */}
        <form
          className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          {/* Date */}
          <Field label="Date">
            <input
              type="date"
              value={formValues.date}
              onChange={(e) => {
                setFormValues({ ...formValues, date: e.target.value });
                
              }}
              className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-sky-400 outline-none"
            />
          </Field>

          {/* Assigned building */}
          <Field label="Assigned Building">
            <input
              type="text"
              value={auth.assigned_building || ""}
              disabled
              className="w-full rounded-lg border px-3 py-2 bg-gray-100 text-gray-700"
            />
          </Field>

          {/* Buyer */}
          <Field label="Register Buyer">
            <SearchableDropdown
              options={buyers}
              value={formValues.buyer}
              onChange={(val) => setFormValues({ ...formValues, buyer: val })}
              placeholder="Select buyer"
            />
          </Field>

          {/* Line */}
          <Field label="Register Line">
            <SearchableDropdown
              options={lines}
              value={formValues.line}
              onChange={(val) => setFormValues({ ...formValues, line: val })}
              placeholder="Select line"
            />
          </Field>

          {/* Style */}
          <Field label="Style Number">
            <input
              type="text"
              placeholder="Enter style number"
              value={formValues.style}
              onChange={(e) =>
                setFormValues({ ...formValues, style: e.target.value })
              }
              className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-sky-400 outline-none"
            />
          </Field>

          {/* Item */}
          <Field label="Style/Item Description">
            <input
              type="text"
              placeholder="Enter item description"
              value={formValues.item}
              onChange={(e) =>
                setFormValues({ ...formValues, item: e.target.value })
              }
              className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-sky-400 outline-none"
            />
          </Field>

          {/* Color */}
          <Field label="Color/Model">
            <input
              type="text"
              placeholder="Enter color/model"
              value={formValues.color}
              onChange={(e) =>
                setFormValues({ ...formValues, color: e.target.value })
              }
              className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-sky-400 outline-none"
            />
          </Field>

          {/* SMV */}
          <Field label="SMV">
            <input
              type="number"
              step="0.01"
              placeholder="Enter SMV"
              value={formValues.smv}
              onChange={(e) =>
                setFormValues({ ...formValues, smv: e.target.value })
              }
              className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-sky-400 outline-none"
            />
          </Field>

          {/* Run Day */}
          <Field label="Run Day">
            <input
              type="text"
              placeholder="Enter run day"
              value={formValues.runDay}
              onChange={(e) =>
                setFormValues({ ...formValues, runDay: e.target.value })
              }
              className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-sky-400 outline-none"
            />
          </Field>

          <div className="md:col-span-2 flex items-center justify-between gap-3 mt-2">
            <div className="flex gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                  <Trash2 size={16} /> Delete
                </button>
              )}

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg"
              >
                <Save size={16} />{" "}
                {editingId ? "Update Line" : "Save New Line"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="px-6 py-4 bg-gray-50 text-right text-sm text-gray-600 border-t">
        • HKD OUTDOOR INNOVATIONS LTD.
      </div>
    </section>
  );
}

/* ---------- helpers ---------- */
function Field({ label, children }) {
  return (
    <label className="flex flex-col text-sm text-gray-700">
      <span className="mb-2 font-medium">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-800">
        {value && value !== "" ? value : "—"}
      </dd>
    </div>
  );
}

function SearchableDropdown({ options, value, onChange, placeholder }) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query
    ? options.filter((opt) =>
        opt.toLowerCase().includes(query.toLowerCase())
      )
    : options;

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={query || value}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          className="w-full rounded-lg border px-3 py-2 pr-10 focus:ring-2 focus:ring-sky-400 outline-none"
        />

        <div className="absolute right-2 top-2 text-gray-400">
          <Search size={16} />
        </div>
      </div>

      {open && (
        <ul className="absolute z-50 mt-2 max-h-48 w-full overflow-auto rounded-lg border bg-white shadow-lg text-sm">
          {filtered.length > 0 ? (
            filtered.map((opt) => (
              <li
                key={opt}
                onMouseDown={() => {
                  onChange(opt);
                  setQuery(opt);
                  setOpen(false);
                }}
                className={`cursor-pointer px-3 py-2 hover:bg-sky-600 hover:text-white ${
                  opt === value ? "bg-sky-100" : ""
                }`}
              >
                {opt}
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-gray-500 italic">
              No results found
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
