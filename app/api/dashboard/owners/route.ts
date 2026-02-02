import { supabaseAdmin } from "@/lib/supabaseAdmin";

function monthToDate(month: string) {
  // '2026-02' -> '2026-02-01'
  const m = (month || "").trim();
  if (!/^\d{4}-\d{2}$/.test(m)) return null;
  return `${m}-01`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const month = searchParams.get("month") || "";
  const event_month = monthToDate(month);
  if (!event_month) return new Response("month must be YYYY-MM", { status: 400 });

  const ownerId = (searchParams.get("ownerId") || "").trim(); // optional: ดูแม่ทีมเดียว

  let q = supabaseAdmin
    .from("billing_events")
    .select(
      `
        owner_id,
        amount,
        currency,
        event_type,
        customer_id,
        owner:customer_owners ( id, name )
      `
    )
    .eq("event_month", event_month);

  if (ownerId) q = q.eq("owner_id", ownerId);

  const { data, error } = await q;
  if (error) return new Response(error.message, { status: 500 });

  const rows = (data || []) as any[];

  const map = new Map<string, any>();

  for (const r of rows) {
    const key = r.owner_id || "NO_OWNER";
    if (!map.has(key)) {
      map.set(key, {
        owner_id: r.owner_id,
        owner_name: r?.owner?.name || "-",
        deposit_usd: 0,
        subscription_thb: 0,
        new_count: 0,
        renew_count: 0,
        unique_customers: new Set<string>(),
      });
    }

    const a = map.get(key);

    const amt = Number(r.amount || 0);
    if (r.currency === "USD") a.deposit_usd += amt;
    if (r.currency === "THB") a.subscription_thb += amt;

    if (r.event_type === "NEW") a.new_count += 1;
    if (r.event_type === "RENEW") a.renew_count += 1;

    if (r.customer_id) a.unique_customers.add(r.customer_id);
  }

  const out = Array.from(map.values()).map((x) => ({
    owner_id: x.owner_id,
    owner_name: x.owner_name,
    deposit_usd: x.deposit_usd,
    subscription_thb: x.subscription_thb,
    new_count: x.new_count,
    renew_count: x.renew_count,
    unique_customers: x.unique_customers.size,
  }));

  // เรียงให้ดูง่าย: ฝาก USD ก่อน แล้วค่อย THB
  out.sort(
    (a, b) =>
      b.deposit_usd - a.deposit_usd ||
      b.subscription_thb - a.subscription_thb ||
      b.unique_customers - a.unique_customers
  );

  return Response.json(out);
}