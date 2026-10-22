"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CATEGORIES,
} from "@/lib/data";
import { formatFCFA } from "@/lib/utils";
import {
  BarChart3,
  Camera,
  CheckCheck,
  CreditCard,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Sparkles,
  Ticket,
  Upload,
  Users,
  Wallet,
  X,
} from "lucide-react";

export const LOME_DISTRICTS = [
  { id: "Centre-ville", name: "Centre-ville / Déckon", lat: 6.1319, lng: 1.2228 },
  { id: "Agoè-Nyivé", name: "Agoè-Nyivé (2 Lions / Cacaveli)", lat: 6.2089, lng: 1.2185 },
  { id: "Bè", name: "Bè / Plage de Lomé", lat: 6.1350, lng: 1.2450 },
  { id: "Kégué", name: "Kégué / Stade", lat: 6.1772, lng: 1.2589 },
  { id: "Kodjoviakopé", name: "Kodjoviakopé (Frontière)", lat: 6.1200, lng: 1.2100 },
  { id: "Tokoin", name: "Tokoin (Trésor / Doumasséssé)", lat: 6.1450, lng: 1.2280 },
  { id: "Adidogomé", name: "Adidogomé (Campus Sud)", lat: 6.1712, lng: 1.1633 },
  { id: "Nyékonakpoè", name: "Nyékonakpoè", lat: 6.1320, lng: 1.2050 },
  { id: "Hédzranawoé", name: "Hédzranawoé / Aéroport", lat: 6.1667, lng: 1.2500 },
  { id: "Baguida", name: "Baguida / Avépozo (Plage)", lat: 6.1600, lng: 1.3300 },
  { id: "Totsi", name: "Totsi / Avédji", lat: 6.1850, lng: 1.1950 },
];

