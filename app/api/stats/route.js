import { supabaseAdmin } from "@/lib/supabaseAdmin";

function calcStatus(expiryDate) {
  const now = new Date();
  const exp = new Date(expiryDate);
  const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "EXPIRED";
  if (diffDays <= 15) return "EXPIRING";
  return "ACTIVE";
}

export async function GET() {
  const { data, error } = await supabaseAdmin.from("customers").select("expiry_date");
  if (error) return new Response(error.message, { status: 500 });

  const s = { total: data.length, active: 0, expiring: 0, expired: 0 };
  for (const r of data) {
    const st = calcStatus(r.expiry_date);
    if (st === "ACTIVE") s.active++;
    if (st === "EXPIRING") s.expiring++;
    if (st === "EXPIRED") s.expired++;
  }
  return Response.json(s);
}
