import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function GET() {
  // เอา filter is_active ออกก่อน เพื่อกันกรณีข้อมูลเก่าติด false/null
  const { data, error } = await supabaseAdmin
    .from("customer_owners")
    .select("id,name,is_active,sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return new Response(error.message, { status: 500 });

  // คืนเป็น array ตรงๆ ให้ UI ใช้ง่ายที่สุด
  return Response.json(data || []);
}