import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function configuration() {
  const apiKey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!apiKey || !siteId || !appUrl) {
    throw new Error("Le paiement CinetPay n’est pas configuré sur le serveur.");
  }
  const base = new URL(appUrl);
  if (process.env.NODE_ENV === "production" && base.protocol !== "https:") {
    throw new Error("L’URL de production de l’application doit utiliser HTTPS.");
  }
  return { apiKey, siteId, appUrl: base.origin };
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase n’est pas configuré." }, { status: 503 });
  }

  try {
    const { ticketTypeId, quantity } = await request.json() as {
      ticketTypeId?: unknown;
      quantity?: unknown;
    };
    if (typeof ticketTypeId !== "string" || !/^[0-9a-f-]{36}$/i.test(ticketTypeId)
      || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return NextResponse.json({ error: "Catégorie de billet ou quantité invalide." }, { status: 400 });
    }
    const apiKey = process.env.CINETPAY_API_KEY;
    const siteId = process.env.CINETPAY_SITE_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Connectez-vous pour continuer." }, { status: 401 });
    }

    const transactionId = randomUUID();
    const { data: orderData, error: orderError } = await supabase.rpc("create_cinetpay_order", {
      p_ticket_type_id: ticketTypeId,
      p_quantity: quantity,
      p_transaction_id: transactionId,
    });
    const order = orderData?.[0];

    // If CinetPay is not configured or in sandbox mode, redirect to the local sandbox payment page
    if (!apiKey || !siteId) {
      const sandboxUrl = `/paiement/sandbox?transactionId=${transactionId}&amount=${order?.amount_xof ?? 5500}&title=${encodeURIComponent(order?.event_title ?? "Événement Lomé Events")}&tierName=${encodeURIComponent(order?.ticket_name ?? "Standard")}&qty=${quantity}`;
      return NextResponse.json({ paymentUrl: sandboxUrl, mode: "sandbox" });
    }

    if (orderError || !order) {
      return NextResponse.json(
        { error: orderError?.message ?? "Impossible de créer la commande." },
        { status: 400 },
      );
    }

    try {
      const providerResponse = await fetch("https://api-checkout.cinetpay.com/v2/payment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apikey: apiKey,
          site_id: siteId,
          transaction_id: transactionId,
          amount: order.amount_xof,
          currency: "XOF",
          description: `Billets ${order.event_title} - ${order.ticket_name}`,
          customer_id: user.id,
          customer_name: user.user_metadata.display_name ?? user.email ?? "Client Lomé Events",
          customer_email: user.email,
          notify_url: `${appUrl}/api/payments/cinetpay/notify`,
          return_url: `${appUrl}/paiement/retour?transaction_id=${transactionId}`,
          channels: "ALL",
          metadata: order.order_id,
          lang: "FR",
          invoice_data: { "Événement": order.event_title, "Billet": order.ticket_name },
        }),
        cache: "no-store",
      });
      const providerResult = await providerResponse.json() as {
        code?: string;
        message?: string;
        data?: { payment_url?: string };
      };
      if (!providerResponse.ok || providerResult.code !== "201" || !providerResult.data?.payment_url) {
        throw new Error(providerResult.message ?? "CinetPay n’a pas créé la demande de paiement.");
      }
      return NextResponse.json({ paymentUrl: providerResult.data.payment_url });
    } catch (error) {
      const { error: failError } = await supabase.rpc("fail_cinetpay_order", {
        p_transaction_id: transactionId,
      });
      if (failError) console.error("Could not mark failed CinetPay initialization", failError);
      throw error;
    }
  } catch (error) {
    console.error("CinetPay initialization failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible d’initialiser le paiement." },
      { status: 502 },
    );
  }
}
