import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

async function processNotification(request: Request) {
  const apiKey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !siteId || !supabaseUrl || !serviceRoleKey) {
    throw new Error("La vérification serveur CinetPay n’est pas configurée.");
  }

  const form = request.method === "POST" ? await request.formData() : null;
  const url = new URL(request.url);
  const transactionId = String(form?.get("cpm_trans_id") ?? form?.get("transaction_id")
    ?? url.searchParams.get("cpm_trans_id") ?? url.searchParams.get("transaction_id") ?? "");
  if (!/^[A-Fa-f0-9-]{32,36}$/.test(transactionId)) {
    return NextResponse.json({ error: "Référence de transaction invalide." }, { status: 400 });
  }

  const providerResponse = await fetch("https://api-checkout.cinetpay.com/v2/payment/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apikey: apiKey, site_id: siteId, transaction_id: transactionId }),
    cache: "no-store",
  });
  const providerResult = await providerResponse.json() as {
    code?: string;
    message?: string;
    data?: { status?: string; amount?: number | string; currency?: string };
  };
  if (!providerResponse.ok || providerResult.code !== "00" || !providerResult.data) {
    throw new Error(providerResult.message ?? "Le statut n’a pas pu être vérifié auprès de CinetPay.");
  }

  const status = providerResult.data.status === "ACCEPTED" ? "succeeded"
    : ["REFUSED", "CANCELLED"].includes(providerResult.data.status ?? "") ? "failed" : null;
  if (!status) return NextResponse.json({ status: "pending" });
  if (status === "succeeded" && providerResult.data.currency !== "XOF") {
    throw new Error("La devise retournée par CinetPay ne correspond pas à XOF.");
  }
  const amount = Number(providerResult.data.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Le montant retourné par CinetPay est invalide.");
  }

  const supabase = createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.rpc("finalize_cinetpay_payment", {
    p_transaction_id: transactionId,
    p_status: status,
    p_amount_xof: amount,
  });
  if (error) throw new Error(`Impossible de confirmer la commande : ${error.message}`);
  return NextResponse.json({ status });
}

export async function POST(request: Request) {
  try {
    return await processNotification(request);
  } catch (error) {
    console.error("CinetPay notification verification failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Vérification du paiement impossible." },
      { status: 502 },
    );
  }
}

export async function GET(request: Request) {
  try {
    return await processNotification(request);
  } catch (error) {
    console.error("CinetPay return verification failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Vérification du paiement impossible." },
      { status: 502 },
    );
  }
}
