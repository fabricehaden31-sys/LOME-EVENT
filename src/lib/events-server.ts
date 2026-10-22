import { createClient } from "@/lib/supabase/server";
import { mapPublicEvents } from "@/lib/events";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function getPublicEvents(eventId?: string) {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_public_events", {
      p_event_id: eventId ?? null,
    });

    if (error) {
      console.warn(`Impossible de charger les événements depuis Supabase : ${error.message}`);
      return [];
    }

    return mapPublicEvents(data);
  } catch (err) {
    console.warn("Erreur inattendue dans getPublicEvents:", err);
    return [];
  }
}
