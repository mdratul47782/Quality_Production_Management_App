// app/production-target-setter/page.jsx

import ProductionInputForm from "../ProductionComponents/ProductionInputForm";

export default function ProductionTargetSetterPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-3 md:px-6 py-4">
      <div className="max-w-2xl mx-2 space-y-4">
        <header className="space-y-1">
          <h1 className="text-lg md:text-2xl font-semibold text-slate-900">
            Production Target Setter
          </h1>
          <p className="text-xs md:text-sm text-slate-600">
            Set daily production targets by line, style, and buyer for your assigned building.
          </p>
        </header>

        <ProductionInputForm />
      </div>
    </main>
  );
}
