import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // ปรับตาม export จริงของคุณ

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("customer_owners")
    .select("id,name,is_active,sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}