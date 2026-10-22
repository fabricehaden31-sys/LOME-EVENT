"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowLeft, Gift, HandCoins, Ticket, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatFCFA } from "@/lib/utils";

type WalletTransaction = {
  id: string;
  kind: "refund" | "promotion" | "compensation" | "payment";
  amount_xof: number;
  description: string;
  created_at: string;
};

const KIND_LABELS: Record<WalletTransaction["kind"], string> = {
  refund: "Remboursement",
  promotion: "Crédit promotionnel",
  compensation: "Geste commercial",
  payment: "Achat de billet",
};

function kindIcon(kind: WalletTransaction["kind"]) {
  return kind === "refund"
    ? ArrowDownLeft
    : kind === "promotion"
      ? Gift
      : kind === "compensation"
        ? HandCoins
        : Ticket;
}

export default function PortefeuillePage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadWallet() {
      if (!isSupabaseConfigured()) {
        setError("Le portefeuille nécessite un compte Lomé Events et une connexion Supabase.");
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !user) {
        router.replace("/connexion");
        return;
      }

      const { data, error: transactionError } = await supabase
        .from("wallet_transactions")
        .select("id, kind, amount_xof, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (transactionError) {
        setError(`Impossible de charger votre portefeuille : ${transactionError.message}`);
      } else {
        const rows = data ?? [];
        setTransactions(rows);
        const calculated = rows.reduce((total, transaction) => {
          return transaction.kind === "payment"
            ? total - transaction.amount_xof
            : total + transaction.amount_xof;
        }, 0);
        setBalance(Math.max(0, calculated));
      }
      setLoading(false);
    }

    void loadWallet();
    return () => {
      active = false;
    };
  }, [router]);

  const [topupLoading, setTopupLoading] = useState(false);
  const [topupFeedback, setTopupFeedback] = useState("");

  const handleTopup = async (amount: number) => {
    setTopupLoading(true);
    setTopupFeedback("");
    try {
      const res = await fetch("/api/payments/wallet/topup-sandbox", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json() as { success?: boolean; message?: string; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Échec de la recharge de test.");
      }

      setBalance((b) => b + amount);
      setTransactions((prev) => [
        {
          id: `sandbox-${Date.now()}`,
          kind: "promotion",
          amount_xof: amount,
          description: `Recharge Sandbox (+${amount.toLocaleString("fr-FR")} FCFA)`,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setTopupFeedback(`+${amount.toLocaleString("fr-FR")} FCFA ajoutés avec succès !`);
      setTimeout(() => setTopupFeedback(""), 4000);
    } catch (err) {
      setTopupFeedback(err instanceof Error ? err.message : "Erreur de recharge.");
    } finally {
      setTopupLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 pb-28 lg:pb-10">
      <Link href="/profil" className="inline-flex items-center gap-2 text-sm text-muted hover:text-cream">
        <ArrowLeft className="h-4 w-4" />
        Mon compte
      </Link>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-togogreen">Crédit Lomé Events</p>
      <h1 className="mt-1 font-display text-3xl font-bold">Mon portefeuille</h1>

      <section className="mt-6 overflow-hidden rounded-3xl border border-togogreen/30 bg-gradient-to-br from-togogreen/15 via-ink-2 to-ink-2 p-6 sm:p-8">
        <div className="flex items-center gap-3 text-togogreen">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-togogreen/15">
            <Wallet className="h-5 w-5" />
          </span>
          <p className="font-semibold">Solde disponible</p>
        </div>
        <p className="mt-5 font-display text-4xl font-bold sm:text-5xl">
          {loading ? "…" : formatFCFA(balance)}
        </p>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
          Les crédits Lomé Events sont utilisables immédiatement pour acheter vos billets sur la plateforme.
        </p>
        <p className="mt-4 rounded-xl border border-line/60 bg-ink/40 px-4 py-3 text-sm text-cream/90">
          ✨ <span className="font-semibold text-amber">Nouveau :</span> Vous pouvez désormais utiliser directement vos crédits au moment du paiement pour régler vos billets !
        </p>

        {/* Section Sandbox / Rechargement de test */}
        <div className="mt-6 rounded-2xl border border-amber/30 bg-ink/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber">
              Sandbox &amp; Test local
            </span>
            <span className="text-[11px] text-muted">Recharge fictive immédiate</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Ajoutez des crédits de test pour essayer le paiement par portefeuille sur les billets :
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {[10000, 25000, 50000].map((amt) => (
              <button
                key={amt}
                type="button"
                disabled={topupLoading}
                onClick={() => void handleTopup(amt)}
                className="flex items-center gap-1.5 rounded-xl border border-amber/40 bg-amber/10 px-3.5 py-2 text-xs font-bold text-amber hover:bg-amber hover:text-ink transition disabled:opacity-50 cursor-pointer"
              >
                <span>+ {amt.toLocaleString("fr-FR")} FCFA</span>
              </button>
            ))}
          </div>

          {topupFeedback && (
            <p className="mt-2 text-xs font-semibold text-togogreen animate-pulse">
              {topupFeedback}
            </p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold">Historique des mouvements</h2>
        <div className="mt-4 overflow-hidden rounded-3xl border border-line/60 bg-ink-2">
          {loading ? (
            <p className="p-5 text-sm text-muted">Chargement de votre portefeuille…</p>
          ) : error ? (
            <p role="alert" className="p-5 text-sm text-togored">{error}</p>
          ) : transactions.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Wallet className="mx-auto h-9 w-9 text-muted" />
              <p className="mt-3 font-semibold">Aucun mouvement pour le moment</p>
              <p className="mt-1 text-sm text-muted">Les remboursements, promotions et paiements par crédits apparaîtront ici.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line/50">
              {transactions.map((transaction) => {
                const isDebit = transaction.kind === "payment";
                const Icon = kindIcon(transaction.kind);
                return (
                  <li key={transaction.id} className="flex items-center gap-4 px-5 py-4">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        isDebit
                          ? "bg-amber/10 text-amber"
                          : "bg-togogreen/10 text-togogreen"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{KIND_LABELS[transaction.kind]}</span>
                      <span className="block truncate text-xs text-muted">{transaction.description}</span>
                      <time className="mt-1 block text-[11px] text-muted">
                        {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(transaction.created_at))}
                      </time>
                    </span>
                    <span
                      className={`shrink-0 font-display font-bold ${
                        isDebit ? "text-cream/90" : "text-togogreen"
                      }`}
                    >
                      {isDebit ? "-" : "+"}{formatFCFA(transaction.amount_xof)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
