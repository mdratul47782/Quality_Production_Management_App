// lib/makeStyleMediaDummy.js  (ESM-safe, works on Windows)
// Run: node lib/makeStyleMediaDummy.js .\data\Quality_Production_DB.hourlyproductions2.json

import fs from "node:fs";
import path from "node:path";

const IMAGE_LINKS = [
  "https://source.unsplash.com/TQSvFz7NHuo/1200x800",
  "https://plus.unsplash.com/premium_photo-1765796096863-05dbe7561ace?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHwyfHx8ZW58MHx8fHx8",
  "https://plus.unsplash.com/premium_photo-1675186049366-64a655f8f537?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8Y2xvdGhlc3xlbnwwfHwwfHx8MA%3D%3D",
  "https://source.unsplash.com/Fg15LdqpWrs/1200x800",
  "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8Y2xvdGhlc3xlbnwwfHwwfHx8MA%3D%3D",
  "https://images.unsplash.com/photo-1532453288672-3a27e9be9efd?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8Y2xvdGhlc3xlbnwwfHwwfHx8MA%3D%3D",
  "https://plus.unsplash.com/premium_photo-1673125287084-e90996bad505?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OXx8Y2xvdGhlc3xlbnwwfHwwfHx8MA%3D%3D",
  "https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fGNsb3RoZXN8ZW58MHx8MHx8fDA%3D",
];

const VIDEO_LINKS = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://www.w3schools.com/html/mov_bbb.mp4",
  "https://media.w3.org/2010/05/sintel/trailer.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  "https://download.samplelib.com/mp4/sample-5s.mp4",
];

const COLORS = ["BLUE", "BLACK", "NAVY", "RED", "GREEN", "WHITE", "YELLOW", "GREY"];

function readJsonFile(absPath) {
  const raw = fs.readFileSync(absPath, "utf8");
  return JSON.parse(raw);
}

// ✅ Accept input path from CLI, otherwise try common locations
const inputArg = process.argv[2];
const candidates = [
  inputArg && path.resolve(process.cwd(), inputArg),
  path.resolve(process.cwd(), "data", "Quality_Production_DB.hourlyproductions2.json"),
  path.resolve(process.cwd(), "lib", "Quality_Production_DB.hourlyproductions2.json"),
  path.resolve(process.cwd(), "Quality_Production_DB.hourlyproductions2.json"),
].filter(Boolean);

let inputPath = null;
for (const p of candidates) {
  if (fs.existsSync(p)) {
    inputPath = p;
    break;
  }
}

if (!inputPath) {
  console.error("❌ Input JSON file not found. Tried:");
  for (const p of candidates) console.error("  -", p);
  console.error(
    "\n✅ Fix: Put your JSON file in /data OR pass the path:\n" +
      "node lib/makeStyleMediaDummy.js .\\data\\Quality_Production_DB.hourlyproductions2.json"
  );
  process.exit(1);
}

const hourly = readJsonFile(inputPath);

function makeKey(r) {
  const u = r.productionUser || {};
  return [
    r.factory,
    r.assigned_building,
    r.buyer,
    String(r.style),
    String(u.id || ""),
    String(u.Production_user_name || u.user_name || ""),
  ].join("|");
}

const map = new Map();

for (const r of hourly) {
  const k = makeKey(r);
  const u = r.productionUser || {};
  const prev = map.get(k);

  const doc = prev || {
    factory: r.factory,
    assigned_building: r.assigned_building,
    buyer: r.buyer,
    style: String(r.style),
    color_model: "",
    effectiveFrom: r.productionDate || new Date().toISOString().slice(0, 10),
    effectiveTo: "",
    imageSrc: "",
    videoSrc: "",
    user: { id: u.id, user_name: u.Production_user_name || u.user_name || "" },
  };

  // keep latest effectiveFrom
  const d = String(r.productionDate || "");
  if (!prev || (d && d > String(doc.effectiveFrom))) doc.effectiveFrom = d;

  map.set(k, doc);
}

const docs = Array.from(map.values()).map((d, i) => ({
  ...d,
  color_model: COLORS[i % COLORS.length],
  imageSrc: IMAGE_LINKS[i % IMAGE_LINKS.length],
  videoSrc: VIDEO_LINKS[i % VIDEO_LINKS.length],
}));

const outPath = path.resolve(process.cwd(), "data", "styleMediaDummy.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(docs, null, 2));

console.log("✅ Input:", inputPath);
console.log("✅ Output:", outPath);
console.log("✅ Wrote:", docs.length, "style-media docs");
