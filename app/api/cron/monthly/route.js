import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { sendTelegram } from "../../../../lib/telegram";

function diffDays(expiryDate) {
  const now = new Date();
  const exp = new Date(expiryDate);
  return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
}

export async function POST(req) {
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('name,account_no,expiry_date,plan_type');

  if (error) return new Response(error.message, { status: 500 });

  const expiring = [];
  const expired = [];

  for (const c of data) {
    const d = diffDays(c.expiry_date);
    if (d < 0) expired.push({ ...c, d });
    else if (d <= 15) expiring.push({ ...c, d });
  }

  const lines = [];
  lines.push(`📌 *CRM รายงานประจำเดือน*`);
  lines.push(`⏰ *ใกล้หมดอายุ (≤15 วัน)*: ${expiring.length} คน`);
  for (const c of expiring.slice(0, 30)) {
    lines.push(
      `- ${c.name} | \`${c.account_no}\` | ${c.expiry_date} (เหลือ ${c.d} วัน)`
    );
  }
  if (expiring.length > 30) lines.push(`...และอีก ${expiring.length - 30} คน`);

  lines.push(`\n❌ *หมดอายุแล้ว*: ${expired.length} คน`);
  for (const c of expired.slice(0, 30)) {
    lines.push(
      `- ${c.name} | \`${c.account_no}\` | ${c.expiry_date} (เลย ${Math.abs(
        c.d
      )} วัน)`
    );
  }
  if (expired.length > 30) lines.push(`...และอีก ${expired.length - 30} คน`);

  await sendTelegram(lines.join('\n'));
  return new Response(null, { status: 204 });
}
