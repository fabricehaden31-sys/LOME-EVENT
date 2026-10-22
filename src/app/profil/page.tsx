"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CURRENT_USER, NOTIFICATIONS, type AppNotification } from "@/lib/data";
import { getIcon } from "@/lib/icons";
import { getFavorites, getTickets } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  BellRing,
  Building2,
  Heart,
  LogOut,
  MapPin,
  ReceiptText,
  Settings,
  ShieldCheck,
  Ticket,
  UserRoundPen,
  Wallet,
} from "lucide-react";

type ProfileSettings = {
  email_notifications: boolean;
  push_notifications: boolean;
};

const SETTINGS_KEY = "lome-events:profile-settings";
const NOTIFICATIONS_KEY = "lome-events:notifications";
const PROFILE_KEY = "lome-events:profile";

const MENU_GROUPS = [
  {
    title: "Mes activités",
    items: [
      { icon: Ticket, label: "Mes billets", desc: "Vos billets et QR codes", href: "/billets" },
      { icon: Heart, label: "Mes favoris", desc: "Les événements que vous souhaitez suivre", href: "/favoris" },
      { icon: ReceiptText, label: "Historique des achats", desc: "Retrouvez vos billets achetés", href: "/billets" },
      { icon: Wallet, label: "Crédit Lomé Events", desc: "Solde et historique de vos crédits", href: "/portefeuille" },
    ],
  },
  {
    title: "Mon compte",
    items: [
      { icon: BellRing, label: "Notifications", desc: "Alertes, rappels et actualités", href: "/profil#notifications" },
      { icon: Settings, label: "Préférences", desc: "Gérez vos notifications", href: "/profil#parametres" },
      { icon: ShieldCheck, label: "Sécurité", desc: "Modifier votre mot de passe", href: "/profil#securite" },
    ],
  },
];

type ProfileDetails = typeof CURRENT_USER & {
  city: string;
  country: string;
  avatarUrl: string | null;
};

