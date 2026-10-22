"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStatus } from "@/lib/useAuthStatus";

const ITEMS = [
  { href: "/", label: "Accueil" },
  { href: "/recherche", label: "Explorer" },
  { href: "/billets", label: "Billets" },
  { href: "/favoris", label: "Favoris" },
  { href: "/profil", label: "Compte" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { authenticated, canScan, ready } = useAuthStatus();
  const items = canScan ? [...ITEMS, { href: "/scanner", label: "Scanner" }] : ITEMS;
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden"
    >
      <div className={canScan ? "grid grid-cols-6" : "grid grid-cols-5"}>
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href === "/profil" && ready && !authenticated ? "/connexion" : item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 border-t-2 px-1 text-xs font-semibold transition-colors ${
                active ? "border-togogreen text-togogreen" : "border-transparent text-muted"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
