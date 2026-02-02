import { supabaseAdmin } from "@/lib/supabaseAdmin";

function firstDayOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function yyyymm(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const months = Math.max(1, Math.min(24, Number(searchParams.get("months") || 12)));
  const ownerId = (searchParams.get("ownerId") || "").trim();

  const end = firstDayOfMonth(new Date()); // เดือนปัจจุบัน (YYYY-MM-01)
  const start = addMonths(end, -(months - 1));

  let q = supabaseAdmin
    .from("billing_events")
    .select("event_month,amount,currency,owner_id")
    .gte("event_month", isoDate(start))
    .lte("event_month", isoDate(end));

  if (ownerId) q = q.eq("owner_id", ownerId);

  const { data, error } = await q;
  if (error) return new Response(error.message, { status: 500 });

  // เตรียม bucket เดือนย้อนหลังให้ครบ (แม้ไม่มี event)
  const bucket = new Map<string, any>();
  for (let i = 0; i < months; i++) {
    const m = addMonths(start, i);
    bucket.set(yyyymm(m), { month: yyyymm(m), deposit_usd: 0, subscription_thb: 0 });
  }

  for (const r of (data || []) as any[]) {
    const key = String(r.event_month).slice(0, 7);
    const b = bucket.get(key);
    if (!b) continue;

    const amt = Number(r.amount || 0);
    if (r.currency === "USD") b.deposit_usd += amt;
    if (r.currency === "THB") b.subscription_thb += amt;
  }

  return Response.json(Array.from(bucket.values()));
}