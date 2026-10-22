"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function ConnexionPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [accountType, setAccountType] = useState<"participant" | "organizer">("participant");
  const [signupStep, setSignupStep] = useState<1 | 2>(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const supabase = createClient();

    if (mode === "signup") {
      const validationErrors: string[] = [];
      const acceptTerms = formData.get("accept_terms") === "on";

      if (!email) validationErrors.push("Renseignez votre adresse e-mail.");
      if (!password || password.length < 6) validationErrors.push("Le mot de passe est trop court.");
      if (accountType === "organizer" && signupStep === 2 && !acceptTerms) {
        validationErrors.push("Veuillez accepter les conditions pour continuer.");
      }

      if (validationErrors.length) {
        setError(validationErrors.join(" "));
        setPending(false);
        return;
      }
    }

    try {
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                display_name: String(formData.get("name") ?? "").trim(),
                phone: String(formData.get("phone") ?? "").trim(),
                country: String(formData.get("country") ?? "").trim(),
                city: String(formData.get("city") ?? "").trim(),
                avatar_url: String(formData.get("avatar_url") ?? "").trim(),
                registration_type: accountType,
                ...(accountType === "organizer" ? {
                  organization_name: String(formData.get("organization_name") ?? "").trim(),
                  organization_type: String(formData.get("organization_type") ?? "other"),
                  organization_description: String(formData.get("organization_description") ?? "").trim(),
                  business_phone: String(formData.get("business_phone") ?? "").trim(),
                  business_email: String(formData.get("business_email") ?? "").trim(),
                  website: String(formData.get("website") ?? "").trim(),
                  social_links: {
                    instagram: String(formData.get("instagram") ?? "").trim(),
                    facebook: String(formData.get("facebook") ?? "").trim(),
                    tiktok: String(formData.get("tiktok") ?? "").trim(),
                  },
                } : {}),
              },
            },
          });

      setPending(false);
      if (result.error) {
        const authMessage = result.error.message?.toLowerCase() ?? "";
        if (authMessage.includes("anonymous") || authMessage.includes("sign-in") || authMessage.includes("disabled")) {
          setMessage("L’inscription est temporairement indisponible. Réessayez plus tard.");
          return;
        }
        setError("Une erreur est survenue pendant l’inscription. Réessayez.");
        return;
      }

      if (mode === "signup" && !result.data.session) {
        setError("Le compte est créé, mais Supabase n’a pas ouvert de session. Vérifiez la confirmation d’e-mail dans les paramètres Supabase.");
        return;
      }

      const userId = result.data.user?.id;
      if (!userId) {
        setError("Connexion réussie, mais le compte utilisateur est introuvable.");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      const destination = profile?.role === "admin"
        ? "/admin"
        : result.data.user?.user_metadata?.registration_type === "organizer"
          ? "/organisateur"
          : "/profil";
      router.replace(destination);
      router.refresh();
    } catch (submitError) {
      setPending(false);
      setError(submitError instanceof Error ? submitError.message : "Une erreur est survenue. Réessayez.");
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <p className="text-xs font-bold uppercase tracking-widest text-togogreen">Compte Lomé Events</p>
        <h1 className="mt-2 font-display text-4xl font-bold">Connexion indisponible</h1>
        <p className="mt-4 text-muted">
          Le projet Supabase n&apos;est pas encore configuré. Ajoutez son URL et sa clé publique dans
          <code className="mx-1 rounded bg-ink-3 px-1.5 py-0.5 text-cream">.env.local</code>
          après avoir créé le projet.
        </p>
        <Link href="/" className="mt-6 inline-block font-semibold text-togogreen hover:underline">
          Retour à l&apos;accueil
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-20 lg:py-10">
      <div className="overflow-hidden rounded-2xl border border-line bg-ink-2 shadow-glow lg:grid lg:grid-cols-[1.08fr_1.18fr]">
        <section className="bg-ink-2 p-5 sm:p-7 lg:p-8 xl:p-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-togogreen">Lomé Events</p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-cream sm:text-5xl" key={`${mode}-title`}>
            {mode === "login" ? "Heureux de vous revoir." : "Créer un compte"}
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted" key={`${mode}-description`}>
            {mode === "login"
              ? "Connectez-vous pour retrouver vos billets et découvrir les prochains événements à Lomé."
              : "Rejoignez la communauté événementielle de Lomé."}
          </p>

          {mode === "signup" && (
            <fieldset className="mt-6">
              <legend className="text-sm font-semibold text-cream">Vous êtes…</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {([
                  ["participant", "Participant", "Acheter des billets et découvrir les événements"],
                  ["organizer", "Organisateur", "Créer et gérer vos événements et ventes"],
                ] as const).map(([value, title, description]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={accountType === value}
                    onClick={() => {
                      setAccountType(value);
                      setSignupStep(1);
                      setError("");
                      setMessage("");
                    }}
                    className={`rounded-xl border px-4 py-4 text-left transition ${accountType === value ? "border-togogreen bg-togogreen/10" : "border-line bg-ink hover:border-togogreen/50"}`}
                  >
                    <span className="block font-display text-xl font-bold text-cream">{title}</span>
                    <span className="mt-1 block text-sm text-muted">{description}</span>
                  </button>
                ))}
              </div>
              {accountType === "organizer" && (
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-togogreen">
                  Étape {signupStep} sur 2 {signupStep === 1 ? "· Vos informations" : "· Votre organisation"}
                </p>
              )}
            </fieldset>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <fieldset disabled={accountType === "organizer" && signupStep === 2} hidden={accountType === "organizer" && signupStep === 2} className="space-y-4">
                <label className="block text-sm font-semibold text-cream">
                  Nom et prénom
                  <input name="name" autoComplete="name" className="mt-1.5 w-full rounded-xl border border-line/80 bg-[#191c1d] px-3 py-3 font-normal text-cream placeholder:text-muted focus:border-togogreen focus:outline-none focus:ring-2 focus:ring-togogreen/20" />
                </label>
                <label className="block text-sm font-semibold text-cream">
                  Adresse e-mail
                  <input name="email" type="text" inputMode="email" autoComplete="email" className="mt-1.5 w-full rounded-xl border border-line/80 bg-[#191c1d] px-3 py-3 font-normal text-cream focus:border-togogreen focus:outline-none focus:ring-2 focus:ring-togogreen/20" />
                </label>
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="text-sm font-semibold text-cream">Mot de passe</label>
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-togogreen hover:underline" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {showPassword ? "Masquer" : "Afficher"}
                    </button>
                  </div>
                  <input name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={6} className="w-full rounded-xl border border-line/80 bg-[#191c1d] px-3 py-3 font-normal text-cream focus:border-togogreen focus:outline-none focus:ring-2 focus:ring-togogreen/20" />
                </div>
              </fieldset>
            )}

            {mode === "login" && (
              <>
                <label className="block text-sm font-semibold text-cream">
                  Adresse e-mail
                  <input name="email" type="text" inputMode="email" autoComplete="email" className="mt-1.5 w-full rounded-xl border border-line/80 bg-[#191c1d] px-3 py-3 font-normal text-cream focus:border-togogreen focus:outline-none focus:ring-2 focus:ring-togogreen/20" />
                </label>
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="text-sm font-semibold text-cream">Mot de passe</label>
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-togogreen hover:underline" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {showPassword ? "Masquer" : "Afficher"}
                    </button>
                  </div>
                  <input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" minLength={6} className="w-full rounded-xl border border-line/80 bg-[#191c1d] px-3 py-3 font-normal text-cream focus:border-togogreen focus:outline-none focus:ring-2 focus:ring-togogreen/20" />
                  <div className="mt-2 text-right">
                    <Link href="/connexion" className="text-sm font-medium text-togogreen hover:underline">Mot de passe oublié ?</Link>
                  </div>
                </div>
              </>
            )}

            {mode === "signup" && accountType === "organizer" && signupStep === 2 && (
              <section className="space-y-4 border-t border-line pt-5">
                <h2 className="font-display text-2xl font-bold text-cream">Vérification pour recevoir les paiements</h2>
                <p className="text-sm leading-6 text-muted">Pour créer votre compte, il suffit de confirmer votre accord avec les règles de la plateforme. La vérification pour recevoir de l’argent peut se faire plus tard, une fois votre premier événement prêt.</p>
                <label className="flex items-start gap-3 rounded-xl border border-line bg-ink p-3 text-sm text-cream">
                  <input type="checkbox" name="accept_terms" className="mt-1 h-4 w-4 accent-togogreen" />
                  <span>Je confirme respecter les règles de la plateforme et les conditions générales. Je peux être vérifié plus tard pour recevoir les paiements.</span>
                </label>
                <aside className="border-l-4 border-togogreen bg-ink p-4 text-sm text-muted">
                  <p className="font-semibold text-cream">Compte rapide</p>
                  <p className="mt-1">Créer un compte est instantané. La vérification financière est séparée pour ne pas ralentir l’inscription.</p>
                </aside>
              </section>
            )}

            {error && <p role="alert" className="text-sm text-togored">{error}</p>}
            {message && <p role="status" className="text-sm text-togogreen">{message}</p>}

            {mode === "signup" && accountType === "organizer" && signupStep === 2 && (
              <button type="button" onClick={() => setSignupStep(1)} className="w-full border border-line bg-ink px-4 py-3 font-semibold text-cream transition-colors hover:border-togogreen">Retour aux informations personnelles</button>
            )}
            {mode === "signup" && accountType === "organizer" && signupStep === 1 ? (
              <button type="button" onClick={(event) => { if (event.currentTarget.form?.reportValidity()) { setError(""); setSignupStep(2); } }} className="primary-action w-full rounded-xl px-4 py-3 font-bold transition duration-200">Continuer vers l’organisation</button>
            ) : (
              <button disabled={pending} className="primary-action flex h-[54px] w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold transition duration-200 disabled:opacity-60">
                {pending && <span aria-hidden="true" className="auth-spinner" />}
                {pending ? "Vérification…" : mode === "login" ? "Se connecter" : accountType === "organizer" ? "Vérifier et créer mon compte" : "Créer mon compte"}
              </button>
            )}
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            {mode === "login" ? "Vous n'avez pas encore de compte ?" : "Vous avez déjà un compte ?"}{" "}
            <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setAccountType("participant"); setSignupStep(1); setError(""); setMessage(""); setShowPassword(false); }} className="font-bold text-togogreen hover:underline">
              {mode === "login" ? "Créer un compte" : "Se connecter"}
            </button>
          </p>
        </section>

        <aside className="relative hidden min-h-[620px] bg-ink lg:block">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                'linear-gradient(180deg, rgba(11,11,13,0.18) 0%, rgba(11,11,13,0.78) 100%), url("https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=80")',
            }}
          />
          <div className="relative z-10 flex h-full flex-col justify-end p-8 xl:p-10">
            <span className="mb-3 w-fit rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
              Lomé Events
            </span>
            <h2 className="max-w-md font-display text-3xl leading-tight text-white xl:text-5xl">Découvrez ce qui se passe à Lomé.</h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/80">
              Concerts, soirées, conférences et rendez-vous à ne pas manquer dans la ville.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
