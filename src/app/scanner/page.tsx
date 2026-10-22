"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { IScannerControls } from "@zxing/browser";
import { getEvent } from "@/lib/data";
import { getTickets, isScanned, markScanned } from "@/lib/store";
import { formatDateShortFR } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  Camera,
  CircleCheckBig,
  CircleX,
  Flashlight,
  FlashlightOff,
  RefreshCw,
  Smartphone,
  Vibrate,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";

type Phase = "scan" | "verifying" | "access";
type Verdict = "valid" | "used" | "unknown" | "wrong_event" | "unpaid" | "denied" | "offline";
type ScannableEvent = { id: string; title: string; starts_at: string; venue: string };
type ScanResponse = {
  status: Verdict;
  code?: string;
  ticket_type?: string;
  buyer_name?: string;
  event_title?: string;
  starts_at?: string;
  venue?: string;
  checked_in_at?: string | null;
};

const STEPS = ["SCAN", "VÉRIFICATION", "ACCÈS"];

function playTone(type: "success" | "error") {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === "success") {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.12);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } else {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(160, now);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch {
    // AudioContext blocked
  }
}

function triggerVibration(type: "success" | "error") {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    if (type === "success") navigator.vibrate([80, 40, 80]);
    else navigator.vibrate([250, 100, 250]);
  }
}

