// app/user-manual/page.jsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";
import { useAuth } from "@/app/hooks/useAuth";
import {
  ArrowLeft,
  BookOpen,
  MonitorCloud,
  BarChart2,
  Activity,
  ClipboardList,
  Table2,
  ImageIcon,
  Layers,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Phone,
  Mail,
} from "lucide-react";

function Pill({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-medium text-white/90">
      {children}
    </span>
  );
}

function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)] ${className}`}
    >
      {children}
    </div>
  );
}

function Section({ id, icon: Icon, title, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-3 flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-2xl border border-white/12 bg-white/10">
          <Icon size={18} />
        </div>
        <h2 className="text-[13px] font-semibold text-white/95">{title}</h2>
      </div>
      <Card>{children}</Card>
    </section>
  );
}

function TocLink({ href, children }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-between rounded-2xl border border-white/12 bg-white/5 px-3 py-2 text-[12px] text-white/85 hover:bg-white/10"
    >
      <span className="truncate">{children}</span>
      <span className="text-white/40">#</span>
    </Link>
  );
}

function Tip({ tone = "ok", title, children }) {
  const map = {
    ok: {
      wrap: "border-emerald-400/20 bg-emerald-500/10",
      icon: CheckCircle2,
      iconBg: "bg-emerald-500/15 border-emerald-400/20",
      iconColor: "text-emerald-200",
      title: "text-emerald-100",
      text: "text-emerald-100/75",
    },
    warn: {
      wrap: "border-amber-400/20 bg-amber-500/10",
      icon: AlertTriangle,
      iconBg: "bg-amber-500/15 border-amber-400/20",
      iconColor: "text-amber-200",
      title: "text-amber-100",
      text: "text-amber-100/75",
    },
    info: {
      wrap: "border-sky-400/20 bg-sky-500/10",
      icon: HelpCircle,
      iconBg: "bg-sky-500/15 border-sky-400/20",
      iconColor: "text-sky-200",
      title: "text-sky-100",
      text: "text-sky-100/75",
    },
  };
  const t = map[tone] || map.info;
  const Icon = t.icon;

  return (
    <div className={`mt-3 rounded-2xl border p-3 ${t.wrap}`}>
      <div className="flex items-start gap-2">
        <div
          className={`mt-0.5 grid h-8 w-8 place-items-center rounded-2xl border ${t.iconBg}`}
        >
          <Icon size={16} className={t.iconColor} />
        </div>
        <div className="min-w-0">
          <p className={`text-[12px] font-semibold ${t.title}`}>{title}</p>
          <div className={`mt-1 text-[12px] leading-relaxed ${t.text}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UserManualPage() {
  const { auth } = useAuth();

  const userName = useMemo(
    () => auth?.user?.user_name || auth?.user_name || "",
    [auth]
  );
  const factory = useMemo(
    () => auth?.factory || auth?.user?.factory || auth?.assigned_factory || "",
    [auth]
  );
  const building = useMemo(
    () => auth?.assigned_building || auth?.user?.assigned_building || "",
    [auth]
  );

  return (
    <main className="min-h-screen bg-[#070A12] text-white pl-14">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 left-[-10%] h-[520px] w-[520px] rounded-full bg-emerald-500/15 blur-[90px]" />
        <div className="absolute -top-28 right-[-12%] h-[560px] w-[560px] rounded-full bg-sky-500/15 blur-[90px]" />
        <div className="absolute bottom-[-22%] left-[20%] h-[520px] w-[520px] rounded-full bg-violet-500/12 blur-[90px]" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(255,255,255,0.08),transparent)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070A12]/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-3 py-2 text-[12px] font-semibold text-white/90 hover:bg-white/10"
            >
              <ArrowLeft size={16} />
              Home
            </Link>

            {/* Optional logo (you already have it in SideNavbar, but keep here if you want) */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="relative h-8 w-8 overflow-hidden rounded-xl border border-white/12 bg-white/10">
                {/* If you want, keep this:
                <Image src="/HKD_LOGO.png" alt="HKD" fill className="object-contain p-1" />
                */}
                <div className="grid h-full w-full place-items-center text-[10px] text-white/60">
                  HKD
                </div>
              </div>
              <div className="leading-tight">
                <p className="text-[12px] font-semibold text-white/95">
                  HKD Outdoor Innovations Ltd.
                </p>
                <p className="text-[11px] text-white/55">
                  User Manual • Quality & Production Management System
                </p>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            {!!factory && <Pill>Factory: {factory}</Pill>}
            {!!building && <Pill>Floor: {building}</Pill>}
            {!!userName && <Pill>User: {userName}</Pill>}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-7 md:py-10">
        {/* Hero */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  অফিস/ফ্লোর টিমের জন্য দ্রুত গাইড
                </div>
                <h1 className="mt-3 text-xl font-semibold leading-tight md:text-2xl">
                  ইউজার ম্যানুয়াল (Bangla)
                </h1>
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-white/70">
                  এই সিস্টেমে দৈনিক কাজ সাধারণত ৫ ধাপে হয়:{" "}
                  <span className="text-white/90 font-semibold">
                    Target/Plan সেট
                  </span>{" "}
                  →{" "}
                  <span className="text-white/90 font-semibold">
                    Production Hourly ইনপুট
                  </span>{" "}
                  →{" "}
                  <span className="text-white/90 font-semibold">
                    Quality Hourly ইনপুট
                  </span>{" "}
                  →{" "}
                  <span className="text-white/90 font-semibold">
                    Dashboard/TV ভিউ মনিটর
                  </span>{" "}
                  →{" "}
                  <span className="text-white/90 font-semibold">
                    Summary/Report
                  </span>
                  ।
                </p>
              </div>

              <div className="hidden md:block">
                <Link
                  href="/floor-dashboard"
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-[12px] font-semibold text-emerald-950 hover:bg-emerald-400"
                >
                  <MonitorCloud size={16} />
                  Dashboard
                </Link>
              </div>
            </div>

            <Tip tone="info" title="সবচেয়ে গুরুত্বপূর্ণ নিয়ম">
              Buyer / Style / Color(Model) নামগুলো সব জায়গায় একইভাবে লিখবেন।
              একই Hour + Line এ ডুপ্লিকেট এন্ট্রি না করে{" "}
              <span className="font-semibold">Edit</span> করবেন।
            </Tip>
          </Card>

          <Card>
            <p className="text-[12px] font-semibold text-white/90">সূচিপত্র</p>
            <div className="mt-3 grid gap-2">
              <TocLink href="#getting-started">১) শুরু করার নিয়ম</TocLink>
              <TocLink href="#daily-flow">২) দৈনিক কাজের ফ্লো</TocLink>
              <TocLink href="#floor-dashboard">৩) Floor Dashboard</TocLink>
              <TocLink href="#floor-summary">৪) Floor Summary</TocLink>
              <TocLink href="#production-input">৫) Production Input</TocLink>
              <TocLink href="#quality-input">৬) Quality Input</TocLink>
              <TocLink href="#quality-summary">৭) Quality Summary Table</TocLink>
              <TocLink href="#style-media">৮) Style Media Register</TocLink>
              <TocLink href="#troubleshoot">৯) সমস্যা হলে কী করবেন</TocLink>
              <TocLink href="#support">১০) সাপোর্ট</TocLink>
            </div>
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4">
          <Section id="getting-started" icon={BookOpen} title="১) শুরু করার নিয়ম">
            <div className="space-y-2 text-[13px] leading-relaxed text-white/75">
              <p>
                <span className="font-semibold text-white/90">Login</span>{" "}
                করার পর উপরের বার/পিলসে আপনার{" "}
                <span className="font-semibold text-white/90">Factory</span> এবং{" "}
                <span className="font-semibold text-white/90">Floor</span> ঠিক
                আছে কিনা দেখুন।
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  যদি Factory/Floor ফাঁকা থাকে →{" "}
                  <span className="font-semibold">Logout</span> করে আবার{" "}
                  <span className="font-semibold">Login</span> করুন।
                </li>
                <li>
                  Side Navbar থেকে প্রয়োজনীয় মডিউল ওপেন করুন (Dashboard, Input,
                  Summary ইত্যাদি)।
                </li>
              </ul>

              <Tip tone="warn" title="ডেটা কোথায় যাবে?">
                প্রতিটি এন্ট্রি সাধারণত{" "}
                <span className="font-semibold">Factory + Floor + Line + Date</span>{" "}
                অনুযায়ী সেভ হয়। ভুল Floor/Factory হলে রিপোর্ট ভুল দেখাতে পারে।
              </Tip>
            </div>
          </Section>

          <Section id="daily-flow" icon={Layers} title="২) দৈনিক কাজের ফ্লো (Recommended)">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[12px] font-semibold text-white/90">
                  সকাল/শিফট শুরু
                </p>
                <ol className="mt-2 list-decimal pl-5 text-[13px] text-white/75 space-y-1">
                  <li>Production Input এ গিয়ে Buyer/Style/Color দিয়ে Plan/Target সেট করুন</li>
                  <li>যদি ১ দিনে একাধিক Style চলে → আলাদা আলাদা Header বানান</li>
                </ol>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[12px] font-semibold text-white/90">
                  ঘণ্টাভিত্তিক কাজ
                </p>
                <ol className="mt-2 list-decimal pl-5 text-[13px] text-white/75 space-y-1">
                  <li>Production Input এ Hour অনুযায়ী Achieved Qty ইনপুট দিন</li>
                  <li>Quality Input এ Hour অনুযায়ী Inspected/Passed/Defects ইনপুট দিন</li>
                  <li>Floor Dashboard/TV Mode এ লাইভ মনিটর করুন</li>
                </ol>
              </div>
            </div>

            <Tip tone="ok" title="ডুপ্লিকেট এন্ট্রি এড়ান">
              একই Hour + Line এ নতুন করে এন্ট্রি না দিয়ে{" "}
              <span className="font-semibold">Edit</span> ব্যবহার করুন।
            </Tip>
          </Section>

          <Section id="floor-dashboard" icon={MonitorCloud} title="৩) Floor Dashboard (Live Monitor)">
            <div className="space-y-2 text-[13px] leading-relaxed text-white/75">
              <p>
                এখানে Factory / Floor / Date / Line সিলেক্ট করে লাইভ KPI দেখা যায়।
                Grid ভিউ বা TV ভিউ ব্যবহার করে বড় স্ক্রিনে মনিটর করা যায়।
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <span className="font-semibold text-white/90">Factory</span> এবং{" "}
                  <span className="font-semibold text-white/90">Building(Floor)</span>{" "}
                  ঠিক করুন
                </li>
                <li>
                  <span className="font-semibold text-white/90">Date</span> সিলেক্ট করুন
                </li>
                <li>
                  <span className="font-semibold text-white/90">Line</span> → ALL বা নির্দিষ্ট লাইন
                </li>
                <li>
                  <span className="font-semibold text-white/90">TV Mode</span> দিলে কার্ড অটো স্লাইড হবে
                </li>
              </ul>

              <Tip tone="info" title="Media/WIP না দেখালে">
                Style Media Register এ Buyer/Style/Color(Model) মিলিয়ে
                এন্ট্রি আছে কিনা এবং একই Date এর জন্য আছে কিনা চেক করুন।
              </Tip>
            </div>
          </Section>

          <Section id="floor-summary" icon={BarChart2} title="৪) Floor Summary (দিনের সারাংশ)">
            <div className="space-y-2 text-[13px] leading-relaxed text-white/75">
              <p>
                এই পেজে দিনভিত্তিক সামারি চার্ট দেখা যায় (লাইন অনুযায়ী তুলনা)।
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Factory/Building সিলেক্ট করুন</li>
                <li>Date দিন</li>
                <li>চার্ট/টেবিল রিফ্রেশ হলে নতুন ডেটা দেখা যাবে</li>
              </ul>
            </div>
          </Section>

          <Section id="production-input" icon={Activity} title="৫) Production Input (Target Header + Hourly Achieved)">
            <div className="space-y-2 text-[13px] leading-relaxed text-white/75">
              <p>
                Production Input সাধারণত ২ অংশে কাজ করে:
                <span className="font-semibold text-white/90"> (A) Header/Target সেট</span>{" "}
                এবং <span className="font-semibold text-white/90">(B) Hourly Achieved</span>।
              </p>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[12px] font-semibold text-white/90">
                  (A) Header/Target সেট করার ধাপ
                </p>
                <ol className="mt-2 list-decimal pl-5 space-y-1">
                  <li>Line এবং Date সিলেক্ট করুন</li>
                  <li>Buyer / Style / Color(Model) / Run Day দিন</li>
                  <li>Total Manpower, Present Manpower, Working Hour, SMV, Plan Efficiency দিন</li>
                  <li>Target Preview দেখে Save করুন</li>
                </ol>
                <Tip tone="warn" title="Style ভাগ করে কাজ হলে">
                  ১ দিনে একই লাইনে একাধিক Style চললে আলাদা Header বানান। পরে প্রতিটি Header কার্ডে Hour অনুযায়ী Achieved ইনপুট দিন।
                </Tip>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[12px] font-semibold text-white/90">
                  (B) Hourly Achieved (Production)
                </p>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>যে Header কার্ডে কাজ হচ্ছে সেটি সিলেক্ট করুন</li>
                  <li>Hour সিলেক্ট করে Achieved Qty লিখুন</li>
                  <li>Save/Update দিন</li>
                </ul>
              </div>

              <Tip tone="info" title="Edit / Delete কখন ব্যবহার করবেন?">
                ভুল Buyer/Style/SMV/Manpower/Working Hour হলে Header এ{" "}
                <span className="font-semibold">Edit</span> করুন। ভুল বা টেস্ট ডেটা হলে{" "}
                <span className="font-semibold">Delete</span> করুন।
              </Tip>
            </div>
          </Section>

          <Section id="quality-input" icon={ClipboardList} title="৬) Quality Input (Endline Hourly Entry)">
            <div className="space-y-2 text-[13px] leading-relaxed text-white/75">
              <p>
                এখানে প্রতি ঘণ্টায় Endline Quality ইনপুট হয়।
                Line + Hour সিলেক্ট করে Defect যোগ করে Qty লিখবেন, তারপর Inspected/Passed ইত্যাদি ইনপুট দিয়ে Save করবেন।
              </p>

              <ul className="list-disc pl-5 space-y-1">
                <li>Line সিলেক্ট করুন</li>
                <li>Working Hour সিলেক্ট করুন</li>
                <li>Defect সার্চ করে যোগ করুন, Qty দিন</li>
                <li>Inspected Qty, Passed Qty, Defective Pcs, After Repair ইনপুট দিন</li>
                <li>Save (বা Edit করলে Update)</li>
              </ul>

              <Tip tone="warn" title="Duplicate Entry">
                একই Hour + Line (এবং একই Building) এ নতুন এন্ট্রি করলে ডুপ্লিকেট দেখাতে পারে।
                তখন পুরনো এন্ট্রি{" "}
                <span className="font-semibold">Edit</span> করে Update করুন।
              </Tip>
            </div>
          </Section>

          <Section id="quality-summary" icon={Table2} title="৭) Quality Summary Table (Hourly Quality Summary)">
            <div className="space-y-2 text-[13px] leading-relaxed text-white/75">
              <p>
                এই টেবিলে Hour কলাম অনুযায়ী Defect সারাংশ/টোটাল দেখা যায়। Date এবং Line সিলেক্ট করে রিপোর্ট দেখুন।
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Date সিলেক্ট করুন</li>
                <li>Line (ALL বা নির্দিষ্ট) সিলেক্ট করুন</li>
                <li>টেবিল অটো রিফ্রেশ হলে সর্বশেষ ডেটা আপডেট হবে</li>
              </ul>
            </div>
          </Section>

          <Section id="style-media" icon={ImageIcon} title="৮) Style Media Register (Image/Video Reference)">
            <div className="space-y-2 text-[13px] leading-relaxed text-white/75">
              <p>
                Buyer/Style/Color(Model) অনুযায়ী Image/Video লিংক রাখার জন্য এই মডিউল।
                Dashboard/TV ভিউতে রেফারেন্স দেখাতে কাজে লাগে।
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Buyer, Style, Color(Model) ঠিকভাবে লিখুন</li>
                <li>Effective From (Date) দিন</li>
                <li>Image Link / Video Link যোগ করুন</li>
                <li>Save করুন; ভুল হলে Edit/Update করুন</li>
              </ul>

              <Tip tone="ok" title="Best practice">
                একই Buyer/Style/Color(Model) বারবার নতুন করে না বানিয়ে আগে সার্চ করে দেখুন—আগে থাকলে Update করুন।
              </Tip>
            </div>
          </Section>

          <Section id="troubleshoot" icon={AlertTriangle} title="৯) সমস্যা হলে কী করবেন (Troubleshooting)">
            <div className="space-y-3 text-[13px] leading-relaxed text-white/75">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[12px] font-semibold text-white/90">
                  (A) ডেটা লোড হচ্ছে না
                </p>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>ইন্টারনেট/সার্ভার কানেকশন চেক করুন</li>
                  <li>Factory/Floor ঠিক আছে কিনা দেখুন</li>
                  <li>Refresh বাটন দিন বা পেজ রিলোড করুন</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[12px] font-semibold text-white/90">
                  (B) Duplicate warning
                </p>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>একই Hour + Line এ নতুন এন্ট্রি করবেন না</li>
                  <li>Existing row থেকে Edit → Update দিন</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[12px] font-semibold text-white/90">
                  (C) Media/WIP দেখাচ্ছে না
                </p>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>Style Media Register এ Buyer/Style/Color(Model) একদম একই কিনা</li>
                  <li>তারিখ (Effective/Selected Date) মিল আছে কিনা</li>
                  <li>Floor Dashboard এ Factory/Building/Date ঠিক আছে কিনা</li>
                </ul>
              </div>
            </div>
          </Section>

          <Section id="support" icon={HelpCircle} title="১০) সাপোর্ট / যোগাযোগ">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[12px] font-semibold text-white/90">
                  ERP / IT Support
                </p>
                <p className="mt-1 text-[12px] text-white/65">
                  এখানে পরে আপনার অফিসিয়াল কন্টাক্ট বসিয়ে দিন।
                </p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-[12px] text-white/75">
                    <Phone size={16} className="text-white/60" />
                    <span>Phone: __________________</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-white/75">
                    <Mail size={16} className="text-white/60" />
                    <span>Email: __________________</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[12px] font-semibold text-white/90">
                  দ্রুত রিমাইন্ডার
                </p>
                <ul className="mt-2 list-disc pl-5 text-[12px] text-white/75 space-y-1">
                  <li>নাম লেখায় কনসিস্টেন্সি রাখুন (Buyer/Style/Color)</li>
                  <li>ভুল হলে Edit করুন, নতুন করে ডুপ্লিকেট নয়</li>
                  <li>শিফট শেষে Summary দেখে নিন</li>
                </ul>
              </div>
            </div>
          </Section>
        </div>

        <footer className="mt-8 border-t border-white/10 pt-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-[11px] text-white/55">
              © {new Date().getFullYear()} HKD Outdoor Innovations Ltd.
            </p>
            <p className="text-[11px] text-white/55">
              Built for factory floor visibility • Quality • Production
            </p>
          </div>
        </footer>
      </section>
    </main>
  );
}
