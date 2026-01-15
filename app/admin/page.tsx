"use client";

import { useEffect, useMemo, useState } from "react";

type StatusType = "ACTIVE" | "EXPIRING" | "EXPIRED";

interface Customer {
  id: string;
  name: string;
  phone?: string;          // ✅ เพิ่ม
  line_id?: string;
  account_no: string;
  tradingview_user?: string;
  broker_name?: string;    // ✅ เพิ่ม
  plan_type: string;
  expiry_date: string;
  status: StatusType;
  note?: string;
}
type CustomerForm = {
  name: string;
  phone: string;
  line_id: string;
  account_no: string;
  tradingview_user: string;
  broker_name: string;
  plan_type: string;
  expiry_date: string;
  note: string;
};


// Indy CRM MVP – Admin-only dashboard (front-end scaffold)
// - Customer CRUD (add/edit/extend)
// - Search + filters
// - Status chips + KPI cards
// - Hooks for Telegram alerts (handled by backend)
//
// HOW TO USE (quick)
// 1) Replace API_BASE with your backend URL (e.g., https://your-api.vercel.app)
// 2) Implement the endpoints listed below in your backend
// 3) Put your admin behind login (Supabase Auth / Firebase Auth / simple password)
//
// Expected API endpoints (JSON):
// GET    /api/customers?query=&status=
// POST   /api/customers
// PATCH  /api/customers/:id
// POST   /api/customers/:id/extend   { months: 1 }
// GET    /api/stats
//
// Notes:
// - Telegram alerts should be sent by backend on POST /customers and on monthly cron.

const API_BASE = ""; // <-- set this

const StatusPill = ({ status }: { status: StatusType }) => {
  const map = {
    ACTIVE: "bg-green-100 text-green-700 border-green-200",
    EXPIRING: "bg-amber-100 text-amber-700 border-amber-200",
    EXPIRED: "bg-red-100 text-red-700 border-red-200",
  };
  const cls = map[status] || "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs border rounded-full ${cls}`}>
      {status}
    </span>
  );
};

const kpiCard = (title: string, value: number, sub?: string) => (
  <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4">
    <div className="text-sm text-slate-500">{title}</div>
    <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
  </div>
);

function formatDate(d: string | null): string {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString();
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // basic safeguard for month overflow
  if (d.getDate() !== day) d.setDate(0);
  return d.toISOString();
}

const emptyForm: CustomerForm = {
  name: "",
  phone: "",
  line_id: "",
  account_no: "",
  tradingview_user: "",
  broker_name: "Eterwealth",
  plan_type: "MONTHLY_1000",
  expiry_date: addMonths(new Date().toISOString(), 1),
  note: "",
};




