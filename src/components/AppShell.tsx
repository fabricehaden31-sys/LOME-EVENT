"use client";

import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { usePathname } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="site-motion min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pb-24 lg:pb-10">
        <div key={pathname} className="app-page-enter">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
