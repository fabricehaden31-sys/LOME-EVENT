import type { Event } from "@/lib/data";
import type { StoredTicket } from "@/lib/store";
import { dayMonthUpper, formatDateFR, formatFCFA } from "@/lib/utils";

/**
 * Convert an SVG element into an HTMLImageElement
 */
function svgToImage(svgElement: SVGElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const xml = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Draws rounded rectangle on canvas
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Generates an HD PNG Blob representing the styled pass
 */
export async function generateTicketImageBlob(
  ticket: StoredTicket,
  event: Event
): Promise<Blob> {
  const scale = 2;
  const width = 600 * scale;
  const height = 900 * scale;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossible d'initialiser le rendu graphique.");

  ctx.scale(scale, scale);

  // Background card with shadow
  ctx.fillStyle = "#FDFBF7"; // cream
  roundRect(ctx, 20, 20, 560, 860, 28);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(24, 24, 27, 0.08)";
  ctx.stroke();

  // Top header: Sunset gradient
  const headerGradient = ctx.createLinearGradient(20, 20, 580, 110);
  headerGradient.addColorStop(0, "#C2410C");
  headerGradient.addColorStop(1, "#F59E0B");

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(20 + 28, 20);
  ctx.lineTo(580 - 28, 20);
  ctx.quadraticCurveTo(580, 20, 580, 20 + 28);
  ctx.lineTo(580, 120);
  ctx.lineTo(20, 120);
  ctx.lineTo(20, 20 + 28);
  ctx.quadraticCurveTo(20, 20, 20 + 28, 20);
  ctx.closePath();
  ctx.clip();

  ctx.fillStyle = headerGradient;
  ctx.fillRect(20, 20, 560, 100);

  // Header Title
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 20px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillText("LOMÉ EVENTS", 45, 68);

  ctx.font = "600 12px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText("BILLET OFFICIEL NUMÉRIQUE", 45, 92);

  // Star badge on top right
  ctx.fillStyle = "#FFCE00"; // Togo gold
  ctx.beginPath();
  ctx.arc(540, 70, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Event Title
  ctx.fillStyle = "#18181B";
  ctx.font = "bold 24px 'Plus Jakarta Sans', system-ui, sans-serif";
  const title = event.title.toUpperCase();
  // Simple word wrapping
  const words = title.split(" ");
  let line = "";
  let y = 165;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > 500) {
      ctx.fillText(line, 45, y);
      line = word;
      y += 32;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, 45, y);
    y += 32;
  }

  // Date and Time
  y += 6;
  ctx.font = "bold 15px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillStyle = "#C2410C";
  ctx.fillText(`${dayMonthUpper(event.date)} · ${event.time}`, 45, y);

  // Venue & Address
  y += 24;
  ctx.font = "600 14px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillStyle = "rgba(24, 24, 27, 0.75)";
  ctx.fillText(`${event.venue} — ${event.district}`, 45, y);

  y += 20;
  ctx.font = "12px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillStyle = "rgba(24, 24, 27, 0.5)";
  ctx.fillText(event.address, 45, y);

  // Ticket Cut Line & Notches
  y += 36;
  const cutY = y;

  // Left notch
  ctx.fillStyle = "#0F1117"; // background ink color outside card
  ctx.beginPath();
  ctx.arc(20, cutY, 18, -Math.PI / 2, Math.PI / 2, false);
  ctx.fill();
  ctx.strokeStyle = "rgba(24, 24, 27, 0.08)";
  ctx.stroke();

  // Right notch
  ctx.beginPath();
  ctx.arc(580, cutY, 18, Math.PI / 2, -Math.PI / 2, false);
  ctx.fill();
  ctx.stroke();

  // Dashed tear line
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = "rgba(24, 24, 27, 0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(48, cutY);
  ctx.lineTo(552, cutY);
  ctx.stroke();
  ctx.setLineDash([]); // reset

  // QR Code Box
  const qrBoxY = cutY + 36;
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, 45, qrBoxY, 190, 190, 20);
  ctx.fill();
  ctx.strokeStyle = "rgba(24, 24, 27, 0.1)";
  ctx.stroke();

  // Grab QR code from DOM
  const qrSvg = document.querySelector<SVGElement>(`#qr-container svg`);
  if (qrSvg) {
    try {
      const qrImg = await svgToImage(qrSvg);
      ctx.drawImage(qrImg, 60, qrBoxY + 15, 160, 160);
    } catch {
      // Fallback text if QR image fails
      ctx.fillStyle = "#18181B";
      ctx.font = "bold 14px monospace";
      ctx.fillText(ticket.code, 70, qrBoxY + 100);
    }
  }

  // Ticket Meta on the right of QR code
  const textX = 260;
  let metaY = qrBoxY + 30;

  ctx.font = "bold 11px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillStyle = "rgba(24, 24, 27, 0.45)";
  ctx.fillText("CODE DU BILLET", textX, metaY);

  metaY += 22;
  ctx.font = "bold 18px monospace";
  ctx.fillStyle = "#18181B";
  ctx.fillText(ticket.code, textX, metaY);

  metaY += 32;
  ctx.font = "bold 11px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillStyle = "rgba(24, 24, 27, 0.45)";
  ctx.fillText("CATÉGORIE", textX, metaY);

  metaY += 20;
  ctx.font = "bold 16px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillStyle = "#18181B";
  ctx.fillText(ticket.tierName, textX, metaY);

  metaY += 32;
  ctx.font = "bold 11px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillStyle = "rgba(24, 24, 27, 0.45)";
  ctx.fillText("PRIX TOTAL", textX, metaY);

  metaY += 22;
  ctx.font = "bold 20px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillStyle = "#006A4E"; // Togo Green
  ctx.fillText(formatFCFA(ticket.price + (ticket.fees || 0)), textX, metaY);

  // Security and instruction banner
  const bannerY = qrBoxY + 225;
  ctx.fillStyle = "rgba(24, 24, 27, 0.04)";
  roundRect(ctx, 45, bannerY, 510, 60, 14);
  ctx.fill();

  ctx.font = "600 13px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillStyle = "#18181B";
  ctx.fillText("Présentez ce QR Code à l'entrée du site de l'événement.", 65, bannerY + 28);
  ctx.font = "11px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillStyle = "rgba(24, 24, 27, 0.6)";
  ctx.fillText("Valable pour une seule entrée. Billet non remboursable.", 65, bannerY + 46);

  // Footer Togo Flag stripe
  const footerY = 860;
  const flagHeight = 6;
  const flagWidth = 560 / 5;
  const flagColors = ["#006A4E", "#FFCE00", "#006A4E", "#FFCE00", "#006A4E"];
  flagColors.forEach((color, idx) => {
    ctx.fillStyle = color;
    ctx.fillRect(20 + idx * flagWidth, footerY, flagWidth, flagHeight);
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Échec de la génération de l'image."));
    }, "image/png");
  });
}