export default function ScannerPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [backend, setBackend] = useState(false);
  const [events, setEvents] = useState<ScannableEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const [accessMessage, setAccessMessage] = useState("");
  const [phase, setPhase] = useState<Phase>("scan");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [checked, setChecked] = useState<string | null>(null);
  const [scanResponse, setScanResponse] = useState<ScanResponse | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [continuousMode, setContinuousMode] = useState(true);
  const [scannedSessionCount, setScannedSessionCount] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControls = useRef<IScannerControls | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;

    async function loadScannableEvents() {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !user) {
        router.replace("/connexion");
        return;
      }
      setBackend(true);
      const { data, error } = await supabase.rpc("list_scannable_events");
      if (!active) return;
      if (error) {
        setAccessMessage(error.message);
        return;
      }
      setEvents(data ?? []);
      setEventId(data?.[0]?.id ?? "");
      if (!data?.length) {
        setAccessMessage("Aucun événement accessible. Demandez au responsable de vous ajouter à son équipe avec la permission Scanner.");
      }
    }

    void loadScannableEvents();
    inputRef.current?.focus();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const reset = () => {
    setPhase("scan");
    setVerdict(null);
    setChecked(null);
    setScanResponse(null);
    setCode("");
    inputRef.current?.focus();
  };

  const verify = useCallback(async (raw: string) => {
    const normalized = raw.trim().toUpperCase();
    if (!normalized) return;
    if (backend && !eventId) {
      setAccessMessage("Choisissez un événement autorisé avant de scanner.");
      return;
    }
    setChecked(normalized);
    setPhase("verifying");
    setVerdict(null);
    setScanResponse(null);

    const handleOutcome = (v: Verdict) => {
      setVerdict(v);
      setPhase("access");
      if (v === "valid") {
        if (soundEnabled) playTone("success");
        if (vibrationEnabled) triggerVibration("success");
        setScannedSessionCount((c) => c + 1);
        if (continuousMode) {
          setTimeout(() => {
            reset();
            setCameraOpen(true);
          }, 1800);
        }
      } else {
        if (soundEnabled) playTone("error");
        if (vibrationEnabled) triggerVibration("error");
      }
    };

    if (backend) {
      try {
        const { data, error } = await createClient().rpc("scan_ticket", {
          p_code: normalized,
          p_event_id: eventId,
        });
        if (error) throw error;
        const response = data as ScanResponse;
        setScanResponse(response);
        handleOutcome(response.status);
      } catch {
        handleOutcome("offline");
      }
      return;
    }

    window.setTimeout(() => {
      const ticket = getTickets().find((t) => t.code === normalized);
      if (!ticket) {
        handleOutcome("unknown");
      } else if (isScanned(normalized) || ticket.used) {
        handleOutcome("used");
      } else {
        markScanned(normalized);
        handleOutcome("valid");
      }
    }, 400);
  }, [backend, eventId, soundEnabled, vibrationEnabled, continuousMode]);

  useEffect(() => {
    if (!cameraOpen || !videoRef.current) return;
    let active = true;

    async function startCamera() {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (!active || !videoRef.current) return;
        scannerControls.current = await new BrowserQRCodeReader().decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, _error, controls) => {
            if (!active || !result) return;
            const scannedCode = result.getText().trim();
            controls.stop();
            scannerControls.current = null;
            setCameraOpen(false);
            setCode(scannedCode);
            void verify(scannedCode);
          },
        );
      } catch {
        if (active) {
          setCameraError("Impossible d’ouvrir la caméra. Vérifiez son autorisation ou saisissez le code manuellement.");
          setCameraOpen(false);
        }
      }
    }

    void startCamera();
    return () => {
      active = false;
      scannerControls.current?.stop();
      scannerControls.current = null;
    };
  }, [cameraOpen, verify]);

  const toggleTorch = async () => {
    if (!videoRef.current?.srcObject) return;
    try {
      const stream = videoRef.current.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      const capabilities = track.getCapabilities?.() as { torch?: boolean };
      if (capabilities?.torch) {
        const nextTorch = !torchOn;
        // @ts-expect-error torch is advanced constraint
        await track.applyConstraints({ advanced: [{ torch: nextTorch }] });
        setTorchOn(nextTorch);
      }
    } catch {
      // Ignored
    }
  };

  const ticket = !backend && checked ? getTickets().find((t) => t.code === checked) : undefined;
  const event = ticket ? getEvent(ticket.eventId) : undefined;

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">
        Scanner QR Code
      </h1>
      <p className="mt-1 text-sm text-muted">
        Outil organisateur — contrôle des billets à l&apos;entrée
      </p>

      {backend && (
        <label className="mt-5 block text-sm font-semibold">
          Événement à contrôler
          <select value={eventId} onChange={(event) => setEventId(event.target.value)} disabled={!events.length || phase === "verifying"} className="mt-1.5 w-full rounded-sm border border-line bg-ink-2 px-3 py-3">
            {events.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.venue}</option>)}
          </select>
        </label>
      )}
      {accessMessage && <p role="status" className="mt-3 text-sm text-muted">{accessMessage}</p>}

      {/* Étapes SCAN → VÉRIFICATION → ACCÈS */}
      <div className="mt-6 flex items-center gap-2">
        {STEPS.map((s, i) => {
          const active =
            (phase === "scan" && i === 0) ||
            (phase === "verifying" && i <= 1) ||
            (phase === "access" && i <= 2);
          return (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold ${
                  active ? "sunset-gradient text-ink" : "bg-ink-2 text-muted"
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`text-xs font-semibold ${
                  active ? "text-cream" : "text-muted"
                }`}
              >
                {s}
              </span>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-line" />}
            </div>
          );
        })}
      </div>

      {/* Staff Controls Toolbar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-ink-2 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSoundEnabled((s) => !s)}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
              soundEnabled ? "bg-amber/15 text-amber font-semibold" : "text-muted hover:text-cream"
            }`}
            title="Activer/Désactiver le bip sonore"
          >
            {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            <span>{soundEnabled ? "Son" : "Muet"}</span>
          </button>

          <button
            type="button"
            onClick={() => setVibrationEnabled((v) => !v)}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
              vibrationEnabled ? "bg-togogreen/15 text-togogreen font-semibold" : "text-muted hover:text-cream"
            }`}
            title="Activer/Désactiver la vibration"
          >
            <Vibrate className="h-3.5 w-3.5" />
            <span>Vibration</span>
          </button>

          <button
            type="button"
            onClick={() => setContinuousMode((c) => !c)}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
              continuousMode ? "bg-[#3498db]/15 text-[#3498db] font-semibold" : "text-muted hover:text-cream"
            }`}
            title="Scan en continu automatique"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>{continuousMode ? "Scan Continu" : "Scan Manuel"}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-muted">
          <span className="font-semibold text-cream">
            {scannedSessionCount} validé{scannedSessionCount > 1 ? "s" : ""}
          </span>
          {scannedSessionCount > 0 && (
            <button
              type="button"
              onClick={() => setScannedSessionCount(0)}
              className="text-[10px] text-muted hover:text-togored underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-line bg-ink-2 p-5">
        {(phase === "scan" || phase === "verifying") && (
          <>
            {cameraOpen ? (
              <div className="relative overflow-hidden rounded-2xl border border-line bg-black">
                <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" aria-label="Caméra du scanner QR" />
                <div className="absolute top-3 right-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleTorch()}
                    className="rounded-full bg-ink/80 p-2 text-cream backdrop-blur hover:bg-ink transition"
                    title="Lampe torche"
                  >
                    {torchOn ? <Flashlight className="h-4 w-4 text-amber" /> : <FlashlightOff className="h-4 w-4 text-muted" />}
                  </button>
                </div>
                <button type="button" onClick={() => setCameraOpen(false)} className="primary-action w-full px-4 py-3 text-sm font-semibold">
                  Fermer la caméra
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCameraError("");
                  setCameraOpen(true);
                }}
                className="flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-amber/40 bg-ink px-4 py-8 text-center transition hover:border-amber cursor-pointer"
              >
                <Camera className="h-10 w-10 text-amber" />
                <span className="mt-2 font-display font-bold">Scanner un QR Code</span>
                <span className="mt-0.5 text-xs text-muted">Caméra en direct ou saisie manuelle ci-dessous</span>
              </button>
            )}
            {cameraError && <p role="alert" className="mt-3 text-sm text-togored">{cameraError}</p>}

            <form
              className="mt-4"
                onSubmit={(e) => {
                e.preventDefault();
                  void verify(code);
              }}
            >
              <label
                htmlFor="scan-code"
                className="text-xs font-semibold uppercase tracking-wide text-muted"
              >
                Code du billet
              </label>
              <input
                ref={inputRef}
                id="scan-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="LE-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                disabled={phase === "verifying"}
                className="mt-1 w-full rounded-xl border border-line bg-ink px-4 py-3 font-display tracking-wider uppercase placeholder:text-muted/50 focus:border-amber focus:outline-none"
              />
              <button
                type="submit"
                disabled={phase === "verifying" || !code.trim() || (backend && !eventId)}
                className="sunset-gradient mt-3 w-full rounded-full py-3.5 font-display text-sm font-bold text-ink transition hover:opacity-90 disabled:opacity-40"
              >
                {phase === "verifying" ? "Vérification…" : "Vérifier le billet"}
              </button>
            </form>

            {phase === "verifying" && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-amber" />
                Vérification en cours…
              </div>
            )}
          </>
        )}

        {phase === "access" && verdict && (
          <div className="py-4 text-center">
            {verdict === "valid" && (
              <>
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-togogreen/15">
                  <CircleCheckBig className="h-10 w-10 text-togogreen" />
                </div>
                <p className="mt-4 font-display text-2xl font-bold text-togogreen">
                  BILLET VALIDE
                </p>
                <p className="mt-1 text-sm text-muted">Accès autorisé</p>
                {(scanResponse?.status === "valid" || (ticket && event)) && (
                  <div className="mx-auto mt-4 max-w-xs rounded-2xl border border-togogreen/30 bg-ink p-4 text-left text-sm">
                    <p className="font-display font-bold">{scanResponse?.event_title ?? event?.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {scanResponse?.starts_at
                        ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(scanResponse.starts_at))
                        : event ? `${formatDateShortFR(event.date)} · ${event.time}` : ""} · {scanResponse?.venue ?? event?.venue}
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      Billet <strong className="text-cream">{scanResponse?.ticket_type ?? ticket?.tierName}</strong> ·{" "}
                      {scanResponse?.buyer_name ?? ticket?.buyerName}
                    </p>
                    <p className="mt-1 font-display text-xs tracking-wider text-amber">
                      {scanResponse?.code ?? ticket?.code}
                    </p>
                  </div>
                )}
              </>
            )}

            {verdict === "used" && (
              <>
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-togored/15">
                  <CircleX className="h-10 w-10 text-togored" />
                </div>
                <p className="mt-4 font-display text-2xl font-bold text-togored">
                  BILLET DÉJÀ UTILISÉ
                </p>
                <p className="mt-1 text-sm text-muted">
                  Ce billet a déjà été scanné — accès refusé
                </p>
                {(scanResponse?.code || ticket?.code) && (
                  <p className="mt-3 font-display text-xs tracking-wider text-muted">
                    {scanResponse?.code ?? ticket?.code}
                  </p>
                )}
              </>
            )}

            {verdict === "unknown" && (
              <>
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-togored/15">
                  <CircleX className="h-10 w-10 text-togored" />
                </div>
                <p className="mt-4 font-display text-2xl font-bold text-togored">
                  BILLET INCONNU
                </p>
                <p className="mt-1 text-sm text-muted">
                  Ce code ne correspond à aucun billet vendu — accès refusé
                </p>
                <p className="mt-3 font-display text-xs tracking-wider text-muted">
                  {checked}
                </p>
              </>
            )}

            {verdict === "wrong_event" && (
              <p className="mt-4 font-semibold text-togored">Ce billet correspond à un autre événement. Accès refusé.</p>
            )}

            {verdict === "unpaid" && (
              <p className="mt-4 font-semibold text-togored">La commande associée à ce billet n’est pas payée. Accès refusé.</p>
            )}

            {verdict === "denied" && (
              <p className="mt-4 font-semibold text-togored">Votre compte n’a pas la permission de scanner pour cet événement.</p>
            )}

            {verdict === "offline" && (
              <p role="alert" className="mt-4 font-semibold text-togored">Serveur injoignable. Le billet n’a pas été validé ; rétablissez la connexion puis réessayez.</p>
            )}

            <button
              type="button"
              onClick={reset}
              className="mt-6 rounded-full border border-line bg-ink px-6 py-3 font-display text-sm font-bold transition hover:border-amber"
            >
              Scanner un autre billet
            </button>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        Chaque billet n&apos;est valide qu&apos;une seule fois — les doublons sont
        bloqués automatiquement.
      </p>
    </div>
  );
}
