// lib/generateDummyData.js

// ---------- helper utils ----------

function makeObjectId() {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 24; i++) {
    out += hex[Math.floor(Math.random() * hex.length)];
  }
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

function formatDateFromOffset(base, offsetDays) {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() - offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 🔹 correct hour label to match HOUR_COLUMNS
function makeHourLabel(hourIndex) {
  if (hourIndex === 1) return "1st Hour";
  if (hourIndex === 2) return "2nd Hour";
  if (hourIndex === 3) return "3rd Hour";
  return `${hourIndex}th Hour`; // 4th, 5th, 6th...
}

// 🔹 factories, buildings, lines
const FACTORIES = ["K-1", "K-2", "K-3"];

const BUILDINGS = [
  "A-2",
  "B-2",
  "A-3",
  "B-3",
  "A-4",
  "B-4",
  "A-5",
  "B-5",
];

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
  "Line-13",
  "Line-14",
  "Line-15",
];

const BUYERS = [
  "Decathlon - knit",
  "Decathlon - woven",
  "Walmart",
  "Columbia",
  "ZXY",
];

const ITEMS = ["T-Shirt", "Polo", "Jacket", "Shorts", "Trouser"];
const COLORS = ["Blue", "Black", "Navy", "Grey", "Red", "Green"];

const DEFECTS = ["301 - OPEN SEAM",
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
  "366 - COATING PROBLEM"];

// 🔹 Single demo context
const DEMO_FACTORY = "K-2";
const DEMO_BUILDING = "A-2";

// ---------- single user (K-2, A-2) ----------

