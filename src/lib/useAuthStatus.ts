"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function useAuthStatus() {
  const configured = isSupabaseConfigured();
  const [authenticated, setAuthenticated] = useState(false);
  const [canScan, setCanScan] = useState(false);
  const [ready, setReady] = useState(!configured);

  useEffect(() => {
    if (!configured) return;

    let active = true;
    const supabase = createClient();

    async function updateSession(userId: string | undefined) {
      if (!active) return;
      setAuthenticated(Boolean(userId));
      if (!userId) {
        setCanScan(false);
        setReady(true);
        return;
      }

      const { data: memberships } = await supabase
        .from("organizer_members")
        .select("role, permissions")
        .eq("member_user_id", userId)
        .eq("status", "active");
      if (!active) return;
      setCanScan((memberships ?? []).some((membership) => {
        const permissions = membership.permissions as Record<string, unknown>;
        return membership.role === "manager" || membership.role === "scanner" || permissions.scan === true;
      }));
      setReady(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void updateSession(session?.user?.id);
    });

    void supabase.auth.getSession().then(({ data }) => {
      void updateSession(data.session?.user?.id);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [configured]);

  return { authenticated, canScan, ready };
}