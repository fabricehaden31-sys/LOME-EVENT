import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <p className="text-xs font-bold uppercase tracking-widest text-togogreen">Administration</p>
        <h1 className="mt-2 font-display text-4xl font-bold">Backend requis</h1>
        <p className="mt-4 text-muted">
          Le tableau de bord admin est verrouillé jusqu&apos;à la configuration de Supabase et la
          création d&apos;un compte administrateur.
        </p>
        <Link href="/connexion" className="mt-6 inline-block font-semibold text-togogreen hover:underline">
          Ouvrir la connexion
        </Link>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/profil");
  return children;
}