export default function IndyCrmAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState({ active: 0, expiring: 0, expired: 0, total: 0 });

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");

  const [openModal, setOpenModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers
      .filter((c) => (status === "ALL" ? true : c.status === status))
      .filter((c) => {
        if (!q) return true;
        return (
          (c.name || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q) ||
          (c.line_id || "").toLowerCase().includes(q) ||
          (c.account_no || "").toLowerCase().includes(q)
        );
      });
  }, [customers, query, status]);

  async function api(path, opts = {}) {
    const url = API_BASE ? `${API_BASE}${path}` : path;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      ...opts,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `Request failed: ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [cust, st] = await Promise.all([
        api(`/api/customers?query=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}`),
        api(`/api/stats`),
      ]);
  
      const list: Customer[] = cust || [];
      setCustomers(list);
  
      // คำนวณ KPI จาก list เป็น fallback
      const total = list.length;
      const active = list.filter((x) => x.status === "ACTIVE").length;
      const expiring = list.filter((x) => x.status === "EXPIRING").length;
      const expired = list.filter((x) => x.status === "EXPIRED").length;
  
      // ใช้ stats จาก API เฉพาะเมื่อ "น่าเชื่อถือ" (ตรงกับ listsu list)
      // ถ้า /api/stats ยังไม่พร้อมหรือคืน 0 ตลอด จะไม่ให้มาทับค่าจาก list
      if (st && typeof st.total === "number" && (list.length === 0 || st.total === list.length)) {
        setStats(st);
      } else {
        setStats({ total, active, expiring, expired });
      }

    } catch (e) {
      console.error(e);
      setCustomers([]);
      setStats({ total: 0, active: 0, expiring: 0, expired: 0 });
    } finally {
      setLoading(false);
    }
  }
  
  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openAdd() {
    setEditId(null);
    setForm({ ...emptyForm });
    setOpenModal(true);
  }
  

  function openEdit(c) {
    setEditId(c.id);
    setForm({
      name: c.name || "",
      phone: c.phone || "",
      line_id: c.line_id || "",
      account_no: c.account_no || "",
      tradingview_user: c.tradingview_user || "",
      broker_name: c.broker_name || "Eterwealth",
      plan_type: c.plan_type || "MONTHLY_1000",
      expiry_date: c.expiry_date || addMonths(new Date().toISOString(), 1),
      note: c.note || "",
    });
    setOpenModal(true);
  }
  

  async function save() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        broker_name: (form.broker_name || "Eterwealth").trim() || "Eterwealth",
      };
  
      if (!payload.account_no) throw new Error("account_no is required");
      if (!payload.name) throw new Error("name is required");
  
      if (editId) {
        await api(`/api/customers/${editId}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api(`/api/customers`, { method: "POST", body: JSON.stringify(payload) });
      }
  
      setOpenModal(false);
      await loadAll();
    } catch (e: any) {
      alert(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }
  

  async function extend(c, months = 1) {
    if (!confirm(`Extend ${c.name} for ${months} month(s)?`)) return;
    try {
      // backend should update expiry_date + write renewal_log + send Telegram alert
      await api(`/api/customers/${c.id}/extend`, { method: "POST", body: JSON.stringify({ months }) });
      await loadAll();
    } catch (e) {
      alert(e.message || "Extend failed");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Indy CRM – Admin</h1>
            <p className="text-sm text-slate-500 mt-1">ลูกค้าอินดี้ / ต่ออายุ / แจ้งเตือน Telegram (ทำโดยระบบหลังบ้าน)</p>
          </div>
          <button
            onClick={openAdd}
            className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-slate-800"
          >
            + เพิ่มลูกค้า
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
          {kpiCard("ลูกค้าทั้งหมด", stats.total ?? customers.length)}
          {kpiCard("Active", stats.active)}
          {kpiCard("ใกล้หมดอายุ", stats.expiring, "แนะนำ: เหลือ ≤ 15 วัน")}
          {kpiCard("หมดอายุ", stats.expired)}
        </div>

        <div className="mt-6 rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex gap-3 flex-1">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหา: ชื่อ / โทร / LINE / account"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="ALL">ทุกสถานะ</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="EXPIRING">EXPIRING</option>
                <option value="EXPIRED">EXPIRED</option>
              </select>
            </div>
            <button
              onClick={loadAll}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
            >
              รีเฟรช
            </button>
          </div>

          <div className="mt-4 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-3">ลูกค้า</th>
                  <th className="py-2 pr-3">Account</th>
                  <th className="py-2 pr-3">แผน</th>
                  <th className="py-2 pr-3">หมดอายุ</th>
                  <th className="py-2 pr-3">สถานะ</th>
                  <th className="py-2">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      ไม่พบข้อมูล
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-3">
                        <div className="font-medium text-slate-900">{c.name}</div>
                        <div className="text-xs text-slate-500">โทร: {c.phone || "-"} | LINE: {c.line_id || "-"} | TV: {c.tradingview_user || "-"}</div>
                      </td>
                      <td className="py-3 pr-3 font-mono">{c.account_no}</td>
                      <td className="py-3 pr-3">
                        <span className="text-xs rounded-lg border border-slate-200 px-2 py-1">
                          {c.plan_type === "DEPOSIT_1000" ? "ฝาก $1,000" : "รายเดือน 1,000"}
                        </span>
                      </td>
                      <td className="py-3 pr-3">{formatDate(c.expiry_date)}</td>
                      <td className="py-3 pr-3">
                        <StatusPill status={c.status} />
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openEdit(c)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50"
                          >
                            แก้ไข
                          </button>
                          <button
                            onClick={() => extend(c, 1)}
                            className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs hover:bg-slate-800"
                          >
                            ต่ออายุ +1 เดือน
                          </button>
                          <button
                            onClick={() => extend(c, 2)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50"
                          >
                            +2 เดือน
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {openModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl border border-slate-200">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="font-semibold">{editId ? "แก้ไขลูกค้า" : "เพิ่มลูกค้าใหม่"}</div>
                <button onClick={() => setOpenModal(false)} className="text-slate-500 hover:text-slate-900">
                  ✕
                </button>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600">ชื่อ</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600">โทร</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600">ชื่อใน Line/Facebook</label>
                  <input
                    value={form.line_id}
                    onChange={(e) => setForm({ ...form, line_id: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600">User ID(โบรก)</label>
                  <input
                    value={form.account_no}
                    onChange={(e) => setForm({ ...form, account_no: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600">TradingView User</label>
                    <input
                      value={form.tradingview_user}
                      onChange={(e) => setForm({ ...form, tradingview_user: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="เช่น coachkung99"
                    />
                </div>

                <div>
                  <label className="text-xs text-slate-600">ชื่อโบรกเกอร์</label>
                  <input
                    value={form.broker_name}
                    onChange={(e) => setForm({ ...form, broker_name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Eterwealth"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600">แพ็กเกจ</label>
                  <select
                    value={form.plan_type}
                    onChange={(e) => setForm({ ...form, plan_type: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="MONTHLY_1000">รายเดือน 1,000 บาท</option>
                    <option value="DEPOSIT_1000">ฝาก $1,000</option>
                    <option value="TRY_7">ทดลองใช้ 7 วัน</option>
                    <option value="TRY_14">ทดลองใช้ 14 วัน</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-600">วันหมดอายุ</label>
                  <input
                    type="date"
                    value={new Date(form.expiry_date).toISOString().slice(0, 10)}
                    onChange={(e) => {
                      const iso = new Date(e.target.value + "T00:00:00Z").toISOString();
                      setForm({ ...form, expiry_date: iso });
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-slate-600">หมายเหตุ</label>
                  <textarea
                    rows={3}
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="p-4 border-t flex items-center justify-end gap-2">
                <button
                  onClick={() => setOpenModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  disabled={saving}
                  onClick={save}
                  className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 text-xs text-slate-500">
          <div className="font-medium text-slate-600">เช็คลิสต์ระบบหลังบ้าน (MVP)</div>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>POST /api/customers → บันทึก DB + ส่ง Telegram “สมัครใหม่”</li>
            <li>POST /api/customers/:id/extend → เพิ่ม expiry + log + ส่ง Telegram “ต่ออายุ”</li>
            <li>Cron รายเดือน → ส่งรายการหมดอายุ/ใกล้หมดอายุเข้า Telegram</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
