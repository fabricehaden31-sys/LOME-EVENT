"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";

type PaymentStatus = "checking" | "succeeded" | "failed" | "pending" | "error";

function PaymentReturnInner() {
  const params = useSearchParams();
  const transactionId = params.get("transaction_id") ?? "";
  const [status, setStatus] = useState<PaymentStatus>("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    if (!/^[A-Fa-f0-9-]{32,36}$/.test(transactionId)) {
      setStatus("error");
      setMessage("Référence de transaction invalide.");
      return;
    }
    fetch(`/api/payments/cinetpay/notify?transaction_id=${encodeURIComponent(transactionId)}`)
      .then(async (response) => {
        const result = await response.json() as { status?: string; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Vérification impossible.");
        if (active) {
          setStatus(result.status === "succeeded" ? "succeeded"
            : result.status === "failed" ? "failed" : "pending");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "Vérification impossible.");
        }
      });
    return () => { active = false; };
  }, [transactionId]);

  return (
    <main className="mx-auto max-w-lg px-4 py-20 text-center">
      {status === "checking" ? (
        <LoaderCircle className="mx-auto h-12 w-12 animate-spin text-amber" />
      ) : status === "succeeded" ? (
        <Check className="mx-auto h-12 w-12 text-togogreen" />
      ) : (
        <CircleAlert className="mx-auto h-12 w-12 text-amber" />
      )}
      <h1 className="mt-5 font-display text-3xl font-bold">
        {status === "checking" ? "Vérification du paiement…"
          : status === "succeeded" ? "Paiement confirmé"
          : status === "failed" ? "Paiement non abouti"
          : status === "pending" ? "Paiement en cours de confirmation"
          : "Vérification impossible"}
      </h1>
      <p role={status === "error" ? "alert" : "status"} className="mt-3 text-sm text-muted">
        {message || (status === "succeeded"
          ? "Vos billets sont disponibles dans votre espace."
          : status === "pending"
            ? "Ne payez pas une seconde fois. Actualisez cette page dans quelques instants."
            : status === "failed"
              ? "Aucun billet n’a été émis. Vous pouvez réessayer depuis l’événement."
              : "Nous vérifions la transaction auprès du prestataire.")}
      </p>
      <Link
        href={status === "succeeded" ? "/billets" : "/"}
        className="mt-7 inline-block rounded-full bg-togogreen px-6 py-3 font-semibold text-white"
      >
        {status === "succeeded" ? "Voir mes billets" : "Retour aux événements"}
      </Link>
    </main>
  );
}

export default function PaymentReturnPage() {
  return <Suspense fallback={<main className="p-16 text-center text-muted">Vérification du paiement…</main>}><PaymentReturnInner /></Suspense>;
}
