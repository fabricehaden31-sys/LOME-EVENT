"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ADMIN_USERS,
  PAYMENTS,
  REPORTS,
  CATEGORIES,
  type AdminEvent,
  type AdminUser,
} from "@/lib/data";
import { formatFCFA } from "@/lib/utils";
import { getIcon } from "@/lib/icons";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { BellRing, Building2, CheckCheck, Flag, Tag, Ticket, Users, Wallet } from "lucide-react";

type EventStatus = AdminEvent["status"];
type UserStatus = AdminUser["status"];

const EVENT_BADGE: Record<EventStatus, string> = {
  Publié: "bg-togogreen/15 text-togogreen border-togogreen/40",
  "En attente": "bg-gold/15 text-gold border-gold/40",
  Rejeté: "bg-togored/15 text-togored border-togored/40",
};

const USER_BADGE: Record<UserStatus, string> = {
  Actif: "bg-togogreen/15 text-togogreen border-togogreen/40",
  Suspendu: "bg-togored/15 text-togored border-togored/40",
};

const PAYMENT_BADGE: Record<string, string> = {
  Réussi: "bg-togogreen/15 text-togogreen border-togogreen/40",
  "En attente": "bg-gold/15 text-gold border-gold/40",
  Échoué: "bg-togored/15 text-togored border-togored/40",
};

const REPORT_BADGE: Record<string, string> = {
  Ouvert: "bg-togored/15 text-togored border-togored/40",
  "En cours": "bg-gold/15 text-gold border-gold/40",
  Résolu: "bg-togogreen/15 text-togogreen border-togogreen/40",
};

const SECTIONS = [
  { id: "utilisateurs", label: "Utilisateurs", icon: Users },
  { id: "organisateurs", label: "Organisateurs en attente", icon: Building2 },
  { id: "evenements", label: "Événements", icon: Ticket },
  { id: "paiements", label: "Paiements", icon: Wallet },
  { id: "portefeuille", label: "Crédits Lomé Events", icon: Wallet },
  { id: "categories", label: "Catégories", icon: Tag },
  { id: "signalements", label: "Signalements", icon: Flag },
  { id: "notifications", label: "Notifications", icon: BellRing },
] as const;

function Badge({ text, cls }: { text: string; cls: string }) {
  return (
    <span className={`inline-block text-[11px] font-semibold border rounded-full px-2 py-0.5 ${cls}`}>
      {text}
    </span>
  );
}

const cardCls = "rounded-2xl bg-ink-2 border border-line/60 p-5";
const thCls = "text-left text-[11px] uppercase tracking-widest text-muted font-semibold pb-3";
const tdCls = "py-3 border-t border-line/40 text-sm";

