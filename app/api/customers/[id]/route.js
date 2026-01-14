import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function PATCH(req, { params }) {
  const body = await req.json();
  const { id } = params;

  const payload = {
    name: body.name,
    phone: body.phone || null,
    line_id: body.line_id || null,
    plan_type: body.plan_type || "MONTHLY_1000",
    expiry_date: body.expiry_date ? body.expiry_date.slice(0,10) : null,
    note: body.note || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("customers")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return new Response(error.message, { status: 500 });
  return Response.json(data);
}