/**
 * Trigger PNG download
 */
export async function downloadTicketImage(
  ticket: StoredTicket,
  event: Event
): Promise<void> {
  const blob = await generateTicketImageBlob(ticket, event);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `billet-lome-events-${ticket.code}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Share ticket via WhatsApp
 */
export async function shareTicketWhatsApp(
  ticket: StoredTicket,
  event: Event
): Promise<void> {
  const message = [
    `🎟️ *Mon Billet Lomé Events*`,
    `✨ *${event.title}*`,
    `📅 ${formatDateFR(event.date)} à ${event.time}`,
    `📍 ${event.venue} (${event.district})`,
    `🎫 Billet : *${ticket.tierName}* (${formatFCFA(ticket.price + (ticket.fees || 0))})`,
    `🔑 Code Billet : *${ticket.code}*`,
    ``,
    `📲 Voir mon billet avec QR Code :`,
    window.location.href,
  ].join("\n");

  try {
    // Try native share with image attachment if supported
    const blob = await generateTicketImageBlob(ticket, event);
    const file = new File([blob], `billet-${ticket.code}.png`, {
      type: "image/png",
    });

    if (
      navigator.canShare &&
      navigator.canShare({ files: [file] }) &&
      navigator.share
    ) {
      await navigator.share({
        title: `Billet - ${event.title}`,
        text: message,
        files: [file],
      });
      return;
    }
  } catch (e) {
    // If user cancelled native share, don't fallback to redirect
    if (e instanceof Error && e.name === "AbortError") return;
  }

  // Fallback to direct WhatsApp Web / mobile URL
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    message
  )}`;
  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
}

/**
 * Open print dialog for ticket
 */
export function printTicket(): void {
  window.print();
}