export default function AdminPage() {
  const [users, setUsers] = useState(ADMIN_USERS);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [organizerApplications, setOrganizerApplications] = useState<Array<{
    id: string;
    user_id: string;
    organization_name: string;
    organization_type: string;
    description: string;
    business_phone: string;
    business_email: string;
    website: string | null;
    social_links: unknown;
    created_at: string;
    applicant_name: string;
    applicant_phone: string | null;
  }>>([]);
  const [applicationMessage, setApplicationMessage] = useState("");
  const [reviewingApplication, setReviewingApplication] = useState<string | null>(null);
  const [walletCreditPending, setWalletCreditPending] = useState(false);
  const [walletCreditMessage, setWalletCreditMessage] = useState("");
  const [walletCreditRequestId, setWalletCreditRequestId] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;

    async function loadApplications() {
      const supabase = createClient();
      const { data: pendingEvents, error: eventsError } = await supabase
        .from("events")
        .select("id, title, organizer_id, starts_at, status")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (!active) return;
      if (eventsError) {
        setApplicationMessage(`Impossible de charger les événements à valider : ${eventsError.message}`);
      } else {
        const organizerIds = [...new Set((pendingEvents ?? []).map((event) => event.organizer_id))];
        const { data: profiles, error: profileError } = organizerIds.length
          ? await supabase.from("profiles").select("id, display_name").in("id", organizerIds)
          : { data: [], error: null };
        if (!active) return;
        if (profileError) {
          setApplicationMessage(`Impossible de charger les organisateurs : ${profileError.message}`);
        } else {
          const nameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
          setEvents((pendingEvents ?? []).map((event) => ({
            id: event.id,
            title: event.title,
            organizer: nameById.get(event.organizer_id) || "Organisateur",
            date: new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(event.starts_at)),
            status: "En attente",
          })));
        }
      }

      const { data: applications, error } = await supabase
        .from("organizer_applications")
        .select("id, user_id, organization_name, organization_type, description, business_phone, business_email, website, social_links, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (!active) return;
      if (error) {
        setApplicationMessage(error.message);
        return;
      }
      if (!applications?.length) {
        setOrganizerApplications([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name, phone")
        .in("id", applications.map((application) => application.user_id));
      if (!active) return;
      if (profilesError) {
        setApplicationMessage(profilesError.message);
        return;
      }
      const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      setOrganizerApplications(applications.map((application) => {
        const profile = profileById.get(application.user_id);
        return {
          ...application,
          applicant_name: profile?.display_name || "Nom non renseigné",
          applicant_phone: profile?.phone ?? null,
        };
      }));
    }

    void loadApplications();
    return () => {
      active = false;
    };
  }, []);

  async function approveApplication(applicationId: string) {
    setReviewingApplication(applicationId);
    const { error } = await createClient().rpc("approve_organizer_application", {
      p_application_id: applicationId,
    });
    setReviewingApplication(null);
    if (error) {
      setApplicationMessage(error.message);
      return;
    }
    setOrganizerApplications((current) => current.filter((application) => application.id !== applicationId));
    setApplicationMessage("Demande approuvée. Le rôle organisateur est activé.");
  }

  async function rejectApplication(applicationId: string) {
    const reason = window.prompt("Indiquez le motif du refus :")?.trim();
    if (!reason) return;
    setReviewingApplication(applicationId);
    const { error } = await createClient().rpc("reject_organizer_application", {
      p_application_id: applicationId,
      p_reason: reason,
    });
    setReviewingApplication(null);
    if (error) {
      setApplicationMessage(error.message);
      return;
    }
    setOrganizerApplications((current) => current.filter((application) => application.id !== applicationId));
    setApplicationMessage("Demande refusée. Le motif a été transmis à l’utilisateur.");
  }

  async function grantWalletCredit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const amount = Number(formData.get("amount"));
    const kind = String(formData.get("kind") ?? "");
    const description = String(formData.get("description") ?? "").trim();
    if (!email || !Number.isSafeInteger(amount) || amount <= 0 || amount > 10000000 || !description) {
      setWalletCreditMessage("Vérifiez l’adresse e-mail, le montant (1 à 10 000 000 FCFA) et le motif.");
      return;
    }

    setWalletCreditPending(true);
    setWalletCreditMessage("");
    const requestId = walletCreditRequestId || crypto.randomUUID();
    setWalletCreditRequestId(requestId);
    try {
      const { error } = await createClient().rpc("admin_grant_wallet_credit", {
        p_email: email,
        p_amount_xof: amount,
        p_kind: kind,
        p_description: description,
        p_request_id: requestId,
      });
      if (error) {
        setWalletCreditMessage(`Crédit non confirmé : ${error.message}`);
        return;
      }

      form.reset();
      setWalletCreditRequestId("");
      setWalletCreditMessage(`Crédit de ${formatFCFA(amount)} accordé à ${email}.`);
    } catch (creditError) {
      setWalletCreditMessage(
        `Crédit non confirmé : ${creditError instanceof Error ? creditError.message : "erreur de connexion"}`,
      );
    } finally {
      setWalletCreditPending(false);
    }
  }

  async function setEventStatus(id: string, status: EventStatus) {
    const databaseStatus = status === "Publié" ? "published" : status === "Rejeté" ? "rejected" : "pending";
    const { error } = await createClient().from("events").update({ status: databaseStatus }).eq("id", id);
    if (error) {
      setApplicationMessage(`Impossible de modifier l’événement : ${error.message}`);
      return;
    }
    setEvents((current) => current.filter((event) => event.id !== id));
    setApplicationMessage(status === "Publié" ? "Événement publié." : "Événement rejeté.");
  }

  const toggleUserStatus = (id: string) =>
    setUsers((us) =>
      us.map((u) =>
        u.id === id
          ? { ...u, status: u.status === "Actif" ? "Suspendu" : "Actif" }
          : u
      )
    );

  return (
    <div className="px-4 py-5 pb-28 lg:pb-10 max-w-6xl mx-auto">
      <p className="text-xs text-muted uppercase tracking-widest">Administration</p>
      <h1 className="font-display font-bold text-3xl">
        Panneau <span className="sunset-text">admin</span>
      </h1>

      {/* Aperçu */}
      <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Utilisateurs", value: "—", icon: Users, color: "#f5a524" },
          { label: "Organisateurs", value: "—", icon: Building2, color: "#3498db" },
          { label: "Événements actifs", value: "—", icon: Ticket, color: "#27ae60" },
          { label: "CA ce mois", value: "—", icon: Wallet, color: "#ff6b35" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl bg-ink-2 border border-line/60 p-4">
              <div className="flex items-center gap-2">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                  style={{ backgroundColor: s.color + "22" }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <p className="text-[11px] text-muted uppercase tracking-wide leading-tight">
                  {s.label}
                </p>
              </div>
              <p className="mt-2 font-display font-bold text-xl lg:text-2xl">{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Navigation sections */}
      <div className="mt-6 flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex items-center gap-2 shrink-0 px-4 py-2 rounded-full text-sm font-semibold bg-ink-2 border border-line/60 text-muted hover:text-cream hover:border-amber/50 transition-colors"
            >
              <Icon className="h-4 w-4" />
              <span>{s.label}</span>
            </a>
          );
        })}
      </div>

      {/* Utilisateurs */}
      <section id="utilisateurs" className="mt-8 scroll-mt-4">
        <h2 className="font-display font-bold text-xl">Utilisateurs</h2>
        <div className={`${cardCls} mt-3 overflow-x-auto`}>
          <table className="w-full min-w-[560px]">
            <thead>
              <tr>
                <th className={thCls}>Utilisateur</th>
                <th className={thCls}>Rôle</th>
                <th className={thCls}>Statut</th>
                <th className={thCls}>Inscription</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={5} className={`${tdCls} text-center text-muted`}>Les utilisateurs réels ne sont pas encore connectés à ce panneau.</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id}>
                  <td className={tdCls}>
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-xs text-muted">{u.email}</p>
                  </td>
                  <td className={tdCls}>
                    <Badge
                      text={u.role}
                      cls={
                        u.role === "Admin"
                          ? "bg-ember/15 text-ember border-ember/40"
                          : u.role === "Organisateur"
                            ? "bg-amber/15 text-amber border-amber/40"
                            : "bg-ink-3 text-muted border-line/50"
                      }
                    />
                  </td>
                  <td className={tdCls}>
                    <Badge text={u.status} cls={USER_BADGE[u.status]} />
                  </td>
                  <td className={`${tdCls} text-muted`}>{u.joined}</td>
                  <td className={`${tdCls} text-right`}>
                    <button
                      onClick={() => toggleUserStatus(u.id)}
                      className="text-xs font-semibold text-muted hover:text-cream transition-colors"
                    >
                      {u.status === "Actif" ? "Suspendre" : "Réactiver"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="organisateurs" className="mt-8 scroll-mt-4">
        <h2 className="font-display font-bold text-xl">Organisateurs en attente</h2>
        <div className={`${cardCls} mt-3 space-y-3`}>
          {!isSupabaseConfigured() ? (
            <p className="text-sm text-muted">Configurez Supabase pour gérer les demandes organisateur.</p>
          ) : organizerApplications.length === 0 ? (
            <p className="text-sm text-muted">Aucune demande en attente.</p>
          ) : organizerApplications.map((application) => (
            <article key={application.id} className="border-t border-line/50 pt-4 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{application.organization_name}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {application.applicant_name} · {application.applicant_phone || "Téléphone personnel absent"}
                  </p>
                  <p className="text-sm text-muted">{application.organization_type} · demande du {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(application.created_at))}</p>
                  <p className="mt-2 text-sm">{application.description || "Aucune description fournie."}</p>
                  <p className="mt-2 text-sm text-muted">Contact professionnel : {application.business_email} · {application.business_phone}</p>
                  {application.website && <a href={application.website} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-togogreen underline">Site web</a>}
                  <p className="mt-1 break-all text-xs text-muted">Réseaux : {JSON.stringify(application.social_links)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={reviewingApplication === application.id}
                    onClick={() => void approveApplication(application.id)}
                    className="bg-togogreen px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    Approuver
                  </button>
                  <button
                    disabled={reviewingApplication === application.id}
                    onClick={() => void rejectApplication(application.id)}
                    className="border border-togored px-3 py-2 text-xs font-bold text-togored disabled:opacity-50"
                  >
                    Refuser
                  </button>
                </div>
              </div>
            </article>
          ))}
          {applicationMessage && <p role="status" className="text-sm text-muted">{applicationMessage}</p>}
        </div>
      </section>

      {/* Événements */}
      <section id="evenements" className="mt-8 scroll-mt-4">
        <h2 className="font-display font-bold text-xl">Validation des événements</h2>
        <div className={`${cardCls} mt-3 space-y-3`}>
          {events.length === 0 ? (
            <p className="text-sm text-muted">Aucun événement réel à valider pour le moment.</p>
          ) : events.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 flex-wrap rounded-xl bg-ink-3/60 border border-line/40 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">{e.title}</p>
                <p className="text-xs text-muted">
                  {e.organizer} · {e.date}
                </p>
              </div>
              <Badge text={e.status} cls={EVENT_BADGE[e.status]} />
              {e.status !== "Publié" && (
                <button
                  onClick={() => setEventStatus(e.id, "Publié")}
                  className="px-3 py-1.5 rounded-full text-xs font-bold bg-togogreen text-white"
                >
                  ✓ Publier
                </button>
              )}
              {e.status !== "Rejeté" && (
                <button
                  onClick={() => setEventStatus(e.id, "Rejeté")}
                  className="px-3 py-1.5 rounded-full text-xs font-bold bg-togored/80 text-white"
                >
                  ✕ Rejeter
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Paiements */}
      <section id="paiements" className="mt-8 scroll-mt-4">
        <h2 className="font-display font-bold text-xl">Paiements</h2>
        <div className={`${cardCls} mt-3 overflow-x-auto`}>
          <table className="w-full min-w-[480px]">
            <thead>
              <tr>
                <th className={thCls}>Référence</th>
                <th className={thCls}>Méthode</th>
                <th className={thCls}>Montant</th>
                <th className={thCls}>Statut</th>
                <th className={thCls}>Heure</th>
              </tr>
            </thead>
            <tbody>
              {PAYMENTS.length === 0 && (
                <tr><td colSpan={5} className={`${tdCls} text-center text-muted`}>Aucun paiement réel disponible.</td></tr>
              )}
              {PAYMENTS.map((p) => (
                <tr key={p.id}>
                  <td className={`${tdCls} font-mono text-xs`}>{p.id}</td>
                  <td className={tdCls}>{p.method}</td>
                  <td className={`${tdCls} font-semibold`}>{formatFCFA(p.amount)}</td>
                  <td className={tdCls}>
                    <Badge text={p.status} cls={PAYMENT_BADGE[p.status]} />
                  </td>
                  <td className={`${tdCls} text-muted text-xs`}>{p.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="portefeuille" className="mt-8 scroll-mt-4">
        <h2 className="font-display font-bold text-xl">Crédits Lomé Events</h2>
        <div className={`${cardCls} mt-3`}>
          <p className="mb-4 text-sm leading-6 text-muted">
            Accorder un crédit de remboursement, promotionnel ou commercial. Chaque mouvement est enregistré
            dans l’historique du portefeuille et ne peut pas être modifié depuis le navigateur.
          </p>
          <form onSubmit={(event) => void grantWalletCredit(event)} className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              E-mail du compte
              <input name="email" type="email" required className="mt-1.5 w-full rounded-xl border border-line bg-ink px-3 py-2.5 font-normal focus:border-togogreen focus:outline-none" />
            </label>
            <label className="text-sm font-semibold">
              Montant (FCFA)
              <input name="amount" type="number" min="1" max="10000000" step="1" required className="mt-1.5 w-full rounded-xl border border-line bg-ink px-3 py-2.5 font-normal focus:border-togogreen focus:outline-none" />
            </label>
            <label className="text-sm font-semibold">
              Type de crédit
              <select name="kind" required defaultValue="refund" className="mt-1.5 w-full rounded-xl border border-line bg-ink px-3 py-2.5 font-normal focus:border-togogreen focus:outline-none">
                <option value="refund">Remboursement</option>
                <option value="promotion">Promotion</option>
                <option value="compensation">Geste commercial</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              Motif
              <input name="description" required maxLength={240} className="mt-1.5 w-full rounded-xl border border-line bg-ink px-3 py-2.5 font-normal focus:border-togogreen focus:outline-none" />
            </label>
            <button type="submit" disabled={walletCreditPending || !isSupabaseConfigured()} className="primary-action rounded-full px-5 py-3 text-sm font-bold disabled:opacity-50 sm:col-span-2 sm:justify-self-end">
              {walletCreditPending ? "Enregistrement…" : "Accorder le crédit"}
            </button>
          </form>
          {walletCreditMessage && <p role="status" className="mt-4 text-sm text-muted">{walletCreditMessage}</p>}
        </div>
      </section>

      {/* Catégories */}
      <section id="categories" className="mt-8 scroll-mt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-xl">Catégories</h2>
          <button className="text-xs font-semibold text-amber hover:text-ember transition-colors">
            + Nouvelle catégorie
          </button>
        </div>
        <div className={`${cardCls} mt-3 flex flex-wrap gap-2`}>
          {CATEGORIES.map((c) => {
            const Icon = getIcon(c.emoji);
            return (
              <span
                key={c.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-ink-3 border border-line/50"
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{c.label}</span>
              </span>
            );
          })}
        </div>
      </section>

      {/* Signalements */}
      <section id="signalements" className="mt-8 scroll-mt-4">
        <h2 className="font-display font-bold text-xl">Signalements</h2>
        <div className={`${cardCls} mt-3 space-y-3`}>
          {REPORTS.length === 0 ? (
            <p className="text-sm text-muted">Aucun signalement réel à traiter.</p>
          ) : REPORTS.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 flex-wrap rounded-xl bg-ink-3/60 border border-line/40 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">{r.subject}</p>
                <p className="text-xs text-muted">
                  {r.event} · signalé par {r.reporter}
                </p>
              </div>
              <Badge text={r.status} cls={REPORT_BADGE[r.status]} />
            </div>
          ))}
        </div>
      </section>

      {/* Notifications */}
      <section id="notifications" className="mt-8 scroll-mt-4">
        <h2 className="font-display font-bold text-xl">Notifications</h2>
        <div className={`${cardCls} mt-3`}>
          <p className="text-xs text-muted">
            Envoyez une notification à tous les utilisateurs ou à un segment (favoris d&apos;un
            événement, acheteurs, etc.).
          </p>
          <div className="mt-4 space-y-3">
            <input
              placeholder="Titre de la notification"
              className="w-full rounded-xl bg-ink border border-line/60 px-4 py-2.5 text-sm focus:outline-none focus:border-amber/70"
            />
            <textarea
              rows={3}
              placeholder="Message…"
              className="w-full rounded-xl bg-ink border border-line/60 px-4 py-2.5 text-sm focus:outline-none focus:border-amber/70"
            />
            <div className="flex items-center gap-3 flex-wrap">
              <select
                className="rounded-xl bg-ink border border-line/60 px-3 py-2 text-sm focus:outline-none focus:border-amber/70"
                defaultValue="tous"
              >
                <option value="tous">Tous les utilisateurs</option>
                <option value="favoris">Favoris d&apos;un événement</option>
                <option value="acheteurs">Acheteurs d&apos;un événement</option>
              </select>
              <button
                type="button"
                disabled
                className="px-5 py-2.5 rounded-full font-display font-bold text-sm text-muted bg-ink-3 cursor-not-allowed"
              >
                Envoi non configuré
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
