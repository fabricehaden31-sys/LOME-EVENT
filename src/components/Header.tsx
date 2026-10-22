"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useAuthStatus } from "@/lib/useAuthStatus";
import { applyTheme, THEME_EVENT, THEME_KEY } from "@/components/ThemeProvider";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" aria-label="Lomé event, accueil" className="flex shrink-0 items-center">
      <Image
        src="/lome-events-logo.svg"
        alt=""
        width={210}
        height={80}
        priority
        className={`logo-light h-auto ${compact ? "w-[105px]" : "w-[145px]"}`}
      />
      <Image
        src="/lome-events-logo-dark.svg"
        alt=""
        width={210}
        height={80}
        priority
        className={`logo-dark h-auto ${compact ? "w-[105px]" : "w-[145px]"}`}
      />
    </Link>
  );
}

const LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/recherche", label: "Explorer" },
  { href: "/billets", label: "Billets" },
  { href: "/favoris", label: "Favoris" },
  { href: "/profil", label: "Compte" },
];

export default function Header() {
  const pathname = usePathname();
  const { authenticated, canScan, ready } = useAuthStatus();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [themeStatus, setThemeStatus] = useState("");
  const ctaHref = authenticated ? "/organisateur" : "/connexion";
  const ctaLabel = authenticated ? "Espace pro" : "Devenir organisateur";

  useEffect(() => {
    const syncTheme = () => {
      const savedTheme = window.localStorage.getItem(THEME_KEY);
      setTheme(savedTheme === "light" ? "light" : "dark");
    };

    syncTheme();
    window.addEventListener(THEME_EVENT, syncTheme);
    return () => window.removeEventListener(THEME_EVENT, syncTheme);
  }, []);

  async function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    setThemeStatus("");

    if (!authenticated || !isSupabaseConfigured()) return;

    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        setThemeStatus(`Thème modifié sur cet appareil, mais non enregistré sur votre compte : ${authError.message}`);
        return;
      }
      if (!user) {
        setThemeStatus("Thème modifié sur cet appareil, mais votre session a expiré.");
        return;
      }

      const { error } = await supabase.from("user_settings").update({ theme: nextTheme }).eq("user_id", user.id);
      if (error) {
        setThemeStatus(`Thème modifié sur cet appareil, mais non enregistré sur votre compte : ${error.message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      setThemeStatus(`Thème modifié sur cet appareil, mais non enregistré sur votre compte : ${message}`);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/95 backdrop-blur-lg">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <form
          action="/recherche"
          className="hidden sm:flex flex-1 max-w-md ml-4"
          role="search"
        >
          <label htmlFor="global-q" className="sr-only">
            Rechercher un événement
          </label>
          <input
            id="global-q"
            name="q"
            type="search"
            placeholder="Rechercher un événement…"
            className="w-full rounded-sm border border-line bg-ink-2 px-4 py-2.5 text-sm placeholder:text-muted transition-colors focus:border-togogreen focus:outline-none"
          />
        </form>
        <div className="relative ml-auto flex items-center gap-2 lg:ml-0">
          <button
            type="button"
            onClick={() => void toggleTheme()}
            aria-label={`Activer le thème ${theme === "dark" ? "clair" : "sombre"}`}
            title={`Passer au thème ${theme === "dark" ? "clair" : "sombre"}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-line bg-ink-2 text-muted transition-colors hover:border-togogreen hover:text-togogreen focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-togogreen"
          >
            {theme === "dark" ? <Sun aria-hidden="true" className="h-5 w-5" /> : <Moon aria-hidden="true" className="h-5 w-5" />}
          </button>
          {themeStatus && (
            <span
              role="status"
              aria-live="polite"
              className="absolute right-0 top-full z-50 mt-2 w-64 rounded-sm border border-line bg-ink-2 p-3 text-xs text-cream shadow-glow"
            >
              {themeStatus}
            </span>
          )}
        </div>
        <nav className="ml-auto hidden lg:flex items-center gap-5 text-sm">
          {LINKS.map((l) => {
            const href = l.href === "/profil" && ready && !authenticated ? "/connexion" : l.href;
            const active = pathname === href;

            return (
              <Link
                key={l.href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "font-semibold text-togogreen"
                    : "text-muted transition-colors hover:text-cream"
                }
              >
                {l.label}
              </Link>
            );
          })}
          {ready && canScan && (
            <Link href="/scanner" aria-current={pathname === "/scanner" ? "page" : undefined} className={pathname === "/scanner" ? "font-semibold text-togogreen" : "text-muted transition-colors hover:text-cream"}>
              Scanner
            </Link>
          )}
          {ready && !authenticated && (
            <Link
              href="/connexion"
              className="rounded-sm border border-line bg-ink-2 px-4 py-2.5 font-semibold text-cream transition-colors hover:border-togogreen hover:text-togogreen"
            >
              Connexion
            </Link>
          )}
          <Link
            href={ctaHref}
            className="primary-action rounded-sm px-4 py-2.5 font-semibold"
          >
            {ctaLabel}
          </Link>
        </nav>
      </div>
    </header>
  );
}
