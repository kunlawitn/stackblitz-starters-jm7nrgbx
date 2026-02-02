import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { sendTelegram } from "../../../../../lib/telegram";
import { getPlanValue, monthStartISO } from "../../../../../lib/planValue";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { id } = params;

  const months = Number(body.months ?? 1);
  if (!id) return new Response("id is required", { status: 400 });
  if (!Number.isFinite(months) || months <= 0)
    return new Response("months must be a positive number", { status: 400 });

  // 1) ดึงข้อมูลลูกค้าเดิม
  const { data: customer, error: e1 } = await supabaseAdmin
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (e1 || !customer)
    return new Response(e1?.message || "Not found", { status: 404 });

  // 2) คำนวณวันหมดอายุใหม่
  const oldExpiry = new Date(customer.expiry_date);
  const base = Number.isNaN(oldExpiry.getTime()) ? new Date() : oldExpiry;

  // กันเคส expiry เป็นอดีตมาก ๆ: ต่อจากวันนี้แทน
  const now = new Date();
  if (base.getTime() < now.getTime()) {
    base.setTime(now.getTime());
  }

  base.setMonth(base.getMonth() + months);
  const newExpiry = base.toISOString().slice(0, 10);

  // 3) อัปเดต customer และ "ดึง record ใหม่กลับมา" เพื่อใช้ต่อ
  const { data: updatedCustomer, error: e2 } = await supabaseAdmin
    .from("customers")
    .update({ expiry_date: newExpiry, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (e2 || !updatedCustomer)
    return new Response(e2?.message || "Update failed", { status: 500 });

  // 3.1) log ต่ออายุเดิม (คงไว้)
  const { error: eLog } = await supabaseAdmin.from("renewal_log").insert({
    customer_id: id,
    months,
    old_expiry_date: customer.expiry_date,
    new_expiry_date: newExpiry,
    created_at: new Date().toISOString(),
  });

  if (eLog) return new Response(eLog.message, { status: 500 });

  // ✅ 3.2) Billing event (เอาไปทำ Dashboard แม่ทีมรายเดือน)
  const pv = getPlanValue(updatedCustomer.plan_type);

  // TRY_7 / TRY_14 จะ countable=false → ไม่ insert event
  if (pv.countable) {
    const { error: eBill } = await supabaseAdmin.from("billing_events").insert({
      customer_id: updatedCustomer.id,
      owner_id: updatedCustomer.owner_id ?? null,
      event_type: "RENEW",
      plan_type: updatedCustomer.plan_type,
      amount: pv.amount,
      currency: pv.currency,
      event_at: new Date().toISOString(),
      event_month: monthStartISO(new Date()),
    });

    if (eBill) return new Response(eBill.message, { status: 500 });
  }

  // 4) Telegram (กันพังด้วย try/catch)
  try {
    await sendTelegram(
      `✅ ต่ออายุสำเร็จ\n` +
        `ชื่อ: ${updatedCustomer.name}\n` +
        `เดือน: +${months}\n` +
        `หมดอายุใหม่: ${newExpiry}\n` +
        `แม่ทีม: ${updatedCustomer.owner_id ? "(มีการผูกแม่ทีม)" : "-"}\n` +
        `Broker: ${updatedCustomer.broker_name || "-"}\n` +
        `User ID: ${updatedCustomer.account_no || "-"}\n` +
        `TV: ${updatedCustomer.tradingview_user || "-"}`
    );
  } catch (e: any) {
    console.error("Telegram failed:", e?.message || e);
  }

  return Response.json({
    ok: true,
    new_expiry_date: newExpiry,
    customer: updatedCustomer,
  });
}