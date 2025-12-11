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

const lines = ["Line-1",
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
  "Line-15"];

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

const makeEmptyForm = () => ({
  factory: "",
  buyer: "",
  assigned_building: "",
  line: "",
  style: "",
  item: "",
  color: "",
  smv: "",
  runDay: "",
  date: getTodayDateString(),
  imageSrc: "",
  videoSrc: "",
});

export default function LineInfoRegisterPage() {
  const { auth } = useAuth();

  const [formValues, setFormValues] = useState(makeEmptyForm());
  const [records, setRecords] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 🔹 local files + preview
  const [imageFile, setImageFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [videoPreview, setVideoPreview] = useState("");

  // preview logic
  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImagePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setImagePreview(formValues.imageSrc || "");
    }
  }, [imageFile, formValues.imageSrc]);

  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setVideoPreview(formValues.videoSrc || "");
    }
  }, [videoFile, formValues.videoSrc]);

  useEffect(() => {
    if (!auth) return;

    if (!auth.assigned_building || !auth.factory) {
      setLoading(false);
      return;
    }

    setFormValues((prev) => ({
      ...prev,
      factory: auth.factory,
      assigned_building: auth.assigned_building,
    }));

    fetchRecords(auth.factory, auth.assigned_building);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.assigned_building, auth?.factory]);

  const fetchRecords = async (factory, assignedBuilding) => {
    if (!factory || !assignedBuilding) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("factory", factory);
      params.set("assigned_building", assignedBuilding);

      const res = await fetch(`/api/line-info-register?${params.toString()}`, {
        cache: "no-store",
      });
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
    setImageFile(null);
    setVideoFile(null);
    setFormValues({
      ...makeEmptyForm(),
      factory: auth?.factory || "",
      assigned_building: auth?.assigned_building || "",
    });
  };

  const validate = () => {
    const keys = [
      "factory",
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

  // 🔹 1) Prevent duplicate for same factory + building + line
  const isDuplicate = records.some((r) => {
    return (
      r.factory === auth.factory &&
      r.assigned_building === auth.assigned_building &&
      r.line === formValues.line &&
      r._id !== editingId // allow editing the same record
    );
  });

  if (isDuplicate) {
    alert(
      `This line (${formValues.line}) already has info for ${auth.factory} – ${auth.assigned_building}. Please select it from the left list and update instead of creating a new one.`
    );
    return;
  }

  setSaving(true);
  try {
    const userId = auth._id || auth.id || "";

    const method = editingId ? "PUT" : "POST";

    // 🔹 Use FormData so we can send files + text together
    const formData = new FormData();
    formData.append("factory", auth.factory);
    formData.append("buyer", formValues.buyer);
    formData.append("assigned_building", auth.assigned_building);
    formData.append("line", formValues.line);
    formData.append("style", formValues.style);
    formData.append("item", formValues.item);
    formData.append("color", formValues.color);
    formData.append("smv", formValues.smv);
    formData.append("runDay", formValues.runDay);
    formData.append("date", formValues.date);
    formData.append("imageSrc", formValues.imageSrc || "");
    formData.append("videoSrc", formValues.videoSrc || "");
    formData.append("userId", userId);
    formData.append("userName", auth.user_name);

    if (editingId) {
      formData.append("id", editingId);
    }

    if (imageFile) {
      formData.append("imageFile", imageFile);
    }
    if (videoFile) {
      formData.append("videoFile", videoFile);
    }

    const res = await fetch("/api/line-info-register", {
      method,
      body: formData,
    });

    const result = await res.json();
    alert(result.message || "Saved!");

    if (result.success) {
      await fetchRecords(auth.factory, auth.assigned_building);
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
        await fetchRecords(auth.factory, auth.assigned_building);
        resetForm();
      }
    } catch (err) {
      console.error(err);
      alert("Delete failed. Check console for details.");
    }
  };

  const handleEditClick = (record) => {
    setEditingId(record._id);
    setImageFile(null);
    setVideoFile(null);
    setFormValues({
      factory: record.factory || auth?.factory || "",
      buyer: record.buyer || "",
      assigned_building: record.assigned_building || "",
      line: record.line || "",
      style: record.style || "",
      item: record.item || "",
      color: record.color || "",
      smv: record.smv || "",
      runDay: record.runDay || "",
      date: record.date || getTodayDateString(),
      imageSrc: record.imageSrc || "",
      videoSrc: record.videoSrc || "",
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
      <section className="max-w-3xl mx-auto bg-white border border-gray-200 min-h-[400px] shadow-lg rounded-lg mt-12 flex items-center justify-center ">
        <div className="text-gray-500 text-lg">Loading...</div>
      </section>
    );
  }

  return (
    <section className="max-w-3xl mx-auto bg-white border border-gray-200 shadow-xl rounded-2xl mt-3 overflow-hidden ">
      {/* Header */}
      <div className="flex items-center bg-gradient-to-br from-blue-600 to-blue-700 text-white px-4 py-2 rounded-t-lg gap-3">
        <div className="w-10 h-10 bg-white rounded-md flex items-center justify-center">
          <Image
            src="/HKD_LOGO.png"
            alt="HKD Outdoor Innovations Ltd. Logo"
            width={64}
            height={64}
            priority
          />
        </div>
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold leading-tight">
            HKD Outdoor Innovations Ltd.
          </h1>
          <p className="text-sm opacity-90">
            Line Info Register – {auth.assigned_building}
          </p>
          <p className="text-xs opacity-80">
            Factory:{" "}
            <span className="font-semibold">{auth.factory}</span> • Inputter:{" "}
            <span className="font-semibold">{auth.user_name}</span>
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT: saved lines + preview */}
        <aside className="space-y-4">
          <div className="bg-gradient-to-br from-white to-slate-50 p-3 rounded-2xl border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-700 text-xs">
                Saved lines ({auth.factory} – {auth.assigned_building})
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="text-[11px] px-2 py-1 rounded bg-sky-100 text-sky-700 hover:bg-sky-200"
              >
                + New line
              </button>
            </div>

            {records.length === 0 ? (
              <p className="text-[11px] text-gray-500">
                No line info saved yet for this factory/building.
              </p>
            ) : (
              <ul className="space-y-2 max-h-[360px] overflow-auto text-xs">
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
                      <span className="text-[11px] text-gray-500">
                        {r.buyer}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-600 mt-1">
                      Style: <span className="font-medium">{r.style}</span>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Item: {r.item} • Color: {r.color}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      SMV: {r.smv} • Run Day: {r.runDay}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      Factory: {r.factory} • Date: {r.date}
                    </div>
                    {(r.imageSrc || r.videoSrc) && (
                      <div className="mt-0.5 text-[10px] text-sky-600">
                        {r.imageSrc && "🖼️"} {r.videoSrc && "🎥"} media attached
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* small preview */}
          <div className="bg-white p-3 rounded-2xl border shadow-sm">
            <h3 className="font-semibold text-gray-700 text-xs">
              Current form preview
            </h3>
            <dl className="mt-2 text-[11px] text-gray-600 space-y-1.5">
              <Row label="Factory" value={auth.factory} />
              <Row label="Date" value={formValues.date} />
              <Row label="Assigned Building" value={auth.assigned_building} />
              <Row label="Buyer" value={formValues.buyer} />
              <Row label="Line" value={formValues.line} />
              <Row label="Style" value={formValues.style} />
              <Row label="Item" value={formValues.item} />
              <Row label="Color" value={formValues.color} />
              <Row label="SMV" value={formValues.smv} />
              <Row label="Run Day" value={formValues.runDay} />
              <Row label="Image URL" value={formValues.imageSrc} />
              <Row label="Video URL" value={formValues.videoSrc} />
            </dl>
          </div>
        </aside>

        {/* RIGHT: form */}
        <form
          className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm"
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
              className="w-full rounded-lg border px-3 py-1.5 focus:ring-2 focus:ring-sky-400 outline-none text-sm"
            />
          </Field>

          {/* Assigned building */}
          <Field label="Assigned Building">
            <input
              type="text"
              value={auth.assigned_building || ""}
              disabled
              className="w-full rounded-lg border px-3 py-1.5 bg-gray-100 text-gray-700 text-sm"
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
              className="w-full rounded-lg border px-3 py-1.5 focus:ring-2 focus:ring-sky-400 outline-none text-sm"
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
              className="w-full rounded-lg border px-3 py-1.5 focus:ring-2 focus:ring-sky-400 outline-none text-sm"
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
              className="w-full rounded-lg border px-3 py-1.5 focus:ring-2 focus:ring-sky-400 outline-none text-sm"
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
              className="w-full rounded-lg border px-3 py-1.5 focus:ring-2 focus:ring-sky-400 outline-none text-sm"
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
              className="w-full rounded-lg border px-3 py-1.5 focus:ring-2 focus:ring-sky-400 outline-none text-sm"
            />
          </Field>

          {/* Image URL + file */}
          <Field label="Image (URL or file)">
            <div className="space-y-2">
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={formValues.imageSrc}
                onChange={(e) => {
                  setFormValues({ ...formValues, imageSrc: e.target.value });
                  if (e.target.value) setImageFile(null);
                }}
                className="w-full rounded-lg border px-3 py-1.5 focus:ring-2 focus:ring-sky-400 outline-none text-sm"
              />
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center rounded-lg border border-dashed border-slate-400 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-700 hover:border-sky-500">
                  <span>Choose image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setImageFile(file || null);
                    }}
                  />
                </label>
                {imageFile && (
                  <span className="max-w-[140px] truncate text-[11px] text-gray-500">
                    {imageFile.name}
                  </span>
                )}
              </div>
            </div>
          </Field>

          {/* Video URL + file */}
          <Field label="Video (URL or file)">
            <div className="space-y-2">
              <input
                type="url"
                placeholder="https://example.com/video.mp4"
                value={formValues.videoSrc}
                onChange={(e) => {
                  setFormValues({ ...formValues, videoSrc: e.target.value });
                  if (e.target.value) setVideoFile(null);
                }}
                className="w-full rounded-lg border px-3 py-1.5 focus:ring-2 focus:ring-sky-400 outline-none text-sm"
              />
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center rounded-lg border border-dashed border-slate-400 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-700 hover:border-sky-500">
                  <span>Choose video</span>
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setVideoFile(file || null);
                    }}
                  />
                </label>
                {videoFile && (
                  <span className="max-w-[140px] truncate text-[11px] text-gray-500">
                    {videoFile.name}
                  </span>
                )}
              </div>
            </div>
          </Field>

          {/* Media preview */}
          <div className="md:col-span-2 mt-2">
            <h3 className="text-xs font-semibold text-gray-700 mb-2">
              Image & Video preview
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border rounded-lg p-2 bg-gray-50">
                <p className="text-[11px] text-gray-500 mb-1">Image</p>
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Line image"
                    className="w-full h-36 object-cover rounded"
                  />
                ) : (
                  <p className="text-[11px] text-gray-400">
                    No image selected
                  </p>
                )}
              </div>
              <div className="border rounded-lg p-2 bg-gray-50">
                <p className="text-[11px] text-gray-500 mb-1">Video</p>
                {videoPreview ? (
                  <video
                    src={videoPreview}
                    className="w-full h-36 rounded"
                    controls
                    muted
                  />
                ) : (
                  <p className="text-[11px] text-gray-400">
                    No video selected
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="md:col-span-2 flex items-center justify-between gap-3 mt-3">
            <div className="flex gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs"
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs disabled:opacity-70"
              >
                <Save size={14} />{" "}
                {editingId ? "Update Line" : "Save New Line"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="px-5 py-3 bg-gray-50 text-right text-[11px] text-gray-600 border-t">
        • HKD OUTDOOR INNOVATIONS LTD.
      </div>
    </section>
  );
}

/* ---------- helpers ---------- */
function Field({ label, children }) {
  return (
    <label className="flex flex-col text-[13px] text-gray-700 gap-1">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-800 max-w-[150px] text-right truncate">
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
          className="w-full rounded-lg border px-3 py-1.5 pr-8 focus:ring-2 focus:ring-sky-400 outline-none text-sm"
        />

        <div className="absolute right-2 top-2 text-gray-400">
          <Search size={14} />
        </div>
      </div>

      {open && (
        <ul className="absolute z-50 mt-1 max-h-40 w-full overflow-auto rounded-lg border bg-white shadow-lg text-xs">
          {filtered.length > 0 ? (
            filtered.map((opt) => (
              <li
                key={opt}
                onMouseDown={() => {
                  onChange(opt);
                  setQuery(opt);
                  setOpen(false);
                }}
                className={`cursor-pointer px-3 py-1.5 hover:bg-sky-600 hover:text-white ${
                  opt === value ? "bg-sky-100" : ""
                }`}
              >
                {opt}
              </li>
            ))
          ) : (
            <li className="px-3 py-1.5 text-gray-500 italic">
              No results found
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
