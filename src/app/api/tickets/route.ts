import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { StoredTicket } from "@/lib/store";
import type { Json } from "@/lib/supabase/database.types";

function mapTickets(value: Json): StoredTicket[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as { [key: string]: Json | undefined };
    if (typeof row.code !== "string" || typeof row.event_id !== "string"
      || typeof row.tier_name !== "string" || typeof row.price !== "number"
      || typeof row.fees !== "number" || typeof row.purchased_at !== "string") return [];
    return [{
      code: row.code,
      eventId: row.event_id,
      tierName: row.tier_name,
      price: row.price,
      qty: 1,
      fees: row.fees,
      buyerName: typeof row.buyer_name === "string" ? row.buyer_name : "Participant",
      purchasedAt: row.purchased_at,
      used: row.used === true,
    }];
  });
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase n’est pas configuré." }, { status: 503 });
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Connectez-vous pour consulter vos billets." }, { status: 401 });
  }
  const { data, error } = await supabase.rpc("get_my_tickets");
  if (error) {
    console.error("Ticket list request failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(mapTickets(data));
}
