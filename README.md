## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app.js`. The page auto-updates as you edit the file.

# Production & Quality Management System (RMG)

A full-stack **Production & Quality Management** web app for garments factories, built with **Next.js (App Router)** and **MongoDB/Mongoose**.  

It helps track **line-wise production**, **hourly targets vs achievements**, **efficiency**, **style-wise WIP**, and **quality defects** in real time.

---

## ⚙️ Tech Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS / DaisyUI
- **Backend:** Next.js API Routes (REST style)
- **Database:** MongoDB with Mongoose
- **Auth:** Custom hook (`useAuth` / `useProductionAuth`) with role & building based access
- **Deployment:** (Optional – Vercel / Node server – update this as you use)

---

## 🧵 Domain Overview (Garments Context)

The app is designed for **ready-made garments (RMG) factories**, with:

- Multiple **buildings** (e.g. `B-4`)
- Multiple **lines** per building (e.g. `Line-1` … `Line-15`)
- **Styles** with SMV, buyers, color, size, etc.
- **Supervisors / Production users** posting hourly output
- **Quality users** recording defects & inspection results

---

## ✨ Key Features

### 1. Target Setter (Header)
- Create **Target Headers** per:
  - Building  
  - Line  
  - Date  
  - Buyer / Style / Color  
  - Run day, SMV, manpower, plan efficiency, working hours
- Auto-calculate:
  - **Day Target**
  - **Base Target per Hour** based on:
    ```text
    Base Target / hr = (Manpower Present × 60 × Plan Efficiency% ÷ SMV)
    or
    Base Target / hr = Day Target ÷ Working Hour
    ```

### 2. Hourly Production Board
- Line-wise **daily working board**:
  - Filter by **building, line, date**
  - Show one card per **Target Header** (e.g. 2h + 6h segments for different styles)
- Per hour:
  - Input **achieved quantity (this hour)**
  - See **dynamic target this hour** (base + carried shortfall)
  - See:
    - Hourly efficiency %
    - Avg efficiency preview
    - Δ variation vs dynamic target
    - Net variation vs base target (to date)
- Posted records table:
  - Hour, dynamic target, achieved, Δ variance, net variance, efficiencies
  - **Summary row** with:
    - Total achieved
    - Final net variance vs base
    - Overall AVG efficiency %

### 3. Style Capacity & WIP Tracking
- **Style Capacity**:
  - Save/update capacity per building + line + buyer + style (+ date)
- **WIP Calculation**:
  - See total produced (all days for a style)
  - Live **WIP**:
    ```text
    WIP = Input Qty (from cutting/previous process) - Total Achieved Qty
    ```
  - WIP & Produced update **immediately** after:
    - Posting new hourly production
    - Updating capacity

### 4. Quality / Defect Management (optional module)
- Defect picker:
  - Searchable dropdown (e.g. "301 - OPEN SEAM", "302 - SKIP STITCH", ...)
  - Hour-wise and line-wise defect logging
- Future scope:
  - Defect summary per style/line/day
  - DHU% / PPM dashboards

### 5. Role & Access Control
- Users assigned to:
  - `assigned_building`
  - Role (e.g. `Supervisor`, `Quality`, `Admin`)
- Screens and data filtered using custom hooks:
  - `useAuth`
  - `useProductionAuth`
- Production users can only see/manage their assigned building/lines.

---

## 🧱 Project Structure

> This is a simplified structure. Adjust if your repo differs.

```bash
.
├── app
│   ├── api
│   │   ├── target-setter-header
│   │   │   └── route.js
│   │   ├── hourly-productions
│   │   │   └── route.js
│   │   ├── style-capacities
│   │   │   └── route.js
│   │   └── style-wip
│   │       └── route.js
│   │   # (optional) quality-related APIs
│   │   └── defects
│   │       └── route.js
│   ├── ProductionComponents
│   │   ├── LineDailyWorkingBoard.jsx
│   │   ├── ProductionInputForm.jsx
│   │   ├── SearchableDefectPicker.jsx
│   │   └── ...
│   ├── hooks
│   │   ├── useAuth.js
│   │   └── useProductionAuth.js
│   ├── page.js
│   └── ...
├── models
│   ├── TargetSetterHeader.js
│   ├── HourlyProduction.js
│   ├── StyleCapacity.js
│   ├── StyleWip.js
│   └── User.js
├── services
│   └── mongo.js
├── public
│   └── screenshots
│       ├── dashboard.png
│       └── hourly-board.png
├── package.json
└── README.md