function buildSingleUser() {
  const _id = makeObjectId();
  const user_name = "ratul";

  const userDoc = {
    _id,
    user_name,
    password: "123", // just a placeholder, not for real login
    role: "Developer",
    assigned_building: DEMO_BUILDING,
    factory: DEMO_FACTORY,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const userInfo = {
    id: _id,
    user_name,
    role: "Developer",
  };

  return { users: [userDoc], userInfo };
}

// ---------- main generator ----------

export function generateAllDummyData(options = {}) {
  const { days = 30, hoursPerDay = 12 } = options;

  // clamp hours to [1, 12] so it matches your table columns
  const safeHoursPerDay = Math.min(Math.max(hoursPerDay, 1), 12);

  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);

  const { users, userInfo } = buildSingleUser();

  const lineInfos = [];
  const styleCapacities = [];
  const targetHeaders = [];
  const hourlyProductions = [];
  const hourlyInspections = [];

  // single factory & building for all generated data
  const factory = DEMO_FACTORY;
  const building = DEMO_BUILDING;

  // capacity cache to satisfy unique index
  const capacityByKey = {};

  // 1) Line info + style capacity (one per line+buyer+style)
  const todayStr = formatDateFromOffset(baseDate, 0);

  for (const line of LINES) {
    const buyer = pick(BUYERS);
    const styleNumber = randomInt(320000, 399999);
    const style = String(styleNumber);
    const item = pick(ITEMS);
    const color = pick(COLORS);
    const smvNum = randomFloat(8, 18, 2);
    const runDayStr = "1";

    // 👉 LineInfoRegister doc
    lineInfos.push({
      factory,
      buyer,
      assigned_building: building,
      line,
      style,
      item,
      color,
      smv: smvNum.toFixed(2), // model uses String
      runDay: runDayStr,
      date: todayStr,
      imageSrc:
        "https://res.cloudinary.com/df8fxkmdo/image/upload/v1763527164/media-links/images/e6curndblk1tthld41ay.jpg",
      videoSrc:
        "https://res.cloudinary.com/df8fxkmdo/video/upload/v1763527167/media-links/videos/dacta6s8bgf6fb1bq2sw.mp4",
      user: {
        id: userInfo.id,
        user_name: userInfo.user_name,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 👉 StyleCapacity (unique per line+buyer+style)
    const capKey = `${line}_${buyer}_${style}`;
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
        user: {
          id: userInfo.id,
          user_name: userInfo.user_name,
          role: userInfo.role,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // helper to find line info
  function findLineInfo(line) {
    return lineInfos.find(
      (doc) =>
        doc.factory === factory &&
        doc.assigned_building === building &&
        doc.line === line
    );
  }

  // 2) TargetSetterHeader + HourlyProduction
  for (const line of LINES) {
    const lineInfo = findLineInfo(line);
    if (!lineInfo) continue;

    const { buyer, style, color, smv: smvStr } = lineInfo;
    const smvNum = parseFloat(smvStr) || 12.5;

    const capKey = `${line}_${buyer}_${style}`;
    const capacity =
      typeof capacityByKey[capKey] === "number"
        ? capacityByKey[capKey]
        : randomInt(800, 1600);

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

      // target = (MP_P * WH * 60 / SMV) * (Eff% / 100)
      const targetFullRaw =
        (manpower_present * working_hour * 60 * plan_efficiency_percent) /
        (smvNum * 100);
      const target_full_day = Math.round(targetFullRaw);

      const headerId = makeObjectId();

      // 👉 TargetSetterHeader doc (one per line+date)
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
        user: {
          id: userInfo.id,
          user_name: userInfo.user_name,
          role: userInfo.role,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 👉 HourlyProduction rows linked with headerId
      let cumulativeVariance = 0;
      const baseTargetPerHour = Math.round(target_full_day / working_hour);

      for (let hour = 1; hour <= working_hour; hour++) {
        const factor = 0.8 + Math.random() * 0.4; // 80–120%
        const achievedQty = Math.max(
          0,
          Math.round(baseTargetPerHour * factor)
        );

        const dynamicTarget = baseTargetPerHour;
        const varianceQty = achievedQty - dynamicTarget;
        cumulativeVariance += varianceQty;

        const hourlyEfficiency = parseFloat(
          (
            (achievedQty * smvNum * 100) /
            (manpower_present * 60)
          ).toFixed(1)
        );
        const achieveEfficiency = parseFloat(
          (
            (dynamicTarget * smvNum * 100) /
            (manpower_present * 60)
          ).toFixed(1)
        );

        const totalEfficiency = hourlyEfficiency;

        hourlyProductions.push({
          headerId,
          productionDate: dateStr,
          hour,
          achievedQty,
          baseTargetPerHour,
          dynamicTarget,
          varianceQty,
          cumulativeVariance,
          hourlyEfficiency,
          achieveEfficiency,
          totalEfficiency,
          factory,
          assigned_building: building,
          line,
          buyer,
          style,
          productionUser: {
            id: userInfo.id,
            Production_user_name: userInfo.user_name,
            phone: "",
            bio: "",
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  // 3) HourlyInspection dummy data (endline hourly entries)
  for (const line of LINES) {
    for (let d = 0; d < days; d++) {
      // mimic schema default = local midnight
      const dateObj = new Date(baseDate.getTime());
      dateObj.setDate(dateObj.getDate() - d);
      const reportDate = new Date(dateObj.toDateString()); // local 00:00

      for (let hourIndex = 1; hourIndex <= safeHoursPerDay; hourIndex++) {
        const inspectedQty = randomInt(80, 200);
        const defectivePcs = randomInt(0, 15);
        const passedQty = inspectedQty - defectivePcs;
        const afterRepair = randomInt(0, defectivePcs);

        const selectedDefects = DEFECTS.filter(
          () => Math.random() < 0.5
        ).map((name) => ({
          name,
          quantity: randomInt(1, 5),
        }));

        const totalDefects = selectedDefects.reduce(
          (sum, d) => sum + d.quantity,
          0
        );

        hourlyInspections.push({
          user: {
            id: userInfo.id,
            user_name: userInfo.user_name,
          },
          factory,
          building, // HourlyInspectionModel uses `building`
          reportDate,
          hourLabel: makeHourLabel(hourIndex), // ✅ matches HOUR_COLUMNS
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

  return {
    users,
    lineInfos,
    styleCapacities,
    targetHeaders,
    hourlyProductions,
    hourlyInspections,
  };
}
