import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ balance: 0 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ balance: 0, authenticated: false });
    }

    // Try RPC first
    const { data: rpcBalance, error: rpcError } = await supabase.rpc("get_wallet_balance");
    if (!rpcError && typeof rpcBalance === "number") {
      return NextResponse.json({ balance: Math.max(0, rpcBalance), authenticated: true });
    }

    // Fallback to table sum if migration is being applied
    const { data: rows, error: selectError } = await supabase
      .from("wallet_transactions")
      .select("kind, amount_xof")
      .eq("user_id", user.id);

    if (selectError) {
      return NextResponse.json({ balance: 0, authenticated: true });
    }

    const calculated = (rows ?? []).reduce((acc, row) => {
      return row.kind === "payment" ? acc - (row.amount_xof ?? 0) : acc + (row.amount_xof ?? 0);
    }, 0);

    return NextResponse.json({ balance: Math.max(0, calculated), authenticated: true });
  } catch {
    return NextResponse.json({ balance: 0, authenticated: false });
  }
}
