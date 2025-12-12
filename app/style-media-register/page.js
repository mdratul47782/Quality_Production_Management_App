// app/style-media-register/page.js
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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const makeEmptyForm = () => ({
  factory: "",
  assigned_building: "",
  buyer: "",
  style: "",
  color_model: "",
  effectiveFrom: todayIso(),
  imageSrc: "",
  videoSrc: "",
});

export default function StyleMediaRegisterPage() {
  const { auth } = useAuth();

  const [formValues, setFormValues] = useState(makeEmptyForm());
  const [records, setRecords] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // file + preview
  const [imageFile, setImageFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [videoPreview, setVideoPreview] = useState("");

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImagePreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setImagePreview(formValues.imageSrc || "");
  }, [imageFile, formValues.imageSrc]);

  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setVideoPreview(formValues.videoSrc || "");
  }, [videoFile, formValues.videoSrc]);

  useEffect(() => {
    if (!auth) return;

    if (!auth.factory || !auth.assigned_building) {
      setLoading(false);
      return;
    }

    setFormValues((p) => ({
      ...p,
      factory: auth.factory,
      assigned_building: auth.assigned_building,
    }));

    fetchRecords(auth.factory, auth.assigned_building);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.factory, auth?.assigned_building]);

  const fetchRecords = async (factory, assigned_building) => {
    if (!factory || !assigned_building) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ factory, assigned_building });
      const res = await fetch(`/api/style-media?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success) setRecords(json.data || []);
      else console.error(json.message);
    } catch (err) {
      console.error("fetch style-media error:", err);
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
    const keys = ["factory", "assigned_building", "buyer", "style", "color_model", "effectiveFrom"];
    for (const k of keys) if (!formValues[k]) return false;
    return true;
  };

  const handleSave = async () => {
    if (!auth) return alert("Please login.");
    if (!validate()) return alert("Please fill required fields.");

    setSaving(true);
    try {
      const userId = auth._id || auth.id || auth.user?.id || auth.user?._id || "";
      const method = editingId ? "PUT" : "POST";

      const fd = new FormData();
      fd.append("factory", auth.factory);
      fd.append("assigned_building", auth.assigned_building);
      fd.append("buyer", formValues.buyer);
      fd.append("style", formValues.style);
      fd.append("color_model", formValues.color_model);
      fd.append("effectiveFrom", formValues.effectiveFrom);
      fd.append("imageSrc", formValues.imageSrc || "");
      fd.append("videoSrc", formValues.videoSrc || "");
      fd.append("userId", userId);
      fd.append("userName", auth.user_name || auth.user?.user_name || "");

      if (editingId) fd.append("id", editingId);
      if (imageFile) fd.append("imageFile", imageFile);
      if (videoFile) fd.append("videoFile", videoFile);

      const res = await fetch("/api/style-media", { method, body: fd });
      const json = await res.json();

      alert(json.message || "Saved!");
      if (json.success) {
        await fetchRecords(auth.factory, auth.assigned_building);
        resetForm();
      }
    } catch (err) {
      console.error(err);
      alert("Save failed. Check console.");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!editingId) return;
    if (!confirm("Delete this style media?")) return;

    try {
      const res = await fetch(`/api/style-media?id=${editingId}`, { method: "DELETE" });
      const json = await res.json();
      alert(json.message || "Deleted");
      if (json.success) {
        await fetchRecords(auth.factory, auth.assigned_building);
        resetForm();
      }
    } catch (err) {
      console.error(err);
      alert("Delete failed.");
    }
  };

  const handleEditClick = (r) => {
    setEditingId(r._id);
    setImageFile(null);
    setVideoFile(null);
    setFormValues({
      factory: r.factory || auth?.factory || "",
      assigned_building: r.assigned_building || auth?.assigned_building || "",
      buyer: r.buyer || "",
      style: r.style || "",
      color_model: r.color_model || "",
      effectiveFrom: r.effectiveFrom || todayIso(),
      imageSrc: r.imageSrc || "",
      videoSrc: r.videoSrc || "",
    });
  };

  if (!auth) {
    return (
      <section className="max-w-3xl mx-auto mt-12 text-center text-gray-600">
        Please login to access this page.
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
    <section className="max-w-3xl mx-auto bg-white border border-gray-200 shadow-xl rounded-2xl mt-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center bg-gradient-to-br from-blue-600 to-blue-700 text-white px-4 py-2 rounded-t-lg gap-3">
        <div className="w-10 h-10 bg-white rounded-md flex items-center justify-center">
          <Image src="/HKD_LOGO.png" alt="HKD Logo" width={64} height={64} priority />
        </div>
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold leading-tight">
            HKD Outdoor Innovations Ltd.
          </h1>
          <p className="text-sm opacity-90">Style Media Register – {auth.assigned_building}</p>
          <p className="text-xs opacity-80">
            Factory: <span className="font-semibold">{auth.factory}</span> • Inputter:{" "}
            <span className="font-semibold">{auth.user_name}</span>
          </p>
        </div>
      </div>

      <div className="px-5 py-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT: list */}
        <aside className="space-y-4">
          <div className="bg-gradient-to-br from-white to-slate-50 p-3 rounded-2xl border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-700 text-xs">
                Saved style media ({auth.factory} – {auth.assigned_building})
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="text-[11px] px-2 py-1 rounded bg-sky-100 text-sky-700 hover:bg-sky-200"
              >
                + New
              </button>
            </div>

            {records.length === 0 ? (
              <p className="text-[11px] text-gray-500">No style media saved yet.</p>
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
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-gray-800 truncate">{r.style}</span>
                      <span className="text-[11px] text-gray-500 truncate">{r.buyer}</span>
                    </div>
                    <div className="text-[11px] text-gray-600 mt-1">
                      Color/Model: <span className="font-medium">{r.color_model}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      From: {r.effectiveFrom} {r.effectiveTo ? `• To: ${r.effectiveTo}` : "• Active"}
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

          {/* preview */}
          <div className="bg-white p-3 rounded-2xl border shadow-sm">
            <h3 className="font-semibold text-gray-700 text-xs">Current form preview</h3>
            <dl className="mt-2 text-[11px] text-gray-600 space-y-1.5">
              <Row label="Factory" value={auth.factory} />
              <Row label="Floor" value={auth.assigned_building} />
              <Row label="Buyer" value={formValues.buyer} />
              <Row label="Style" value={formValues.style} />
              <Row label="Color/Model" value={formValues.color_model} />
              <Row label="Effective From" value={formValues.effectiveFrom} />
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
          <Field label="Assigned Building">
            <input
              type="text"
              value={auth.assigned_building || ""}
              disabled
              className="w-full rounded-lg border px-3 py-1.5 bg-gray-100 text-gray-700 text-sm"
            />
          </Field>

          <Field label="Factory">
            <input
              type="text"
              value={auth.factory || ""}
              disabled
              className="w-full rounded-lg border px-3 py-1.5 bg-gray-100 text-gray-700 text-sm"
            />
          </Field>

          <Field label="Buyer">
            <SearchableDropdown
              options={buyers}
              value={formValues.buyer}
              onChange={(val) => setFormValues({ ...formValues, buyer: val })}
              placeholder="Select buyer"
            />
          </Field>

          <Field label="Effective From (Start date)">
            <input
              type="date"
              value={formValues.effectiveFrom}
              onChange={(e) => setFormValues({ ...formValues, effectiveFrom: e.target.value })}
              className="w-full rounded-lg border px-3 py-1.5 focus:ring-2 focus:ring-sky-400 outline-none text-sm"
            />
          </Field>

          <Field label="Style Number">
            <input
              type="text"
              placeholder="Enter style number"
              value={formValues.style}
              onChange={(e) => setFormValues({ ...formValues, style: e.target.value })}
              className="w-full rounded-lg border px-3 py-1.5 focus:ring-2 focus:ring-sky-400 outline-none text-sm"
            />
          </Field>

          <Field label="Color/Model">
            <input
              type="text"
              placeholder="Enter color/model"
              value={formValues.color_model}
              onChange={(e) => setFormValues({ ...formValues, color_model: e.target.value })}
              className="w-full rounded-lg border px-3 py-1.5 focus:ring-2 focus:ring-sky-400 outline-none text-sm"
            />
          </Field>

          {/* Image */}
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
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
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

          {/* Video */}
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
                    onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
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
            <h3 className="text-xs font-semibold text-gray-700 mb-2">Image & Video preview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border rounded-lg p-2 bg-gray-50">
                <p className="text-[11px] text-gray-500 mb-1">Image</p>
                {imagePreview ? (
                  <img src={imagePreview} alt="Style image" className="w-full h-36 object-cover rounded" />
                ) : (
                  <p className="text-[11px] text-gray-400">No image</p>
                )}
              </div>

              <div className="border rounded-lg p-2 bg-gray-50">
                <p className="text-[11px] text-gray-500 mb-1">Video</p>
                {videoPreview ? (
                  <video src={videoPreview} className="w-full h-36 rounded" controls muted />
                ) : (
                  <p className="text-[11px] text-gray-400">No video</p>
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
                <Save size={14} /> {editingId ? "Update" : "Save"}
              </button>
            </div>

            <button
              type="button"
              onClick={resetForm}
              className="text-xs px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      <div className="px-5 py-3 bg-gray-50 text-right text-[11px] text-gray-600 border-t">
        • HKD OUTDOOR INNOVATIONS LTD.
      </div>
    </section>
  );
}

/* helpers */
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
    ? options.filter((opt) => opt.toLowerCase().includes(query.toLowerCase()))
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
            <li className="px-3 py-1.5 text-gray-500 italic">No results found</li>
          )}
        </ul>
      )}
    </div>
  );
}
