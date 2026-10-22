import { NextResponse } from "next/server";
import { getPublicEvents } from "@/lib/events-server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase n'est pas configuré." }, { status: 503 });
  }

  const eventId = new URL(request.url).searchParams.get("id") ?? undefined;
  try {
    const events = await getPublicEvents(eventId);
    return NextResponse.json(events);
  } catch (error) {
    console.error("Event catalog request failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de charger les événements." },
      { status: 500 },
    );
  }
}
