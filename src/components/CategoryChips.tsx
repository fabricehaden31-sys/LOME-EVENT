import Link from "next/link";
import { CATEGORIES } from "@/lib/data";
import { getIcon } from "@/lib/icons";

export default function CategoryChips({ active }: { active?: string }) {
  return (
    <div className="no-scrollbar flex gap-2.5 overflow-x-auto py-1 -mx-1 px-1">
      {CATEGORIES.map((cat) => {
        const isActive = active === cat.id;
        const Icon = getIcon(cat.emoji);
        return (
          <Link
            key={cat.id}
            href={`/recherche?cat=${encodeURIComponent(cat.id)}`}
            className={`flex min-h-11 shrink-0 items-center gap-2 rounded-sm border px-4 py-2 text-sm font-semibold transition-colors ${
              isActive
                ? "border-togogreen bg-togogreen text-white"
                : "border-line bg-ink-2 text-cream hover:border-togogreen hover:text-togogreen"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{cat.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
