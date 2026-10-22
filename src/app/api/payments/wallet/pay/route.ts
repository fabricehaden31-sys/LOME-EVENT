import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase n’est pas configuré." }, { status: 503 });
  }

  try {
    const { ticketTypeId, quantity } = (await request.json()) as {
      ticketTypeId?: unknown;
      quantity?: unknown;
    };

    if (
      typeof ticketTypeId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(ticketTypeId) ||
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 10
    ) {
      return NextResponse.json(
        { error: "Catégorie de billet ou quantité invalide." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Connectez-vous pour payer avec vos crédits." },
        { status: 401 },
      );
    }

    const requestId = randomUUID();
    const { data, error: payError } = await supabase.rpc("pay_order_with_wallet", {
      p_ticket_type_id: ticketTypeId,
      p_quantity: quantity,
      p_request_id: requestId,
    });

    if (payError || !data || data.length === 0) {
      return NextResponse.json(
        { error: payError?.message ?? "Impossible de finaliser le paiement avec vos crédits." },
        { status: 400 },
      );
    }

    const result = data[0];
    return NextResponse.json({
      success: true,
      orderId: result.order_id,
      totalPaid: result.total_paid_xof,
      ticketCount: result.ticket_count,
    });
  } catch (error) {
    console.error("Wallet checkout error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur interne du serveur." },
      { status: 500 },
    );
  }
}
