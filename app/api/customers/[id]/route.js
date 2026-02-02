import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

function toDateOnly(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, 10);
}

function clean(v) {
  if (v === undefined) return undefined; // ไม่ส่งมา = ไม่แตะ
  if (v === null) return null;
  return String(v).trim();
}

export async function PATCH(req, { params }) {
  const body = await req.json();
  const { id } = params;

  if (!id) return new Response("id is required", { status: 400 });

  // payload แบบ update เฉพาะฟิลด์ที่มีส่งมา
  const payload = {
    updated_at: new Date().toISOString(),
  };

  // --- ฟิลด์หลัก ---
  if ("name" in body) payload.name = clean(body.name);
  if ("phone" in body) payload.phone = clean(body.phone);
  if ("line_id" in body) payload.line_id = clean(body.line_id);
  if ("note" in body) payload.note = clean(body.note);

  // --- ข้อมูลบัญชี / indicator ---
  if ("account_no" in body) payload.account_no = clean(body.account_no);
  if ("broker_name" in body)
    payload.broker_name = clean(body.broker_name) || "Eterwealth";
  if ("tradingview_user" in body)
    payload.tradingview_user = clean(body.tradingview_user);

  // --- แพ็กเกจ / วันหมดอายุ ---
  if ("plan_type" in body)
    payload.plan_type = clean(body.plan_type) || "MONTHLY_1000";
  if ("expiry_date" in body)
    payload.expiry_date = toDateOnly(body.expiry_date);

  // ✅ เจ้าของลูกค้า (dropdown config)
  if ("owner_id" in body)
    payload.owner_id = body.owner_id ? String(body.owner_id).trim() : null;

  const { data, error } = await supabaseAdmin
    .from("customers")
    .update(payload)
    .eq("id", id)
    .select(
      `
        *,
        owner:customer_owners (
          id,
          name
        )
      `
    )
    .single();

  if (error) return new Response(error.message, { status: 500 });

  return Response.json({
    ...data,
    owner_name: data?.owner?.name ?? null,
  });
}