const POSTER_PRESETS = [
  { name: "Concert Afrobeat", url: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&auto=format&fit=crop&q=80" },
  { name: "Soirée Club VIP", url: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&auto=format&fit=crop&q=80" },
  { name: "Festival Plage", url: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&auto=format&fit=crop&q=80" },
  { name: "Conférence Tech", url: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop&q=80" },
];

const STATS = [
  { label: "Billets vendus", icon: Ticket, color: "#f5a524" },
  { label: "Revenus", icon: Wallet, color: "#27ae60" },
  { label: "Participants", icon: Users, color: "#3498db" },
  { label: "Billets disponibles", icon: BarChart3, color: "#ff6b35" },
];

const DEFAULT_TIERS = [
  { name: "Standard", price: 5000, quota: 200 },
  { name: "VIP", price: 15000, quota: 100 },
  { name: "Premium", price: 30000, quota: 50 },
  { name: "VVIP", price: 50000, quota: 20 },
];

const inputCls =
  "w-full rounded-xl bg-ink border border-line/60 px-4 py-2.5 text-sm text-cream placeholder:text-muted/60 focus:outline-none focus:border-amber/70";

export default function OrganisateurPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [access, setAccess] = useState<{
    loading: boolean;
    role: string;
    userId: string;
    name: string;
    phone: string;
    email: string;
    application: { status: string; rejection_reason: string | null } | null;
    error: string;
  }>({ loading: true, role: "", userId: "", name: "", phone: "", email: "", application: null, error: "" });
  const [applying, setApplying] = useState(false);
  const [tab, setTab] = useState<"dashboard" | "creer" | "equipe">("dashboard");
  const [team, setTeam] = useState<Array<{
    id: string;
    member_user_id: string | null;
    member_email: string;
    role: string;
    permissions: unknown;
    status: string;
  }>>([]);
  const [scanActivity, setScanActivity] = useState<Array<{
    id: string;
    event_id: string;
    result: string;
    scanned_at: string;
    scanned_by: string;
  }>>([]);
  const [teamMessage, setTeamMessage] = useState("");
  const [teamPending, setTeamPending] = useState(false);
  const [tiers, setTiers] = useState(DEFAULT_TIERS);
  const [program, setProgram] = useState([{ time: "", label: "" }]);
  const [submitted, setSubmitted] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftVenue, setDraftVenue] = useState("");
  const [draftAddress, setDraftAddress] = useState("");
  const [draftDistrict, setDraftDistrict] = useState("Centre-ville");
  const [draftLocation, setDraftLocation] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [draftTime, setDraftTime] = useState("");
  const [draftCategory, setDraftCategory] = useState("concerts");
  const [draftDescription, setDraftDescription] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [posterError, setPosterError] = useState("");
  const [eventPending, setEventPending] = useState(false);
  const [eventMessage, setEventMessage] = useState("");
  const [createdEvents, setCreatedEvents] = useState<Array<{
    id: string;
    name: string;
    status: "Brouillon" | "Vérification" | "Publié" | "Bientôt";
    date: string;
    sales: string;
    revenue: string;
    category: string;
  }>>([]);

  useEffect(() => {
    let active = true;

    async function loadOrganizerAccess() {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !user) {
        router.replace("/connexion");
        return;
      }

      const [{ data: profile }, { data: application, error: applicationError }] = await Promise.all([
        supabase.from("profiles").select("role, display_name, phone").eq("id", user.id).maybeSingle(),
        supabase.from("organizer_applications").select("status, rejection_reason")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (!active) return;
      if (profile?.role === "admin") {
        router.replace("/admin");
        return;
      }

      setAccess({
        loading: false,
        role: profile?.role ?? "participant",
        userId: user.id,
        name: profile?.display_name ?? "",
        phone: profile?.phone ?? "",
        email: user.email ?? "",
        application,
        error: applicationError?.message ?? "",
      });
    }

    void loadOrganizerAccess();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (access.role !== "organizer" || !access.userId) return;
    let active = true;

    async function loadTeam() {
      const supabase = createClient();
      const [{ data: members, error: memberError }, { data: activity, error: activityError }] = await Promise.all([
        supabase.from("organizer_members")
          .select("id, member_user_id, member_email, role, permissions, status")
          .eq("owner_user_id", access.userId)
          .order("created_at", { ascending: true }),
        supabase.from("ticket_scan_logs")
          .select("id, event_id, result, scanned_at, scanned_by")
          .order("scanned_at", { ascending: false })
          .limit(30),
      ]);
      if (!active) return;
      if (memberError) setTeamMessage(memberError.message);
      else setTeam(members ?? []);
      if (activityError) setTeamMessage(activityError.message);
      else setScanActivity(activity ?? []);
    }

    void loadTeam();
    return () => {
      active = false;
    };
  }, [access.role, access.userId]);

  useEffect(() => {
    if (access.role !== "organizer" || !access.userId) return;
    let active = true;

    async function loadOrganizerEvents() {
      const { data, error } = await createClient()
        .from("events")
        .select("id, title, starts_at, status, category_id")
        .eq("organizer_id", access.userId)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        setEventMessage(`Impossible de charger vos événements : ${error.message}`);
        return;
      }
      setCreatedEvents((data ?? []).map((event) => ({
        id: event.id,
        name: event.title,
        status: event.status === "published" ? "Publié" : event.status === "draft" ? "Brouillon" : "Vérification",
        date: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(event.starts_at)),
        sales: "0 / 0",
        revenue: "0 FCFA",
        category: CATEGORIES.find((category) => category.id === event.category_id)?.label ?? "Autre",
      })));
    }

    void loadOrganizerEvents();
    return () => { active = false; };
  }, [access.role, access.userId]);

  async function inviteTeamMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTeamPending(true);
    setTeamMessage("");
    const form = event.currentTarget;
    const values = new FormData(form);
    const role = String(values.get("team_role") ?? "scanner");
    const permissions = role === "staff" ? {
      scan: values.get("permission_scan") === "on",
      sales: values.get("permission_sales") === "on",
      stats: values.get("permission_stats") === "on",
    } : {};
    const supabase = createClient();
    const { data: memberId, error } = await supabase.rpc("manage_organizer_member", {
      p_email: String(values.get("member_email") ?? "").trim(),
      p_role: role,
      p_permissions: permissions,
    });
    if (error) {
      setTeamMessage(error.message);
      setTeamPending(false);
      return;
    }
    const { data: member, error: loadError } = await supabase.from("organizer_members")
      .select("id, member_user_id, member_email, role, permissions, status")
      .eq("id", memberId)
      .single();
    setTeamPending(false);
    if (loadError) {
      setTeamMessage(loadError.message);
      return;
    }
    setTeam((current) => [...current.filter((item) => item.id !== member.id), member]);
    setTeamMessage("Le membre a été ajouté à l’équipe. Il peut se connecter avec son propre compte.");
    form.reset();
  }

  async function updateTeamMemberStatus(memberId: string, status: "active" | "disabled") {
    setTeamPending(true);
    const { error } = await createClient().rpc("set_organizer_member_status", {
      p_member_id: memberId,
      p_status: status,
    });
    setTeamPending(false);
    if (error) {
      setTeamMessage(error.message);
      return;
    }
    setTeam((current) => current.map((member) => member.id === memberId ? { ...member, status } : member));
    setTeamMessage(status === "disabled" ? "Accès du membre désactivé." : "Accès du membre réactivé.");
  }

  async function removeTeamMember(memberId: string) {
    if (!window.confirm("Retirer définitivement ce membre de l’équipe ?")) return;
    setTeamPending(true);
    const { error } = await createClient().rpc("remove_organizer_member", { p_member_id: memberId });
    setTeamPending(false);
    if (error) {
      setTeamMessage(error.message);
      return;
    }
    setTeam((current) => current.filter((member) => member.id !== memberId));
    setTeamMessage("Membre retiré de l’équipe.");
  }

  async function submitOrganizerApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplying(true);
    const values = new FormData(event.currentTarget);
    const socialLinks = {
      instagram: String(values.get("instagram") ?? "").trim(),
      facebook: String(values.get("facebook") ?? "").trim(),
      tiktok: String(values.get("tiktok") ?? "").trim(),
    };
    const { data, error } = await createClient().from("organizer_applications").insert({
      user_id: access.userId,
      organization_name: String(values.get("organization_name") ?? "").trim(),
      organization_type: String(values.get("organization_type") ?? "other"),
      description: String(values.get("description") ?? "").trim(),
      business_phone: String(values.get("business_phone") ?? "").trim(),
      business_email: String(values.get("business_email") ?? "").trim(),
      website: String(values.get("website") ?? "").trim() || null,
      social_links: socialLinks,
    }).select("status, rejection_reason").single();
    setApplying(false);
    if (error) {
      setAccess((current) => ({ ...current, error: error.message }));
      return;
    }
    setAccess((current) => ({ ...current, application: data, error: "" }));
  }

  const updateTier = (i: number, patch: Partial<(typeof tiers)[number]>) =>
    setTiers((t) => t.map((tier, idx) => (idx === i ? { ...tier, ...patch } : tier)));

  const updateStep = (i: number, patch: Partial<(typeof program)[number]>) =>
    setProgram((p) => p.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  async function handlePosterFile(file: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPosterError("Veuillez sélectionner un fichier image valide (JPG, PNG, WEBP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPosterError("L'image ne doit pas dépasser 5 Mo.");
      return;
    }
    setPosterError("");
    const localUrl = URL.createObjectURL(file);
    setPosterPreview(localUrl);

    setUploadingPoster(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `events/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;

      const { data, error } = await supabase.storage.from("posters").upload(filePath, file, {
        upsert: true,
        contentType: file.type,
      });

      if (error || !data) {
        // Fallback: convert to base64 Data URL so it is directly stored in poster_url
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            setPosterUrl(reader.result);
          }
        };
        reader.readAsDataURL(file);
      } else {
        const { data: pubData } = supabase.storage.from("posters").getPublicUrl(data.path);
        setPosterUrl(pubData.publicUrl);
      }
    } catch {
      // Fallback to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setPosterUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingPoster(false);
    }
  }

  async function saveCreatedEvent(status: "draft" | "pending") {
    setEventPending(true);
    setEventMessage("");
    const effectiveVenue = draftVenue.trim() || draftLocation.trim();
    const effectiveAddress = draftAddress.trim() || effectiveVenue;
    const effectiveDistrict = draftDistrict.trim() || "Centre-ville";
    const effectivePoster = posterUrl || posterPreview || null;

    if (!effectiveVenue) {
      setEventPending(false);
      setEventMessage("Veuillez renseigner le nom du lieu de l'événement.");
      return false;
    }

    const startsAt = new Date(`${draftDate}T${draftTime || "19:00"}:00+00:00`);
    const ticketTypes = tiers.map((tier) => ({
      name: tier.name.trim(),
      price_xof: Math.round(tier.price),
      quota: Math.round(tier.quota),
      perks: [],
    }));
    const { data, error } = await createClient().rpc("create_organizer_event", {
      p_status: status,
      p_event: {
        title: draftTitle.trim(),
        description: draftDescription.trim(),
        category_id: draftCategory,
        starts_at: startsAt.toISOString(),
        venue: effectiveVenue,
        address: effectiveAddress,
        district: effectiveDistrict,
        poster_url: effectivePoster,
        program: program.filter((step) => step.time && step.label.trim()),
      },
      p_ticket_types: ticketTypes,
    });
    setEventPending(false);
    if (error) {
      setEventMessage(`Événement non enregistré : ${error.message}`);
      return false;
    }

    const categoryLabel = CATEGORIES.find((category) => category.id === draftCategory)?.label ?? "Autre";
    setCreatedEvents((current) => [{
      id: data,
      name: draftTitle.trim(),
      status: status === "draft" ? "Brouillon" : "Vérification",
      date: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(startsAt),
      sales: `0 / ${ticketTypes.reduce((total, ticket) => total + ticket.quota, 0)}`,
      revenue: "0 FCFA",
      category: categoryLabel,
    }, ...current]);
    setEventMessage(status === "draft" ? "Brouillon enregistré." : "Événement envoyé à l’équipe pour validation.");
    return true;
  }

  if (access.loading) {
    return <main className="mx-auto max-w-2xl px-4 py-16 text-muted">Vérification de votre accès…</main>;
  }

  if (access.role !== "organizer") {
    const applicationPending = access.application?.status === "pending";
    const journey = [
      { title: "1. Profil pro", text: "Indiquez votre activité, votre contact et votre organisation." },
      { title: "2. Vérification", text: "Notre équipe confirme la légitimité du compte et de l’événement." },
      { title: "3. Publier", text: "Créez des événements, fixez vos tarifs et suivez vos ventes en temps réel." },
    ];

    return (
      <main className="mx-auto max-w-5xl px-4 py-8 pb-28 lg:py-12">
        <div className="overflow-hidden rounded-[28px] border border-line bg-ink-2 shadow-glow">
          <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[1.2fr_0.8fr] lg:p-8 xl:p-10">
            <section>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-togogreen">Espace organisateur</p>
              <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-cream sm:text-5xl">
                Publiez vos événements à Lomé sans friction.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
                Gérez les billets, suivez les ventes et donnez à vos publics une expérience fluide depuis un seul espace dédié.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {journey.map((step) => (
                  <div key={step.title} className="rounded-2xl border border-line bg-ink p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-togogreen">{step.title}</p>
                    <p className="mt-2 text-sm leading-5 text-muted">{step.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-muted">
                <span className="rounded-full border border-line bg-ink px-3 py-1.5">Validation rapide</span>
                <span className="rounded-full border border-line bg-ink px-3 py-1.5">Dashboard de ventes</span>
                <span className="rounded-full border border-line bg-ink px-3 py-1.5">Scanner d’entrée</span>
              </div>
            </section>

            <aside className="rounded-[24px] border border-line bg-ink p-5 sm:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber">Statut</p>
              <div className="mt-4 rounded-2xl border border-line bg-ink-2 p-4">
                <p className="text-sm text-muted">Compte actuel</p>
                <p className="mt-2 font-display text-2xl font-bold text-cream">
                  {applicationPending ? "Demande en cours" : "Participant"}
                </p>
                <p className="mt-2 text-sm text-muted">
                  {applicationPending
                    ? "Votre demande est en attente de vérification. Vous recevrez un accès dès validation."
                    : "Complétez le formulaire ci-dessous pour demander l’accès organisateur."}
                </p>
              </div>
              <div className="mt-5 space-y-3 text-sm text-muted">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-2 px-3 py-2.5">
                  <span>Temps de vérification</span>
                  <strong className="font-semibold text-cream">24h</strong>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-2 px-3 py-2.5">
                  <span>Création d’événements</span>
                  <strong className="font-semibold text-cream">Illimitée</strong>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-2 px-3 py-2.5">
                  <span>Suivi des ventes</span>
                  <strong className="font-semibold text-cream">Temps réel</strong>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {applicationPending ? (
          <section className="mt-8 rounded-[24px] border border-gold/60 bg-ink-2 p-6">
            <h2 className="font-display text-2xl font-bold text-cream">Demande en cours d’examen</h2>
            <p className="mt-2 text-muted">
              Votre dossier a bien été reçu. L’équipe Lomé Events vérifie actuellement votre profil, votre organisation et vos informations commerciales.
            </p>
            <p className="mt-4 inline-flex items-center rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-sm font-semibold text-gold">
              Statut : en attente
            </p>
          </section>
        ) : (
          <form onSubmit={submitOrganizerApplication} className="mt-8 space-y-6 rounded-[24px] border border-line bg-ink-2 p-5 sm:p-6 lg:p-7">
            {access.application?.status === "rejected" && (
              <div className="border-l-4 border-togored bg-ink p-4" role="status">
                <p className="font-semibold text-togored">Demande précédente refusée</p>
                {access.application.rejection_reason && <p className="mt-1 text-sm text-muted">Motif : {access.application.rejection_reason}</p>}
                <p className="mt-2 text-sm text-muted">Vous pouvez corriger les informations et envoyer une nouvelle demande.</p>
              </div>
            )}

            <section className="border-b border-line pb-5">
              <h2 className="font-display text-2xl font-bold text-cream">Vos coordonnées</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-cream">Nom complet
                  <input value={access.name} readOnly className={`${inputCls} mt-1.5`} />
                </label>
                <label className="text-sm font-semibold text-cream">E-mail du compte
                  <input value={access.email} readOnly className={`${inputCls} mt-1.5`} />
                </label>
                <label className="text-sm font-semibold text-cream">Téléphone personnel
                  <input value={access.phone} readOnly className={`${inputCls} mt-1.5`} />
                </label>
              </div>
            </section>

            <section className="border-b border-line pb-5">
              <h2 className="font-display text-2xl font-bold text-cream">Votre organisation</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-cream">Nom de l’organisation
                  <input name="organization_name" required maxLength={120} className={`${inputCls} mt-1.5`} />
                </label>
                <label className="text-sm font-semibold text-cream">Type d’organisation
                  <select name="organization_type" required defaultValue="event_company" className={`${inputCls} mt-1.5`}>
                    <option value="event_company">Organisation événementielle</option>
                    <option value="business">Entreprise</option>
                    <option value="association">Association</option>
                    <option value="artist">Artiste / groupe</option>
                    <option value="club">Club</option>
                    <option value="venue">Établissement</option>
                    <option value="independent">Indépendant</option>
                    <option value="other">Autre</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-cream sm:col-span-2">Description
                  <textarea name="description" rows={4} maxLength={2000} className={`${inputCls} mt-1.5`} />
                </label>
                <label className="text-sm font-semibold text-cream">Téléphone professionnel
                  <input name="business_phone" type="tel" required defaultValue={access.phone} className={`${inputCls} mt-1.5`} />
                </label>
                <label className="text-sm font-semibold text-cream">E-mail professionnel
                  <input name="business_email" type="email" required defaultValue={access.email} className={`${inputCls} mt-1.5`} />
                </label>
                <label className="text-sm font-semibold text-cream sm:col-span-2">Site web (facultatif)
                  <input name="website" type="url" placeholder="https://" className={`${inputCls} mt-1.5`} />
                </label>
              </div>
            </section>

            <section className="border-b border-line pb-5">
              <h2 className="font-display text-2xl font-bold text-cream">Réseaux sociaux</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-semibold text-cream">Instagram
                  <input name="instagram" className={`${inputCls} mt-1.5`} />
                </label>
                <label className="text-sm font-semibold text-cream">Facebook
                  <input name="facebook" className={`${inputCls} mt-1.5`} />
                </label>
                <label className="text-sm font-semibold text-cream">TikTok
                  <input name="tiktok" className={`${inputCls} mt-1.5`} />
                </label>
              </div>
            </section>

            <p className="text-sm text-muted">
              Votre compte reste participant pendant la vérification. Une pièce d’identité ou des informations de paiement pourront être demandées plus tard selon les besoins.
            </p>
            {access.error && <p role="alert" className="text-sm text-togored">{access.error}</p>}
            <button disabled={applying} className="w-full rounded-xl bg-togogreen px-5 py-3 font-bold text-white transition-opacity hover:opacity-95 disabled:opacity-60">
              {applying ? "Envoi…" : "Envoyer ma demande"}
            </button>
          </form>
        )}

        {applicationPending && access.error && <p role="alert" className="mt-4 text-sm text-togored">{access.error}</p>}
      </main>
    );
  }

  return (
    <div className="px-4 py-5 pb-28 lg:pb-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-muted uppercase tracking-widest">Espace organisateur</p>
          <h1 className="font-display font-bold text-3xl">
            ORN <span className="sunset-text">Live</span>
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTab("dashboard")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              tab === "dashboard" ? "sunset-gradient text-ink" : "bg-ink-2 border border-line/60 text-muted"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </button>
          <button
            onClick={() => setTab("creer")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              tab === "creer" ? "sunset-gradient text-ink" : "bg-ink-2 border border-line/60 text-muted"
            }`}
          >
            <Ticket className="h-4 w-4" />
            Créer un événement
          </button>
          <button
            onClick={() => setTab("equipe")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              tab === "equipe" ? "sunset-gradient text-ink" : "bg-ink-2 border border-line/60 text-muted"
            }`}
          >
            <Users className="h-4 w-4" />
            Mon équipe
          </button>
        </div>
      </div>

      {tab === "equipe" ? (
        <section className="mt-6 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
            <div>
              <h2 className="font-display text-2xl font-bold">Mon équipe</h2>
              <p className="mt-1 text-sm text-muted">Chaque membre utilise son propre compte et ses permissions.</p>
            </div>
            <a href="/scanner" className="primary-action rounded-sm px-4 py-2 text-sm font-semibold">Ouvrir le scanner</a>
          </div>

          <form onSubmit={inviteTeamMember} className="space-y-4 border-b border-line pb-6">
            <h3 className="font-semibold">Ajouter un membre</h3>
            <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto]">
              <label className="text-sm font-semibold">Adresse e-mail du compte
                <input name="member_email" type="email" required className={`${inputCls} mt-1.5`} />
              </label>
              <label className="text-sm font-semibold">Rôle
                <select name="team_role" defaultValue="scanner" className={`${inputCls} mt-1.5`}>
                  <option value="manager">Manager</option>
                  <option value="scanner">Scanner</option>
                  <option value="cashier">Caissier</option>
                  <option value="staff">Staff personnalisé</option>
                </select>
              </label>
              <button disabled={teamPending} className="primary-action self-end rounded-sm px-5 py-2.5 text-sm font-bold disabled:opacity-50">
                {teamPending ? "Enregistrement…" : "+ Ajouter"}
              </button>
            </div>
            <fieldset className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Permissions personnalisées du staff</legend>
              <label className="flex items-center gap-2"><input name="permission_scan" type="checkbox" /> Scanner les billets</label>
              <label className="flex items-center gap-2"><input name="permission_sales" type="checkbox" /> Consulter les ventes</label>
              <label className="flex items-center gap-2"><input name="permission_stats" type="checkbox" /> Voir les statistiques et l’activité</label>
            </fieldset>
            <p className="text-xs text-muted">Le membre doit d’abord créer son propre compte. Ajoutez ensuite l’adresse e-mail utilisée pour ce compte afin de lui attribuer un rôle.</p>
          </form>

          <div className="divide-y divide-line border-y border-line">
            {team.length === 0 ? (
              <p className="py-5 text-sm text-muted">Aucun membre pour le moment.</p>
            ) : team.map((member) => (
              <article key={member.id} className="flex flex-wrap items-center gap-3 py-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-3 text-lg text-amber">
                  {member.role === "scanner" ? <Camera className="h-4 w-4" /> : member.role === "cashier" ? <CreditCard className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{member.member_email}</p>
                  <p className="text-xs text-muted">{member.role === "manager" ? "Manager" : member.role === "scanner" ? "Scanner" : member.role === "cashier" ? "Caissier" : "Staff"} · {member.status === "active" ? "Actif" : member.status === "disabled" ? "Désactivé" : "Invitation en attente"}</p>
                  {member.role === "staff" && <p className="text-xs text-muted">Permissions : {Object.entries(member.permissions as Record<string, unknown>).filter(([, enabled]) => enabled === true).map(([permission]) => ({ scan: "Scanner", sales: "Ventes", stats: "Statistiques" })[permission] ?? permission).join(", ") || "Aucune"}</p>}
                </div>
                <div className="flex gap-2">
                  {member.status !== "invited" && (
                  <button disabled={teamPending} onClick={() => void updateTeamMemberStatus(member.id, member.status === "active" ? "disabled" : "active")} className="border border-line px-3 py-2 text-xs font-semibold hover:border-togogreen disabled:opacity-50">
                    {member.status === "active" ? "Désactiver" : "Réactiver"}
                  </button>
                  )}
                  <button disabled={teamPending} onClick={() => void removeTeamMember(member.id)} className="border border-togored/50 px-3 py-2 text-xs font-semibold text-togored hover:border-togored disabled:opacity-50">Retirer</button>
                </div>
              </article>
            ))}
          </div>

          <div>
            <h3 className="font-display text-xl font-bold">Activité récente des scanners</h3>
            <div className="mt-3 divide-y divide-line border-y border-line">
              {scanActivity.length === 0 ? (
                <p className="py-4 text-sm text-muted">Aucun scan enregistré.</p>
              ) : scanActivity.map((item) => {
                const scanner = team.find((member) => member.member_user_id === item.scanned_by)?.member_email ?? "Responsable";
                return (
                  <div key={item.id} className="flex flex-wrap gap-x-4 gap-y-1 py-3 text-sm">
                    <span className="font-semibold">{scanner}</span>
                    <span className={item.result === "valid" ? "text-togogreen" : "text-togored"}>{item.result === "valid" ? "Billet accepté" : item.result === "already_used" ? "Déjà utilisé" : item.result === "wrong_event" ? "Mauvais événement" : item.result === "unpaid" ? "Non payé" : "Inconnu"}</span>
                    <span className="text-muted">{item.event_id} · {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.scanned_at))}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {teamMessage && <p role="status" className="text-sm text-muted">{teamMessage}</p>}
        </section>
      ) : tab === "dashboard" ? (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-ink-2 p-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-togogreen">Organisation</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-cream">{access.name || "Mon organisation"}</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-togogreen/40 bg-togogreen/10 px-3 py-1.5 text-xs font-semibold text-togogreen">
              <span className="h-2 w-2 rounded-full bg-togogreen" />
              Organisateur vérifié
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {STATS.map((s) => {
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
                  <p className="mt-2 font-display font-bold text-xl lg:text-2xl">—</p>
                  <p className="mt-2 text-[11px] text-muted">En attente de données réelles</p>
                </div>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-[1.3fr_0.7fr] gap-4">
            <div className="rounded-2xl bg-ink-2 border border-line/60 p-5">
              <h2 className="font-display font-bold text-lg">Ventes par jour</h2>
              <p className="text-xs text-muted mb-4">Billets vendus cette semaine</p>
              <p className="py-10 text-center text-sm text-muted">Les ventes apparaîtront après vos premières réservations.</p>
            </div>

            <div className="rounded-2xl bg-ink-2 border border-line/60 p-5">
              <h2 className="font-display font-bold text-lg">Taux de conversion</h2>
              <div className="mt-4 space-y-4">
                <p className="py-10 text-center text-sm text-muted">Les taux seront calculés à partir de vos données de réservation.</p>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-4">
            <div className="rounded-2xl bg-ink-2 border border-line/60 p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="font-display font-bold text-lg">Revenus de la semaine</h2>
                  <p className="text-xs text-muted">Évolution jour par jour</p>
                </div>
                <p className="font-display font-bold text-2xl text-muted">—</p>
              </div>
              <p className="mt-6 py-6 text-center text-sm text-muted">Aucun revenu enregistré.</p>
            </div>

            <div className="rounded-2xl bg-ink-2 border border-line/60 p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display font-bold text-lg">Mes événements</h2>
                <button type="button" className="text-xs font-semibold text-togogreen">Voir tout</button>
              </div>
              <div className="mt-4 space-y-3">
                {createdEvents.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">Vous n’avez pas encore créé d’événement.</p>
                ) : createdEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink p-3">
                    <div>
                      <p className="font-semibold text-cream">{event.name}</p>
                      <p className="text-xs text-muted">{event.sales} · {event.date}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                      event.status === "Publié" ? "bg-togogreen/15 text-togogreen" :
                      event.status === "Brouillon" ? "bg-amber/15 text-amber" :
                      "bg-ink-3 text-muted"
                    }`}>{event.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-ink-2 border border-line/60 p-5">
              <h2 className="font-display font-bold text-lg">Ventes par catégorie</h2>
              <p className="text-xs text-muted mb-4">Répartition des billets (%)</p>
              <p className="py-10 text-center text-sm text-muted">La répartition sera disponible après les premières ventes.</p>
            </div>

            <div className="rounded-2xl bg-ink-2 border border-line/60 p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display font-bold text-lg">Paiements récents</h2>
                <button type="button" className="text-xs font-semibold text-togogreen">Exporter</button>
              </div>
              <div className="mt-4 space-y-3">
                <p className="py-6 text-center text-sm text-muted">Aucun paiement enregistré.</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 max-w-5xl">
          {submitted ? (
            <div className="rounded-[28px] border border-line bg-ink-2 p-8 text-center shadow-glow sm:p-10">
              <CheckCheck className="mx-auto h-12 w-12 text-togogreen" />
              <p className="mt-4 font-display font-bold text-3xl text-cream">Événement enregistré</p>
              <p className="mt-3 max-w-xl mx-auto text-sm text-muted">
                {eventMessage}
              </p>
              <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
                {[
                  { label: "Statut", value: createdEvents[0]?.status ?? "Brouillon" },
                  {
                    label: "Date",
                    value: draftDate
                      ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(`${draftDate}T12:00:00`))
                      : "—",
                  },
                  { label: "Lieu", value: draftLocation || "—" },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-line bg-ink p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">{item.label}</p>
                    <p className="mt-2 font-semibold text-cream">{item.value}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setTiers(DEFAULT_TIERS);
                  setProgram([{ time: "", label: "" }]);
                }}
                className="mt-8 px-6 py-3 rounded-full font-display font-bold text-ink sunset-gradient"
              >
                Créer un autre événement
              </button>
            </div>
          ) : (
            <form
              className="space-y-5"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await saveCreatedEvent("pending")) setSubmitted(true);
              }}
            >
              <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-5">
                  {/* 1. SECTION AFFICHE AVEC UPLOAD RÉEL */}
                  <div className="rounded-2xl bg-ink-2 border border-line/60 p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="font-display font-bold text-xl text-cream">Affiche officielle</h2>
                        <p className="text-xs text-muted mt-0.5">L’élément clé pour attirer vos participants sur Lomé Events</p>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-togogreen bg-togogreen/10 border border-togogreen/20 px-2.5 py-1 rounded-full">Recommandé</span>
                    </div>

                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handlePosterFile(file);
                      }}
                    />

                    {posterPreview || posterUrl ? (
                      <div className="relative overflow-hidden rounded-2xl border border-amber/40 bg-ink p-3 flex gap-4 items-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={posterPreview || posterUrl}
                          alt="Aperçu de l'affiche"
                          className="w-24 aspect-[4/5] object-cover rounded-xl border border-line shadow-md shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-cream truncate">Affiche sélectionnée</p>
                          <p className="text-xs text-muted mt-0.5">
                            {uploadingPoster ? "Téléversement vers Supabase Storage en cours..." : "Prête pour publication"}
                          </p>
                          {uploadingPoster && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-amber">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Envoi en cours…</span>
                            </div>
                          )}
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="rounded-lg border border-line bg-ink-2 px-3 py-1.5 text-xs font-semibold text-cream hover:border-amber transition"
                            >
                              Changer
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPosterPreview(null);
                                setPosterUrl("");
                              }}
                              className="rounded-lg border border-togored/40 px-3 py-1.5 text-xs font-semibold text-togored hover:bg-togored/10 transition"
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line/80 bg-ink/50 p-6 text-center hover:border-amber hover:bg-ink transition cursor-pointer"
                      >
                        <div className="rounded-full bg-ink-3 p-3 text-amber group-hover:scale-110 transition">
                          <Upload className="h-6 w-6" />
                        </div>
                        <p className="mt-3 text-sm font-semibold text-cream">
                          Cliquez pour téléverser votre affiche
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          Formats PNG, JPG ou WEBP · Ratio idéal 4:5 · Max 5 Mo
                        </p>
                      </div>
                    )}

                    {posterError && (
                      <p role="alert" className="text-xs text-togored">{posterError}</p>
                    )}

                    {/* Presets rapides si pas d'affiche */}
                    <div>
                      <p className="text-xs font-semibold text-muted flex items-center gap-1.5 mb-2">
                        <Sparkles className="h-3.5 w-3.5 text-amber" />
                        Ou choisissez un visuel thématique prêt à l&apos;emploi :
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {POSTER_PRESETS.map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => {
                              setPosterUrl(preset.url);
                              setPosterPreview(preset.url);
                            }}
                            className={`rounded-xl border p-2 text-left text-xs transition ${
                              posterUrl === preset.url
                                ? "border-amber bg-amber/10 text-amber font-bold"
                                : "border-line/60 bg-ink hover:border-line text-muted"
                            }`}
                          >
                            <p className="truncate font-medium">{preset.name}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 2. SECTION INFORMATIONS PRINCIPALES */}
                  <div className="rounded-2xl bg-ink-2 border border-line/60 p-5 space-y-4">
                    <h2 className="font-display font-bold text-xl text-cream">Détails de l&apos;événement</h2>
                    <div>
                      <label className="text-xs text-muted block mb-1">Titre de l&apos;événement *</label>
                      <input
                        required
                        value={draftTitle}
                        onChange={(event) => setDraftTitle(event.target.value)}
                        placeholder="Ex. : Lomé Afro Fusion Festival 2026"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Description *</label>
                      <textarea
                        required
                        rows={4}
                        value={draftDescription}
                        onChange={(event) => setDraftDescription(event.target.value)}
                        placeholder="Présentez les artistes, le déroulement, le public attendu et les moments forts…"
                        className={inputCls}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted block mb-1">Date *</label>
                        <input required type="date" value={draftDate} onChange={(event) => setDraftDate(event.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs text-muted block mb-1">Heure de début *</label>
                        <input required type="time" value={draftTime} onChange={(event) => setDraftTime(event.target.value)} className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Catégorie *</label>
                      <select className={inputCls} value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)}>
                        {CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 3. SECTION LOCALISATION & QUARTIERS DE LOMÉ */}
                  <div className="rounded-2xl bg-ink-2 border border-line/60 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-amber" />
                        <h2 className="font-display font-bold text-xl text-cream">Lieu &amp; Quartier à Lomé</h2>
                      </div>
                      <span className="text-xs text-muted">Positionnement Lomé</span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs text-muted block mb-1">Nom du lieu / Salle *</label>
                        <input
                          required
                          value={draftVenue}
                          onChange={(e) => {
                            setDraftVenue(e.target.value);
                            setDraftLocation(e.target.value);
                          }}
                          placeholder="Ex. : Palais des Congrès de Lomé"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted block mb-1">Adresse précise / Repère</label>
                        <input
                          value={draftAddress}
                          onChange={(e) => setDraftAddress(e.target.value)}
                          placeholder="Ex. : Face au CHU Sylvanus Olympio"
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-muted block mb-1">Quartier de Lomé *</label>
                      <select
                        value={draftDistrict}
                        onChange={(e) => setDraftDistrict(e.target.value)}
                        className={inputCls}
                      >
                        {LOME_DISTRICTS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Chips de sélection rapide des quartiers populaires */}
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
                        Sélection rapide :
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {LOME_DISTRICTS.slice(0, 7).map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setDraftDistrict(d.id)}
                            className={`rounded-full px-3 py-1 text-xs transition ${
                              draftDistrict === d.id
                                ? "bg-amber text-ink font-bold shadow-sm"
                                : "border border-line/60 bg-ink text-muted hover:border-amber/50"
                            }`}
                          >
                            {d.id}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Badge de coordonnées GPS Lomé */}
                    <div className="flex items-center justify-between rounded-xl border border-line bg-ink px-3 py-2.5 text-xs text-muted">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-togogreen animate-pulse" />
                        <span>
                          Repère GPS :{" "}
                          <strong className="text-cream">
                            {LOME_DISTRICTS.find((d) => d.id === draftDistrict)?.lat ?? 6.1319}° N,{" "}
                            {LOME_DISTRICTS.find((d) => d.id === draftDistrict)?.lng ?? 1.2228}° E
                          </strong>
                        </span>
                      </div>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          (draftVenue ? `${draftVenue}, ` : "") + `${draftDistrict}, Lomé, Togo`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-amber hover:underline"
                      >
                        <span>Vérifier sur Maps</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  {/* 4. PROGRAMME */}
                  <div className="rounded-2xl bg-ink-2 border border-line/60 p-5">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display font-bold text-xl text-cream">Programme &amp; Horaires</h2>
                      <button
                        type="button"
                        onClick={() => setProgram((p) => [...p, { time: "", label: "" }])}
                        className="text-xs font-semibold text-amber hover:text-ember transition-colors"
                      >
                        + Ajouter une étape
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {program.map((step, i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            type="time"
                            value={step.time}
                            onChange={(e) => updateStep(i, { time: e.target.value })}
                            className={`${inputCls} w-28 shrink-0`}
                          />
                          <input
                            value={step.label}
                            onChange={(e) => updateStep(i, { label: e.target.value })}
                            placeholder="Ouverture des portes, concert..."
                            className={inputCls}
                          />
                          {program.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setProgram((p) => p.filter((_, idx) => idx !== i))}
                              className="shrink-0 text-togored text-lg px-2 hover:bg-togored/10 rounded-lg transition"
                              aria-label="Supprimer"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* COLONNE DE DROITE : APERÇU EN DIRECT & BILLETS */}
                <aside className="space-y-5">
                  <div className="rounded-2xl bg-ink-2 border border-line/60 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="font-display font-bold text-xl text-cream">Aperçu en direct</h2>
                      <span className="rounded-full border border-line px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                        Catalogue Lomé Events
                      </span>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-ink shadow-lg">
                      {posterPreview || posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={posterPreview || posterUrl}
                          alt="Aperçu affiche"
                          className="h-48 w-full object-cover"
                        />
                      ) : (
                        <div className="poster h-48 w-full flex items-end p-4">
                          <p className="text-white font-display font-bold text-lg drop-shadow">
                            {draftTitle || "Affiche de l'événement"}
                          </p>
                        </div>
                      )}

                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-togogreen">
                            {CATEGORIES.find((c) => c.id === draftCategory)?.label ?? "Événement"}
                          </p>
                          <span className="text-xs text-muted">Lomé · {draftDistrict}</span>
                        </div>
                        <h3 className="mt-1.5 font-display text-xl font-bold text-cream line-clamp-2">
                          {draftTitle || "Titre de l'événement"}
                        </h3>
                        <p className="mt-2 text-xs font-semibold text-amber">
                          {draftDate
                            ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(
                                new Date(`${draftDate}T12:00:00`)
                              )
                            : "Date à définir"}
                          {draftTime ? ` · ${draftTime}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-muted truncate">
                          {draftVenue.trim() || draftLocation.trim() || "Lieu à définir"}
                        </p>
                        {draftDescription && (
                          <p className="mt-2 text-xs leading-relaxed text-muted line-clamp-2">
                            {draftDescription}
                          </p>
                        )}
                        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line/60 pt-3 text-xs">
                          <div>
                            <span className="text-muted block text-[10px] uppercase">À partir de</span>
                            <strong className="text-sm font-bold text-cream">
                              {formatFCFA(tiers.length > 0 ? Math.min(...tiers.map((t) => t.price)) : 0)}
                            </strong>
                          </div>
                          <div className="text-right">
                            <span className="text-muted block text-[10px] uppercase">Capacité totale</span>
                            <strong className="text-sm font-bold text-cream">
                              {tiers.reduce((sum, t) => sum + (t.quota || 0), 0)} places
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-ink-2 border border-line/60 p-5">
                    <h2 className="font-display font-bold text-xl">Billets &amp; tarifs</h2>
                    <p className="text-xs text-muted mt-0.5">
                      Définissez les catégories de billets, prix et quantités.
                    </p>
                    <div className="mt-4 space-y-3">
                      {tiers.map((tier, i) => (
                        <div
                          key={tier.name + i}
                          className="grid grid-cols-[1fr_auto_auto] items-end gap-3 rounded-xl bg-ink-3/60 border border-line/40 p-3"
                        >
                          <div>
                            <p className="text-xs text-muted mb-1">Catégorie</p>
                            <p className="font-display font-bold">{tier.name}</p>
                          </div>
                          <div>
                            <label className="text-xs text-muted block mb-1">Prix</label>
                            <input
                              type="number"
                              min={0}
                              step={500}
                              value={tier.price}
                              onChange={(e) => updateTier(i, { price: Number(e.target.value) })}
                              className={`${inputCls} w-28`}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted block mb-1">Qté</label>
                            <input
                              type="number"
                              min={1}
                              value={tier.quota}
                              onChange={(e) => updateTier(i, { quota: Number(e.target.value) })}
                              className={`${inputCls} w-24`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setTiers((current) => [...current, { name: `Catégorie ${current.length + 1}`, price: 5000, quota: 50 }])}
                      className="mt-4 w-full rounded-xl border border-line bg-ink px-4 py-2 text-sm font-semibold text-cream hover:border-togogreen"
                    >
                      + Ajouter une catégorie
                    </button>
                  </div>
                </aside>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={eventPending}
                  onClick={async () => {
                    if (await saveCreatedEvent("draft")) setSubmitted(true);
                  }}
                  className="rounded-xl border border-line bg-ink px-5 py-3 font-semibold text-cream"
                >
                  {eventPending ? "Enregistrement…" : "Enregistrer le brouillon"}
                </button>
                <button
                  type="submit"
                  disabled={eventPending}
                  className="rounded-xl px-5 py-3 font-display font-bold text-lg text-ink sunset-gradient"
                >
                  {eventPending ? "Envoi…" : "Envoyer pour validation"}
                </button>
              </div>
              {eventMessage && <p role="alert" className="text-sm text-togored">{eventMessage}</p>}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
