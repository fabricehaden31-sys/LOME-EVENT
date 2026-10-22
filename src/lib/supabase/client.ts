"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseConfig } from "./config";

let browserClient: SupabaseClient<Database> | undefined;

export function createClient() {
  if (browserClient) return browserClient;

  const { url, key } = getSupabaseConfig();
  browserClient = createBrowserClient<Database>(url, key);
  return browserClient;
}