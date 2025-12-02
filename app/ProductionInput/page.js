// app/production-target-setter/page.jsx

import HourlyProductionBoard from "../ProductionComponents/LineDailyWorkingBoard";
import ProductionInputForm from "../ProductionComponents/ProductionInputForm";

export default function ProductionTargetSetterPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-2 md:px-2 py-2">
      <div className="max-w-8xl mx-4 space-y-2">
        {/* Header */}
        <header className="space-y-1">
          <h1 className="text-md md:text-2xl font-semibold text-slate-900">
            Production Home Page
          </h1>
          <p className="text-xs md:text-sm text-slate-600">
            Set daily production targets by line, style, and buyer for your assigned
            building, and record hourly production against those targets.
          </p>
        </header>

        {/* 2-column layout (actually 1 + 2 columns on lg) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* Left: target header input form */}
          <div className="w-full lg:col-span-1">
            <ProductionInputForm />
          </div>

          {/* Right: hourly production board (takes 2/3 width) */}
          <div className="w-full lg:col-span-2">
            <HourlyProductionBoard />
          </div>
        </div>
      </div>
    </main>
  );
}


// 1) শুধু Target Header (টার্গেট সেটিংস), কোনো hourly data না
console.log(
  "3️⃣ এই API থেকে আমরা শুধুমাত্র Target Header (buyer, style, manpower, working_hour, plan_eff ইত্যাদি) পাচ্ছি Building=B-4, Line=Line-1, Date=2025-12-02 এর জন্য → /api/target-setter-header?assigned_building=B-4&line=Line-1&date=2025-12-02"
);

// 2) নির্দিষ্ট header + production user এর সব hourly রেকর্ড
console.log(
  "1️⃣ এই API থেকে আমরা একটা নির্দিষ্ট header (692e75215fd964322a63f99f) এবং নির্দিষ্ট production user (692a7723bd777a6e51bc0974) এর সব hourly production data পাচ্ছি → /api/hourly-productions?headerId=692e75215fd964322a63f99f&productionUserId=692a7723bd777a6e51bc0974"
);

// 3) Building + Line + Date + User ভিত্তিক সব header এর hourly রেকর্ড
console.log(
  "2️⃣ এই API থেকে আমরা Building=B-4, Line=Line-2, Date=2025-12-02, এবং productionUserId=692a7723bd777a6e51bc0974 এর জন্য যত header আছে, সবগুলোর hourly production data একসাথে পাচ্ছি → /api/hourly-productions?assigned_building=B-4&line=Line-2&date=2025-12-02&productionUserId=692a7723bd777a6e51bc0974"
);