export default function ProfilPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileDetails>({
    ...CURRENT_USER,
    city: "Lomé",
    country: "Togo",
    avatarUrl: null,
  });
  const [settings, setSettings] = useState<ProfileSettings>({
    email_notifications: true,
    push_notifications: true,
  });
  const [notifications, setNotifications] = useState<AppNotification[]>(NOTIFICATIONS);
  const [userId, setUserId] = useState<string | null>(null);
  const [accountRole, setAccountRole] = useState("participant");
  const [organizerApplicationStatus, setOrganizerApplicationStatus] = useState<string | null>(null);
  const [ticketCount, setTicketCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [organizedCount, setOrganizedCount] = useState(0);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [status, setStatus] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const unread = notifications.filter((notification) => !notification.read).length;

  useEffect(() => {
    const loadActivityCounts = () => {
      setTicketCount(getTickets().length);
      setFavoriteCount(getFavorites().length);
    };
    queueMicrotask(loadActivityCounts);
    window.addEventListener("lome-store-change", loadActivityCounts);
    return () => window.removeEventListener("lome-store-change", loadActivityCounts);
  }, []);

  useEffect(() => {
    let active = true;

    if (!isSupabaseConfigured()) {
      try {
        const savedSettings = window.localStorage.getItem(SETTINGS_KEY);
        const savedNotifications = window.localStorage.getItem(NOTIFICATIONS_KEY);
        const savedProfile = window.localStorage.getItem(PROFILE_KEY);
        if (savedProfile) {
          void Promise.resolve().then(() => {
            if (active) {
              const parsedProfile = JSON.parse(savedProfile) as Partial<ProfileDetails>;
              setProfile((current) => ({
                ...current,
                ...parsedProfile,
                initials: parsedProfile.name
                  ? parsedProfile.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()
                  : current.initials,
              }));
            }
          });
        }
        if (savedSettings) {
          void Promise.resolve().then(() => {
            if (active) {
              const parsedSettings = JSON.parse(savedSettings) as Partial<ProfileSettings>;
              setSettings((current) => ({ ...current, ...parsedSettings }));
            }
          });
        }
        if (savedNotifications) {
          void Promise.resolve().then(() => {
            if (active) setNotifications(JSON.parse(savedNotifications) as AppNotification[]);
          });
        }
      } catch {
        window.localStorage.removeItem(SETTINGS_KEY);
        window.localStorage.removeItem(NOTIFICATIONS_KEY);
      }
      return () => {
        active = false;
      };
    }

    async function loadAccount() {
      const supabase = createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !user) {
        router.replace("/connexion");
        return;
      }

      setUserId(user.id);
      const [profileResult, settingsResult, notificationsResult] = await Promise.all([
        supabase.from("profiles").select("display_name, phone, role, city, country, avatar_url").eq("id", user.id).maybeSingle(),
        supabase.from("user_settings").select("email_notifications, push_notifications").eq("user_id", user.id).maybeSingle(),
        supabase.from("notifications").select("id, title, body, read_at, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);

      if (!active) return;
      if (profileResult.error) {
        setStatus(`Impossible de charger le profil : ${profileResult.error.message}`);
      }
      if (profileResult.data) {
        const name = profileResult.data.display_name || CURRENT_USER.name;
        setAccountRole(profileResult.data.role);
        setProfile({
          ...CURRENT_USER,
          id: user.id,
          name,
          email: user.email ?? CURRENT_USER.email,
          phone: profileResult.data.phone ?? "",
          city: profileResult.data.city || "",
          country: profileResult.data.country || "",
          avatarUrl: profileResult.data.avatar_url,
          initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
        });
      }
      const { data: application, error: applicationError } = await supabase
        .from("organizer_applications")
        .select("status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (applicationError) {
        setStatus(`Impossible de vérifier votre demande organisateur : ${applicationError.message}`);
      }
      setOrganizerApplicationStatus(application?.status ?? null);
      if (profileResult.data?.role === "organizer") {
        const { count, error: eventCountError } = await supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("organizer_id", user.id);
        if (!active) return;
        if (eventCountError) {
          setStatus(`Impossible de charger le nombre d’événements organisés : ${eventCountError.message}`);
        } else {
          setOrganizedCount(count ?? 0);
        }
      }
      if (settingsResult.data) {
        setSettings({
          email_notifications: settingsResult.data.email_notifications,
          push_notifications: settingsResult.data.push_notifications,
        });
      }
      if (notificationsResult.data) {
        setNotifications(notificationsResult.data.map((notification) => ({
          id: notification.id,
          title: notification.title,
          body: notification.body,
          read: Boolean(notification.read_at),
          icon: notification.title.toLowerCase().includes("billet") ? "ticket" : "bell",
          time: new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(notification.created_at)),
        })));
      }
    }

    void loadAccount();
    return () => {
      active = false;
    };
  }, [router]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const country = String(formData.get("country") ?? "").trim();
    if (!name) {
      setStatus("Renseignez votre nom.");
      return;
    }

    setSavingProfile(true);
    setStatus("");
    if (userId && isSupabaseConfigured()) {
      const { error } = await createClient()
        .from("profiles")
        .update({ display_name: name, phone, city, country })
        .eq("id", userId);
      if (error) {
        setStatus(`Enregistrement impossible : ${error.message}`);
        setSavingProfile(false);
        return;
      }
    } else {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ name, phone, city, country }));
    }

    setProfile((current) => ({
      ...current,
      name,
      phone,
      city,
      country,
      initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    }));
    setEditingProfile(false);
    setSavingProfile(false);
    setStatus(userId ? "Profil mis à jour." : "Profil enregistré sur cet appareil.");
  }

  async function updatePreference(key: "email_notifications" | "push_notifications", value: boolean) {
    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));

    if (userId && isSupabaseConfigured()) {
      const update = key === "email_notifications"
        ? { email_notifications: value }
        : { push_notifications: value };
      const { error } = await createClient().from("user_settings").update(update).eq("user_id", userId);
      setStatus(error ? error.message : "Préférence enregistrée sur votre compte.");
    } else {
      setStatus("Préférence enregistrée sur cet appareil.");
    }
  }

  async function markRead(notification: AppNotification) {
    if (notification.read) return;
    const nextNotifications = notifications.map((item) =>
      item.id === notification.id ? { ...item, read: true } : item,
    );
    setNotifications(nextNotifications);
    window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(nextNotifications));

    if (userId && isSupabaseConfigured()) {
      const { error } = await createClient()
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notification.id)
        .eq("user_id", userId);
      setStatus(error ? error.message : "Notification marquée comme lue.");
    }
  }

  async function markAllRead() {
    const unreadNotifications = notifications.filter((notification) => !notification.read);
    if (unreadNotifications.length === 0) return;
    const readAt = new Date().toISOString();
    const nextNotifications = notifications.map((notification) => ({ ...notification, read: true }));
    setNotifications(nextNotifications);
    window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(nextNotifications));

    if (userId && isSupabaseConfigured()) {
      const ids = unreadNotifications.map((notification) => notification.id);
      const { error } = await createClient()
        .from("notifications")
        .update({ read_at: readAt })
        .in("id", ids)
        .eq("user_id", userId);
      setStatus(error ? error.message : "Toutes les notifications sont marquées comme lues.");
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");
    if (password !== confirmation) {
      setStatus("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (!userId || !isSupabaseConfigured()) {
      setStatus("Connectez-vous à un compte Supabase pour modifier votre mot de passe.");
      return;
    }

    const { error } = await createClient().auth.updateUser({ password });
    setStatus(error ? error.message : "Mot de passe modifié.");
    if (!error) form.reset();
  }

  async function signOut() {
    if (!isSupabaseConfigured()) {
      setStatus("Mode démonstration : aucun compte connecté à déconnecter.");
      return;
    }

    setSigningOut(true);
    setStatus("");
    try {
      const { error } = await createClient().auth.signOut();
      if (error) {
        setStatus(`Déconnexion impossible : ${error.message}`);
        setSigningOut(false);
        return;
      }
      router.replace("/connexion");
      router.refresh();
    } catch {
      setStatus("Impossible de contacter le service de connexion. Réessayez.");
      setSigningOut(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-28 lg:pb-10">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-togogreen">Mon compte</p>
      <h1 className="mt-1 font-display text-3xl font-bold">Mon profil</h1>

      <section className="mt-5 overflow-hidden rounded-3xl border border-line/60 bg-ink-2">
        <div className="flex flex-wrap items-center gap-4 bg-gradient-to-br from-ink-2 via-ink-2 to-togogreen/10 p-5 sm:p-6">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-togogreen/50 bg-ink-3 font-display text-2xl font-bold text-togogreen">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : profile.initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl font-bold leading-tight">{profile.name}</p>
            <p className="mt-1 truncate text-sm text-muted">{profile.email}</p>
            {(profile.city || profile.country) && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-togogreen" />
                {[profile.city, profile.country].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingProfile((current) => !current);
              setStatus("");
            }}
            className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold transition hover:border-togogreen hover:text-togogreen"
          >
            <UserRoundPen className="h-4 w-4" />
            {editingProfile ? "Annuler" : "Modifier le profil"}
          </button>
        </div>

        {editingProfile && (
          <form onSubmit={saveProfile} className="grid gap-4 border-t border-line/60 p-5 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Nom complet
              <input name="name" required maxLength={120} defaultValue={profile.name} className="mt-1.5 w-full rounded-xl border border-line bg-ink px-3 py-2.5 font-normal focus:border-togogreen focus:outline-none" />
            </label>
            <label className="text-sm font-semibold">
              Téléphone
              <input name="phone" type="tel" defaultValue={profile.phone} className="mt-1.5 w-full rounded-xl border border-line bg-ink px-3 py-2.5 font-normal focus:border-togogreen focus:outline-none" />
            </label>
            <label className="text-sm font-semibold">
              Ville
              <input name="city" maxLength={100} defaultValue={profile.city} className="mt-1.5 w-full rounded-xl border border-line bg-ink px-3 py-2.5 font-normal focus:border-togogreen focus:outline-none" />
            </label>
            <label className="text-sm font-semibold">
              Pays
              <input name="country" maxLength={100} defaultValue={profile.country} className="mt-1.5 w-full rounded-xl border border-line bg-ink px-3 py-2.5 font-normal focus:border-togogreen focus:outline-none" />
            </label>
            <button type="submit" disabled={savingProfile} className="primary-action rounded-full px-5 py-3 text-sm font-bold disabled:opacity-50 sm:col-span-2 sm:justify-self-end">
              {savingProfile ? "Enregistrement…" : "Enregistrer le profil"}
            </button>
          </form>
        )}

        <div className="grid grid-cols-3 divide-x divide-line/60 border-t border-line/60 px-2 py-4 text-center">
          <div>
            <p className="font-display text-2xl font-bold text-amber">{ticketCount}</p>
            <p className="text-[11px] uppercase tracking-wide text-muted">Billets</p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-ember">{favoriteCount}</p>
            <p className="text-[11px] uppercase tracking-wide text-muted">Favoris</p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-togogreen">{organizedCount}</p>
            <p className="text-[11px] uppercase tracking-wide text-muted">Organisés</p>
          </div>
        </div>
      </section>

      <div className="mt-7 space-y-6">
        {MENU_GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="mb-3 font-display text-xl font-bold">{group.title}</h2>
            <div className="overflow-hidden rounded-3xl border border-line/60 bg-ink-2">
              {group.items.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-ink-3/60 ${index > 0 ? "border-t border-line/50" : ""}`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-3 text-togogreen">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="block truncate text-xs text-muted">{item.desc}</span>
                    </span>
                    {item.label === "Notifications" && unread > 0 && (
                      <span className="shrink-0 rounded-full bg-ember px-2 py-0.5 text-[11px] font-bold text-white">
                        {unread}
                      </span>
                    )}
                    <span className="shrink-0 text-muted">›</span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        <section className="rounded-3xl border border-togogreen/30 bg-gradient-to-br from-togogreen/10 via-ink-2 to-ink-2 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-togogreen/15 text-togogreen">
              <Building2 className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-togogreen">Espace organisateur</p>
              <h2 className="mt-1 font-display text-xl font-bold">
                {accountRole === "organizer" ? "Votre espace pro est prêt" : organizerApplicationStatus === "pending" ? "Demande en cours de validation" : "Vous organisez des événements ?"}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                {accountRole === "organizer"
                  ? "Gérez vos événements, votre équipe, vos ventes et le contrôle des billets."
                  : organizerApplicationStatus === "pending"
                    ? "Votre demande est en cours d’examen. Vous pourrez accéder à l’espace pro après validation."
                    : "Créez votre espace organisateur pour publier des événements et suivre vos ventes."}
              </p>
              <Link
                href="/organisateur"
                className="primary-action mt-4 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold"
              >
                {accountRole === "organizer" ? "Accéder à mon espace pro" : organizerApplicationStatus === "pending" ? "Voir ma demande" : "Devenir organisateur"}
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-line/60 bg-ink-2">
        <button type="button" onClick={signOut} disabled={signingOut} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-ink-3/60 transition-colors text-left disabled:cursor-wait disabled:opacity-60">
          <span className="flex h-10 w-10 items-center justify-center shrink-0 rounded-xl bg-ink-3 text-togored">
            <LogOut className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-sm text-togored">{signingOut ? "Déconnexion…" : "Déconnexion"}</span>
            <span className="block text-xs text-muted">{signingOut ? "Fermeture de la session" : "Se déconnecter du compte"}</span>
          </span>
          <span className="text-muted shrink-0">›</span>
        </button>
      </div>

      {/* Notifications */}
      <div className="mt-8 flex items-center justify-between gap-3 scroll-mt-24" id="notifications">
        <h2 className="font-display font-bold text-xl">Notifications <span className="sunset-text">récentes</span></h2>
        {unread > 0 && <button type="button" onClick={() => void markAllRead()} className="text-xs font-semibold text-togogreen hover:underline">Tout lire</button>}
      </div>
      <div className="mt-4 rounded-3xl bg-ink-2 border border-line/60 divide-y divide-line/50 overflow-hidden">
        {notifications.map((n) => {
          const Icon = getIcon(n.icon);
          return (
            <div
              key={n.id}
              className={`flex items-start gap-3 px-5 py-4 ${n.read ? "opacity-60" : ""}`}
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-3 text-amber">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm leading-snug">{n.title}</p>
                <p className="text-xs text-muted mt-0.5">{n.body}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] text-muted whitespace-nowrap">{n.time}</p>
                {!n.read && <button type="button" onClick={() => void markRead(n)} className="mt-1 text-[11px] font-semibold text-togogreen hover:underline">Marquer comme lue</button>}
              </div>
            </div>
          );
        })}
      </div>

      <section id="parametres" className="mt-8 scroll-mt-24 rounded-3xl border border-line/60 bg-ink-2 p-5">
        <h2 className="font-display text-xl font-bold">Paramètres</h2>
        <p className="mt-1 text-sm text-muted">Préférences de notification</p>
        <div className="mt-4 divide-y divide-line/50">
          {([
            ["email_notifications", "Alertes par e-mail", "Billets, changements et rappels"],
            ["push_notifications", "Notifications de l'application", "Nouveaux événements et favoris"],
          ] as const).map(([key, label, description]) => (
            <label key={key} className="flex cursor-pointer items-center gap-4 py-4">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs text-muted">{description}</span>
              </span>
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={(event) => void updatePreference(key, event.target.checked)}
                className="h-5 w-5 accent-[#28734d]"
              />
            </label>
          ))}
        </div>
      </section>

      <section id="securite" className="mt-5 scroll-mt-24 rounded-3xl border border-line/60 bg-ink-2 p-5">
        <h2 className="font-display text-xl font-bold">Sécurité</h2>
        <p className="mt-1 text-sm text-muted">Mettez à jour le mot de passe de votre compte.</p>
        <form onSubmit={changePassword} className="mt-4 space-y-3">
          <label className="block text-sm font-semibold">
            Nouveau mot de passe
            <input name="password" type="password" minLength={8} autoComplete="new-password" required className="mt-1.5 w-full rounded-sm border border-line bg-ink px-3 py-2.5 font-normal focus:border-togogreen focus:outline-none" />
          </label>
          <label className="block text-sm font-semibold">
            Confirmer le mot de passe
            <input name="confirmation" type="password" minLength={8} autoComplete="new-password" required className="mt-1.5 w-full rounded-sm border border-line bg-ink px-3 py-2.5 font-normal focus:border-togogreen focus:outline-none" />
          </label>
          <button className="primary-action rounded-sm px-4 py-2.5 text-sm font-bold">Modifier le mot de passe</button>
        </form>
      </section>
      {status && <p role="status" className="mt-4 text-sm text-togogreen">{status}</p>}
    </div>
  );
}
