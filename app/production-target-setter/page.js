// app/production-target-setter/page.jsx

import HourlyProductionBoard from "../ProductionComponents/LineDailyWorkingBoard";
import ProductionInputForm from "../ProductionComponents/ProductionInputForm";

export default function ProductionTargetSetterPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-3 md:px-2 py-2">
      <div className="max-w-8xl mx-4 space-y-2">
        {/* Header */}
        <header className="space-y-1">
          <h1 className="text-lg md:text-2xl font-semibold text-slate-900">
            Production Target Setter
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
