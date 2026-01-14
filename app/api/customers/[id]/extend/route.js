import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { sendTelegram } from "../../../../../lib/telegram";

function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0);
  return d.toISOString().slice(0,10);
}

export async function POST(req, { params }) {
  const { id } = params;
  const { months = 1 } = await req.json();

  const { data: customer, error: e1 } = await supabaseAdmin
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (e1) return new Response(e1.message, { status: 500 });

  const oldExp = customer.expiry_date;
  const newExp = addMonths(oldExp, months);

  const { error: e2 } = await supabaseAdmin
    .from("customers")
    .update({ expiry_date: newExp, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (e2) return new Response(e2.message, { status: 500 });

  await supabaseAdmin.from("renewal_log").insert({
    customer_id: id,
    months,
    old_expiry_date: oldExp,
    new_expiry_date: newExp,
  });

  await sendTelegram(
    `🔁 *ต่ออายุลูกค้า*\n` +
    `👤 ${customer.name}\n` +
    `🧾 Account: \`${customer.account_no}\`\n` +
    `➕ +${months} เดือน\n` +
    `⏳ Expiry: ${oldExp} → ${newExp}`
  );

  return new Response(null, { status: 204 });
}
