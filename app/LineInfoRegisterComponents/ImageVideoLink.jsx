"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";

export default function MediaLinksEditor() {
  const { auth } = useAuth();
  const [editing, setEditing] = useState(false);
  const [imageSrc, setImageSrc] = useState("");
  const [videoSrc, setVideoSrc] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [videoPreview, setVideoPreview] = useState("");
  const [savedData, setSavedData] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false); // ⬅️ NEW

  // Fetch existing media links on mount
  useEffect(() => {
    if (!auth?.id) return;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/media-links?userId=${auth.id}`);
        const json = await res.json();

        if (json.data) {
          setSavedData(json.data);
          setImageSrc(json.data.imageSrc || "");
          setVideoSrc(json.data.videoSrc || "");
        }
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [auth?.id]);

  // Preview handling for image
  useEffect(() => {
    if (imageFile) {
      const objectUrl = URL.createObjectURL(imageFile);
      setImagePreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else {
      setImagePreview(imageSrc || "");
    }
  }, [imageFile, imageSrc]);

  // Preview handling for video
  useEffect(() => {
    if (videoFile) {
      const objectUrl = URL.createObjectURL(videoFile);
      setVideoPreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else {
      setVideoPreview(videoSrc || "");
    }
  }, [videoFile, videoSrc]);

  const isValidUrl = (u) => {
    if (!u) return true;
    try {
      new URL(u);
      return true;
    } catch {
      return false;
    }
  };

  const imageOk = !!imageFile || isValidUrl(imageSrc);
  const videoOk = !!videoFile || isValidUrl(videoSrc);

  const handleSave = async () => {
    setStatus(null);
    setSaving(true); // ⬅️ start saving

    if (!imageOk || !videoOk) {
      setStatus({
        type: "error",
        msg: "Please enter valid URLs or upload files.",
      });
      setSaving(false);
      return;
    }

    if (!auth?.id || !auth?.user_name) {
      setStatus({ type: "error", msg: "Missing user information." });
      setSaving(false);
      return;
    }

    const formData = new FormData();
    formData.append("userId", auth.id);
    formData.append("userName", auth.user_name);

    if (imageFile) {
      formData.append("imageFile", imageFile);
    } else {
      formData.append("imageSrc", imageSrc?.trim() || "");
    }

    if (videoFile) {
      formData.append("videoFile", videoFile);
    } else {
      formData.append("videoSrc", videoSrc?.trim() || "");
    }

    try {
      const method = savedData ? "PATCH" : "POST";
      const res = await fetch("/api/media-links", {
        method,
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Save failed");
      }

      setSavedData(json.data);
      setImageSrc(json.data.imageSrc || "");
      setVideoSrc(json.data.videoSrc || "");
      setImageFile(null);
      setVideoFile(null);
      setEditing(false);
      setStatus({ type: "ok", msg: "Media updated successfully." });
    } catch (error) {
      console.error(error);
      setStatus({ type: "error", msg: error.message });
    } finally {
      setSaving(false); // ⬅️ stop saving
    }
  };

  const handleCancel = () => {
    setStatus(null);
    setImageFile(null);
    setVideoFile(null);

    if (savedData) {
      setImageSrc(savedData.imageSrc || "");
      setVideoSrc(savedData.videoSrc || "");
    } else {
      setImageSrc("");
      setVideoSrc("");
    }
    setEditing(false);
  };

  if (!auth) {
    return (
      <div className="py-6 text-center text-sm text-red-500">
        Please log in to manage media links.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl p-4">
        <div className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <div className="mb-4 h-4 w-32 rounded bg-slate-700" />
          <div className="mb-2 h-32 w-full rounded bg-slate-800" />
          <div className="h-3 w-24 rounded bg-slate-700" />
        </div>
      </div>
    );
  }

  const saveButtonLabel =
    saving ? "Saving..." : status?.type === "ok" ? "Saved" : "Save changes";

  return (
    <div className="mx-auto w-full max-w-5xl p-4">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-5 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-50">
              Media Manager
              <span className="rounded-full border border-emerald-700/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                {auth.user_name || "User"}
              </span>
            </h2>
            <p className="mt-1 text-[11px] text-slate-400">
              Upload an image and a video or use direct URLs. These links will
              be used in other components.
            </p>
          </div>

          {!editing ? (
            <button
              className="inline-flex items-center rounded-full bg-slate-100 px-4 py-1.5 text-xs font-medium text-slate-900 transition hover:bg-white"
              onClick={() => setEditing(true)}
            >
              Edit media
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
                onClick={handleSave}
                disabled={!imageOk || !videoOk || saving}
              >
                {saveButtonLabel}
              </button>
              <button
                className="inline-flex items-center rounded-full bg-slate-800 px-4 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Status Message */}
        {status && (
          <div
            className={`mb-4 rounded-lg border px-3 py-2 text-xs ${
              status.type === "ok"
                ? "border-emerald-700/60 bg-emerald-500/10 text-emerald-200"
                : "border-rose-700/60 bg-rose-500/10 text-rose-200"
            }`}
          >
            {status.msg}
          </div>
        )}

        {/* Content layout */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* IMAGE COLUMN */}
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-slate-100">Image</h3>
                <p className="text-[11px] text-slate-400">
                  Upload an image or provide a direct URL.
                </p>
              </div>
              {imageSrc && !imageFile && (
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                  From URL
                </span>
              )}
              {imageFile && (
                <span className="rounded-full bg-emerald-600/20 px-2 py-0.5 text-[10px] text-emerald-300">
                  Local file
                </span>
              )}
            </div>

            {editing ? (
              <>
                {/* URL input */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] text-slate-300">
                    Image URL
                    <span className="text-slate-500">
                      {" "}
                      (optional if you upload a file)
                    </span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={imageSrc}
                    onChange={(e) => {
                      setImageSrc(e.target.value);
                      if (e.target.value) setImageFile(null);
                    }}
                    className={`w-full rounded-lg border bg-slate-950 px-3 py-1.5 text-xs text-slate-100 outline-none transition ${
                      imageOk
                        ? "border-slate-700 focus:border-emerald-500"
                        : "border-rose-500"
                    }`}
                  />
                </div>

                {/* File input */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] text-slate-300">
                    Upload Image
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center rounded-lg border border-dashed border-slate-600 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-200 transition hover:border-emerald-500 hover:bg-slate-900/80">
                      <span>Choose file</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          setImageFile(file || null);
                          if (file) {
                            setImageSrc("");
                          }
                        }}
                      />
                    </label>
                    {imageFile && (
                      <span className="max-w-[140px] truncate text-[11px] text-slate-400">
                        {imageFile.name}
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <div className="text-[11px] text-slate-400">Stored URL</div>
                {imageSrc ? (
                  <a
                    href={imageSrc}
                    target="_blank"
                    rel="noreferrer"
                    className="block break-all text-[11px] text-emerald-300 underline"
                  >
                    {imageSrc}
                  </a>
                ) : (
                  <span className="text-[11px] text-slate-500">
                    No image set
                  </span>
                )}
              </div>
            )}

            {/* Image preview */}
            <div className="pt-2">
              <div className="mb-1.5 text-[11px] text-slate-400">Preview</div>
              <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Image preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-[11px] text-slate-600">
                    No image to preview
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* VIDEO COLUMN */}
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-slate-100">Video</h3>
                <p className="text-[11px] text-slate-400">
                  Upload a video or provide a direct URL (MP4, etc.).
                </p>
              </div>
              {videoSrc && !videoFile && (
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                  From URL
                </span>
              )}
              {videoFile && (
                <span className="rounded-full bg-emerald-600/20 px-2 py-0.5 text-[10px] text-emerald-300">
                  Local file
                </span>
              )}
            </div>

            {editing ? (
              <>
                {/* URL input */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] text-slate-300">
                    Video URL
                    <span className="text-slate-500">
                      {" "}
                      (optional if you upload a file)
                    </span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/video.mp4"
                    value={videoSrc}
                    onChange={(e) => {
                      setVideoSrc(e.target.value);
                      if (e.target.value) setVideoFile(null);
                    }}
                    className={`w-full rounded-lg border bg-slate-950 px-3 py-1.5 text-xs text-slate-100 outline-none transition ${
                      videoOk
                        ? "border-slate-700 focus:border-emerald-500"
                        : "border-rose-500"
                    }`}
                  />
                </div>

                {/* File input */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] text-slate-300">
                    Upload Video
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center rounded-lg border border-dashed border-slate-600 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-200 transition hover:border-emerald-500 hover:bg-slate-900/80">
                      <span>Choose file</span>
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          setVideoFile(file || null);
                          if (file) {
                            setVideoSrc("");
                          }
                        }}
                      />
                    </label>
                    {videoFile && (
                      <span className="max-w-[140px] truncate text-[11px] text-slate-400">
                        {videoFile.name}
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <div className="text-[11px] text-slate-400">Stored URL</div>
                {videoSrc ? (
                  <a
                    href={videoSrc}
                    target="_blank"
                    rel="noreferrer"
                    className="block break-all text-[11px] text-emerald-300 underline"
                  >
                    {videoSrc}
                  </a>
                ) : (
                  <span className="text-[11px] text-slate-500">
                    No video set
                  </span>
                )}
              </div>
            )}

            {/* Video preview */}
            <div className="pt-2">
              <div className="mb-1.5 text-[11px] text-slate-400">Preview</div>
              <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                {videoPreview ? (
                  <video
                    src={videoPreview}
                    className="h-full w-full object-cover"
                    controls
                    muted
                    playsInline
                  />
                ) : (
                  <span className="text-[11px] text-slate-600">
                    No video to preview
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tiny helper note */}
        <p className="mt-4 text-right text-[10px] text-slate-500">
          Tip: In your other components you can auto-play this video via{" "}
          <code className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5">
            &lt;video src=&#123;videoSrc&#125; autoPlay muted loop /&gt;
          </code>
        </p>
      </div>
    </div>
  );
}
