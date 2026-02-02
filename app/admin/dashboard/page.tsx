"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type OwnerRow = {
  owner_id: string | null;
  owner_name: string;
  deposit_usd: number;
  subscription_thb: number;
  new_count: number;
  renew_count: number;
  unique_customers: number;
};

type TrendRow = {
  month: string; // YYYY-MM
  deposit_usd: number;
  subscription_thb: number;
};

function ymNow() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function api(path: string) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function fmtInt(n: number) {
  return Number(n || 0).toLocaleString();
}
function fmtMoney(n: number) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function AdminDashboardPage() {
  const [month, setMonth] = useState<string>(ymNow());
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  async function loadAll(targetMonth = month) {
    setLoading(true);
    setErr("");
    try {
      const [o, t] = await Promise.all([
        api(`/api/dashboard/owners?month=${encodeURIComponent(targetMonth)}`),
        api(`/api/dashboard/trend?months=12`),
      ]);

      setOwners(Array.isArray(o) ? o : []);
      setTrend(Array.isArray(t) ? t : []);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || String(e));
      setOwners([]);
      setTrend([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  // KPI รวม (จากตารางแม่ทีมของเดือนที่เลือก)
  const kpi = useMemo(() => {
    let usd = 0,
      thb = 0,
      nNew = 0,
      nRenew = 0,
      uniq = 0;

    for (const r of owners) {
      usd += Number(r.deposit_usd || 0);
      thb += Number(r.subscription_thb || 0);
      nNew += Number(r.new_count || 0);
      nRenew += Number(r.renew_count || 0);
      uniq += Number(r.unique_customers || 0);
    }

    return { usd, thb, nNew, nRenew, uniq };
  }, [owners]);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            สรุปยอดจาก <span className="font-medium">billing_events.event_month</span>{" "}
            (เดือนที่ทำรายการสมัคร/ต่ออายุ)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
          >
            ← กลับหน้ารายชื่อลูกค้า
          </Link>

          <button
            onClick={() => loadAll(month)}
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
          >
            รีเฟรช
          </button>
        </div>
      </div>

      {/* Month selector */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div>
          <div className="text-xs text-slate-500">เลือกเดือน</div>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 w-48 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        {err ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-500">กำลังโหลด…</div>
        ) : (
          <div className="text-sm text-slate-500">
            จำนวนแม่ทีมในรายงาน: <span className="font-medium">{owners.length}</span>
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">ฝากรวม (USD)</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            ${fmtMoney(kpi.usd)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">รายเดือนรวม (THB)</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            ฿{fmtMoney(kpi.thb)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">สมัครใหม่ (NEW)</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {fmtInt(kpi.nNew)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">ต่ออายุ (RENEW)</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {fmtInt(kpi.nRenew)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">ลูกค้าไม่ซ้ำ (รวมทุกแม่ทีม)</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {fmtInt(kpi.uniq)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            *ตอนนี้รวมแบบบวกต่อแม่ทีม (ถ้าลูกค้าอยู่หลายแม่ทีมจะถูกนับซ้ำ)
          </div>
        </div>
      </div>

      {/* Owners table */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">สรุปตามแม่ทีม (เดือน {month})</div>
            <div className="text-xs text-slate-500">เรียงตาม ฝาก USD → รายเดือน THB</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">แม่ทีม</th>
                <th className="px-4 py-3 text-right font-medium">ฝาก (USD)</th>
                <th className="px-4 py-3 text-right font-medium">รายเดือน (THB)</th>
                <th className="px-4 py-3 text-right font-medium">NEW</th>
                <th className="px-4 py-3 text-right font-medium">RENEW</th>
                <th className="px-4 py-3 text-right font-medium">ลูกค้าไม่ซ้ำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {owners.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    {loading ? "กำลังโหลด…" : "ยังไม่มีข้อมูลในเดือนนี้"}
                  </td>
                </tr>
              ) : (
                owners.map((r, idx) => (
                  <tr key={`${r.owner_id || "NO_OWNER"}-${idx}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{r.owner_name || "-"}</div>
                      <div className="text-xs text-slate-400">{r.owner_id || "NO_OWNER"}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      ${fmtMoney(r.deposit_usd)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      ฿{fmtMoney(r.subscription_thb)}
                    </td>
                    <td className="px-4 py-3 text-right">{fmtInt(r.new_count)}</td>
                    <td className="px-4 py-3 text-right">{fmtInt(r.renew_count)}</td>
                    <td className="px-4 py-3 text-right">{fmtInt(r.unique_customers)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trend (table for now) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-900">Trend ย้อนหลัง 12 เดือน (รวมทั้งหมด)</div>
          <div className="text-xs text-slate-500">ดึงจาก /api/dashboard/trend</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">เดือน</th>
                <th className="px-4 py-3 text-right font-medium">ฝาก (USD)</th>
                <th className="px-4 py-3 text-right font-medium">รายเดือน (THB)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trend.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    {loading ? "กำลังโหลด…" : "ยังไม่มีข้อมูลเทรนด์"}
                  </td>
                </tr>
              ) : (
                trend.map((t) => (
                  <tr key={t.month} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{t.month}</td>
                    <td className="px-4 py-3 text-right">${fmtMoney(t.deposit_usd)}</td>
                    <td className="px-4 py-3 text-right">฿{fmtMoney(t.subscription_thb)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 p-4 text-xs text-slate-500">
          ถ้าต้องการ “กราฟจริง” ผมทำให้ได้โดยใช้ recharts (LineChart) พร้อม toggle เลือกแม่ทีม
        </div>
      </div>
    </div>
  );
}