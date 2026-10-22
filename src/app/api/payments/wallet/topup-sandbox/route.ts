import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function POST(request: Request) {
  try {
    const { amount } = (await request.json()) as { amount?: number };
    const validAmount = typeof amount === "number" && amount > 0 && amount <= 500000 ? Math.round(amount) : 25000;

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        success: true,
        mode: "local",
        amount: validAmount,
        message: "Crédits de test enregistrés localement.",
      });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Connectez-vous pour recharger vos crédits." }, { status: 401 });
    }

    const requestId = randomUUID();
    const { error: insertError } = await supabase.from("wallet_transactions").insert({
      user_id: user.id,
      kind: "promotion",
      amount_xof: validAmount,
      description: `Recharge Sandbox (+${validAmount.toLocaleString("fr-FR")} FCFA)`,
      request_id: requestId,
    });

    if (insertError) {
      console.warn("Erreur insertion wallet_transactions:", insertError.message);
      // Return success with local fallback info if table not ready
      return NextResponse.json({
        success: true,
        mode: "fallback",
        amount: validAmount,
        message: `Crédit de test simulé (+${validAmount.toLocaleString("fr-FR")} FCFA).`,
      });
    }

    return NextResponse.json({
      success: true,
      amount: validAmount,
      message: `Votre portefeuille a été crédité de ${validAmount.toLocaleString("fr-FR")} FCFA avec succès !`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur lors de la recharge de test." },
      { status: 500 }
    );
  }
}
