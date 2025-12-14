// lib/generateDummyData.js

// ---------- helper utils ----------

function makeObjectId() {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 24; i++) out += hex[Math.floor(Math.random() * hex.length)];
  return out;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, digits = 2) {
  const n = Math.random() * (max - min) + min;
  return parseFloat(n.toFixed(digits));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatDateFromOffset(base, offsetDays) {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() - offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ✅ hour label to match HOUR_COLUMNS
function makeHourLabel(hourIndex) {
  if (hourIndex === 1) return "1st Hour";
  if (hourIndex === 2) return "2nd Hour";
  if (hourIndex === 3) return "3rd Hour";
  return `${hourIndex}th Hour`;
}

// ✅ split header.target_full_day into per-hour targets (sum must equal total)
function makeHourlyTargets(total, hours) {
  const weights = Array.from({ length: hours }, (_, i) => 1 + i * 0.12); // ramp up
  const wSum = weights.reduce((a, b) => a + b, 0);

  const targets = weights.map((w) => Math.max(0, Math.round((total * w) / wSum)));

  // fix rounding drift so sum == total
  const sum = targets.reduce((a, b) => a + b, 0);
  targets[targets.length - 1] += total - sum;

  return targets;
}

// ---------- pools ----------

const FACTORIES = ["K-1", "K-2", "K-3"];
const BUILDINGS = ["A-2", "B-2", "A-3", "B-3", "A-4", "B-4", "A-5", "B-5"];

const LINES = [
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
  // add more if you want:
  // "Line-13","Line-14","Line-15",
];

const BUYERS = ["Decathlon - knit", "Decathlon - woven", "Walmart", "Columbia", "ZXY"];
const ITEMS = ["T-Shirt", "Polo", "Jacket", "Shorts", "Trouser"];
const COLORS = ["Blue", "Black", "Navy", "Grey", "Red", "Green"];

const DEFECTS = [
  "301 - OPEN SEAM",
  "302 - SKIP STITCH",
  "303 - RUN OFF STITCH",
  "304 - UNEVEN STITCH",
  "305 - DOWN / OFF STITCH",
  "306 - BROKEN STITCH",
  "307 - FAULTY SEWING",
  "308 - NEEDLE MARK",
  "309 - IMPROPER JOINT STITCH",
  "310 - IMPROPER STITCH TENSION",
  "311 - STITCH MAGINE VARIATION",
  "312 - LABEL MISTAKE",
  "313 - LOOSENESS",
  "314 - INCORRECT PRINT",
  "315 - SHADE MISMATCH",
  "316 - PUCKERING",
  "317 - PLEATS",
  "318 - GATHERING STITCH",
  "319 - UNCUT-THREAD",
  "320 - INCORRECT POINT",
  "321 - SHADING",
  "322 - UP DOWN / HIGH LOW",
  "323 - POOR / INSECURE TAPING",
  "324 - OFF SHAPE / POOR SHAPE",
  "325 - STRIPE UNEVEN / MISMATCH",
  "326 - OVERLAPPING",
  "327 - INSECURE BARTACK",
  "328 - TRIMS MISSING",
  "329 - WRONG TRIMS ATTCHMENT",
  "330 - WRONG/IMPROPER PLACMNT",
  "331 - WRONG ALINGMENT",
  "332 - INTERLINING TWISTING",
  "333 - FUSING BUBBLES",
  "334 - SHARP POINT",
  "335 - ZIPPER WAVY",
  "336 - SLUNTED",
  "337 - ROPING",
  "338 - DIRTY SPOT",
  "339 - HI-KING",
  "340 - VELCRO EDGE SHARPNESS",
  "341 - PEEL OFF H.T SEAL/PRINTING",
  "342 - DAMAGE",
  "343 - OIL STAIN",
  "344 - IREGULAR SPI",
  "345 - FABRIC FAULT",
  "346 - CAUGHT BY STITCH",
  "347 - WRONG THREAD ATTCH",
  "348 - PROCESS MISSING",
  "349 - RAW EDGE OUT",
  "350 - INSECURE BUTTON / EYELET",
  "351 - KNOT",
  "352 - DYEING PROBLEM",
  "353 - MISSING YARN",
  "354 - DIRTY MARK",
  "355 - SLUB",
  "356 - GLUE MARK",
  "357 - THICK YARN",
  "358 - PRINT PROBLEM",
  "359 - STOP MARK",
  "360 - DOET MISSING",
  "361 - HOLE",
  "362 - SCESSIOR CUT",
  "363 - PEN MARK",
  "364 - BRUSH PROBLEM",
  "365 - NICKEL OUT",
  "366 - COATING PROBLEM",
];

// ---------- contexts (factory + floor/building) ----------

function normalizeContexts(options = {}) {
  // 1) explicit contexts (best)
  if (Array.isArray(options.contexts) && options.contexts.length) {
    return options.contexts
      .map((c) => ({
        factory: String(c.factory || "").trim(),
        building: String(c.building || c.assigned_building || "").trim(),
      }))
      .filter((c) => c.factory && c.building);
  }

  // 2) generate from factories + buildingsByFactory/buildings + floorsPerFactory
  const factories = Array.isArray(options.factories) && options.factories.length ? options.factories : FACTORIES;

  const buildingsByFactory =
    options.buildingsByFactory && typeof options.buildingsByFactory === "object"
      ? options.buildingsByFactory
      : null;

  const defaultBuildings =
    Array.isArray(options.buildings) && options.buildings.length ? options.buildings : BUILDINGS;

  const floorsPerFactory = options.floorsPerFactory; // number OR { "K-2": 2, ... }

  const out = [];
  for (const f of factories) {
    const blds = (buildingsByFactory && buildingsByFactory[f]) || defaultBuildings;
    const uniq = Array.from(new Set(blds.map((x) => String(x).trim()).filter(Boolean)));

    let count =
      typeof floorsPerFactory === "number"
        ? floorsPerFactory
        : floorsPerFactory && typeof floorsPerFactory === "object" && typeof floorsPerFactory[f] === "number"
        ? floorsPerFactory[f]
        : uniq.length;

    count = Math.max(1, Math.min(count, uniq.length));
    const picked = shuffle(uniq).slice(0, count);

    for (const b of picked) out.push({ factory: f, building: b });
  }

  return out.length ? out : [{ factory: "K-2", building: "A-2" }];
}

// ---------- users per context ----------

function buildUsersForContexts(contexts) {
  // make one user per (factory+building) so auth + filters always match
  const users = [];
  const userInfoByKey = {}; // key = `${factory}__${building}`

  for (const ctx of contexts) {
    const _id = makeObjectId();
    const user_name = `ratul`;

    users.push({
      _id,
      user_name,
      password: "123",
      role: "Developer",
      assigned_building: ctx.building,
      factory: ctx.factory,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    userInfoByKey[`${ctx.factory}__${ctx.building}`] = {
      id: _id,
      user_name,
      role: "Developer",
    };
  }

  return { users, userInfoByKey };
}

// ---------- main generator ----------

function generateAllDummyData(options = {}) {
  const { days = 20, hoursPerDay = 8 } = options;

  const safeHoursPerDay = Math.min(Math.max(hoursPerDay, 1), 12);

  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);

  const contexts = normalizeContexts(options);
  const { users, userInfoByKey } = buildUsersForContexts(contexts);

  const lineInfos = [];
  const styleCapacities = [];
  const targetHeaders = [];
  const hourlyProductions = [];
  const hourlyInspections = [];

  // capacity per unique (factory+building+line+buyer+style)
  const capacityByKey = {};

  // 1) Line info + style capacity (today only)
  const todayStr = formatDateFromOffset(baseDate, 0);

  for (const ctx of contexts) {
    const factory = ctx.factory;
    const building = ctx.building;
    const u = userInfoByKey[`${factory}__${building}`];

    for (const line of LINES) {
      const buyer = pick(BUYERS);
      const style = String(randomInt(320000, 399999));
      const item = pick(ITEMS);
      const color = pick(COLORS);
      const smvNum = randomFloat(8, 18, 2);

      lineInfos.push({
        factory,
        buyer,
        assigned_building: building,
        line,
        style,
        item,
        color,
        smv: smvNum.toFixed(2),
        runDay: "1",
        date: todayStr,
        imageSrc:
          "https://res.cloudinary.com/df8fxkmdo/image/upload/v1763527164/media-links/images/e6curndblk1tthld41ay.jpg",
        videoSrc:
          "https://res.cloudinary.com/df8fxkmdo/video/upload/v1763527167/media-links/videos/dacta6s8bgf6fb1bq2sw.mp4",
        user: { id: u.id, user_name: u.user_name },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const capKey = `${factory}__${building}__${line}__${buyer}__${style}`;
      if (!capacityByKey[capKey]) {
        const capacity = randomInt(800, 1600);
        capacityByKey[capKey] = capacity;

        styleCapacities.push({
          factory,
          assigned_building: building,
          line,
          buyer,
          style,
          date: todayStr,
          capacity,
          user: { id: u.id, user_name: u.user_name, role: u.role },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  function findLineInfo(factory, building, line) {
    return lineInfos.find(
      (doc) =>
        doc.factory === factory &&
        doc.assigned_building === building &&
        doc.line === line
    );
  }

  // 2) TargetSetterHeader + HourlyProduction (per context)
  for (const ctx of contexts) {
    const factory = ctx.factory;
    const building = ctx.building;
    const u = userInfoByKey[`${factory}__${building}`];

    for (const line of LINES) {
      const lineInfo = findLineInfo(factory, building, line);
      if (!lineInfo) continue;

      const { buyer, style, color, smv: smvStr } = lineInfo;
      const smvNum = parseFloat(smvStr) || 12.5;

      const capKey = `${factory}__${building}__${line}__${buyer}__${style}`;
      const capacity =
        typeof capacityByKey[capKey] === "number" ? capacityByKey[capKey] : randomInt(800, 1600);

      for (let d = 0; d < days; d++) {
        const dateStr = formatDateFromOffset(baseDate, d);
        const run_day = d + 1;

        const total_manpower = randomInt(35, 50);
        const manpower_present = randomInt(
          Math.floor(total_manpower * 0.7),
          total_manpower
        );
        const manpower_absent = total_manpower - manpower_present;

        const working_hour = safeHoursPerDay;
        const plan_quantity = randomInt(900, 1600);
        const plan_efficiency_percent = randomInt(65, 90);

        // ✅ header target (plan)
        const targetFullRaw =
          (manpower_present * working_hour * 60 * plan_efficiency_percent) /
          (smvNum * 100);
        const target_full_day = Math.max(0, Math.round(targetFullRaw));

        const headerId = makeObjectId();

        targetHeaders.push({
          _id: headerId,
          date: dateStr,
          factory,
          assigned_building: building,
          line,
          buyer,
          style,
          run_day,
          color_model: color,
          total_manpower,
          manpower_present,
          manpower_absent,
          working_hour,
          plan_quantity,
          plan_efficiency_percent,
          smv: parseFloat(smvNum.toFixed(2)),
          target_full_day,
          capacity,
          user: { id: u.id, user_name: u.user_name, role: u.role },
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // ✅ divide header target by hour
        const hourlyTargets = makeHourlyTargets(target_full_day, working_hour);

        let targetToDate = 0;
        let netVar = 0;
        let effSum = 0;

        // drift achieved so variance sometimes up sometimes down
        let factor = 0.95 + Math.random() * 0.1;

        const startTime = new Date(`${dateStr}T09:00:00`);

        for (let hour = 1; hour <= working_hour; hour++) {
          const baseTargetPerHour = hourlyTargets[hour - 1];

          targetToDate += baseTargetPerHour;
          const dynamicTarget = targetToDate;

          factor += (Math.random() - 0.5) * 0.25;
          factor = Math.min(1.35, Math.max(0.65, factor));

          const achievedQty = Math.max(
            0,
            Math.round(baseTargetPerHour * factor + randomInt(-5, 5))
          );

          const varianceQty = achievedQty - baseTargetPerHour;
          netVar += varianceQty;

          const hourlyEfficiency = parseFloat(
            ((achievedQty * smvNum * 100) / (manpower_present * 60)).toFixed(2)
          );

          const achieveEfficiency = parseFloat(
            ((baseTargetPerHour * smvNum * 100) / (manpower_present * 60)).toFixed(2)
          );

          effSum += hourlyEfficiency;
          const totalEfficiency = parseFloat((effSum / hour).toFixed(2));

          const updatedAt = new Date(startTime.getTime());
          updatedAt.setMinutes(updatedAt.getMinutes() + hour * randomInt(20, 45));

          hourlyProductions.push({
            headerId,
            productionDate: dateStr,
            hour,
            achievedQty,

            baseTargetPerHour,
            dynamicTarget,

            varianceQty,
            cumulativeVariance: netVar,

            hourlyEfficiency,
            achieveEfficiency,
            totalEfficiency,

            factory,
            assigned_building: building,
            line,
            buyer,
            style,
            productionUser: {
              id: u.id,
              Production_user_name: u.user_name,
              phone: "",
              bio: "",
            },
            createdAt: updatedAt,
            updatedAt,
          });
        }
      }
    }
  }

  // 3) HourlyInspection dummy data (per context)
  for (const ctx of contexts) {
    const factory = ctx.factory;
    const building = ctx.building;
    const u = userInfoByKey[`${factory}__${building}`];

    for (const line of LINES) {
      for (let d = 0; d < days; d++) {
        const dateObj = new Date(baseDate.getTime());
        dateObj.setDate(dateObj.getDate() - d);
        const reportDate = new Date(dateObj.toDateString()); // local 00:00

        for (let hourIndex = 1; hourIndex <= safeHoursPerDay; hourIndex++) {
          const inspectedQty = randomInt(80, 200);
          const defectivePcs = randomInt(0, 15);
          const passedQty = inspectedQty - defectivePcs;
          const afterRepair = randomInt(0, defectivePcs);

          const selectedDefects = DEFECTS.filter(() => Math.random() < 0.5).map(
            (name) => ({
              name,
              quantity: randomInt(1, 5),
            })
          );

          const totalDefects = selectedDefects.reduce(
            (sum, it) => sum + it.quantity,
            0
          );

          hourlyInspections.push({
            user: { id: u.id, user_name: u.user_name },
            factory,
            building, // keep for your existing schema
            assigned_building: building, // also include (helps if some APIs use this)
            reportDate,
            hourLabel: makeHourLabel(hourIndex),
            hourIndex,
            inspectedQty,
            passedQty,
            defectivePcs,
            afterRepair,
            totalDefects,
            selectedDefects,
            line,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    }
  }

  return {
    contexts,
    users,
    lineInfos,
    styleCapacities,
    targetHeaders,
    hourlyProductions,
    hourlyInspections,
  };
}

// ✅ CommonJS export
module.exports = { generateAllDummyData };
