"use client";

import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";

/**
 * TicketQRCode
 * -------------
 * QR code co-brandé pour les billets Tapakila, avec le logo Efaina.com
 * intégré nativement au centre, sans perte de capacité de scan.
 *
 * Principe technique :
 * - Niveau de correction d'erreur "H" (30% de tolérance) : indispensable
 *   dès qu'un logo masque une partie du QR.
 * - `excavate: true` : "creuse" proprement les modules sous le logo au
 *   lieu de les recouvrir bêtement (évite les carrés noirs qui cassent
 *   le pattern du QR).
 * - Le logo ne doit jamais dépasser ~20-22% de la surface du QR, sinon
 *   même le niveau H ne suffit plus à garantir un scan fiable.
 *
 * Prérequis :
 * - `npm install qrcode.react` (déjà présent dans le projet)
 * - Le logo Efaina doit être placé dans `frontend/public/branding/`,
 *   idéalement en PNG carré avec fond transparent, résolution ~256x256.
 *
 * NB : cette version sert le logo en local (dossier /public), en
 * attendant la bascule vers Bunny.net prévue dans ~2 mois. Le jour venu,
 * il suffira de changer la valeur de DEFAULT_LOGO_URL (ou la variable
 * d'env NEXT_PUBLIC_EFAINA_LOGO_URL) pour pointer vers le CDN Bunny —
 * aucun autre changement nécessaire dans ce composant.
 */

interface TicketQRCodeProps {
  /**
   * Contenu encodé dans le QR : typiquement l'UUID du billet
   * (généré via crypto.randomUUID()) ou une URL de vérification
   * du type https://tapakila.mg/verify/{ticketUuid}
   */
  value: string;

  /**
   * Taille du QR en pixels (carré). Par défaut 240.
   */
  size?: number;

  /**
   * URL du logo Efaina hébergé sur Bunny.net.
   * Peut être surchargée via la prop, sinon utilise la variable
   * d'environnement publique NEXT_PUBLIC_EFAINA_LOGO_URL.
   */
  logoUrl?: string;

  /**
   * Rendu SVG (recommandé pour l'affichage web, net à toute résolution)
   * ou Canvas (utile si tu dois exporter le QR en image bitmap,
   * par ex. pour l'envoyer par email ou l'insérer dans un PDF de billet).
   */
  as?: "svg" | "canvas";

  /**
   * Couleurs du QR. Garder un contraste fort (noir/blanc par défaut)
   * pour maximiser la fiabilité du scan.
   */
  fgColor?: string;
  bgColor?: string;

  className?: string;
}

// TEMPORAIRE : logo servi depuis /public en local. À remplacer par
// NEXT_PUBLIC_EFAINA_LOGO_URL (Bunny.net) une fois le CDN branché.
const DEFAULT_LOGO_URL =
  process.env.NEXT_PUBLIC_EFAINA_LOGO_URL ?? "/branding/efaina-logo.png";

export function TicketQRCode({
  value,
  size = 240,
  logoUrl,
  as = "svg",
  fgColor = "#000000",
  bgColor = "#FFFFFF",
  className,
}: TicketQRCodeProps) {
  // Le logo ne doit pas dépasser ~20% de la surface du QR pour rester
  // dans la marge de tolérance du niveau de correction "H".
  const logoSize = Math.round(size * 0.2);

  const imageSettings = {
    src: logoUrl ?? DEFAULT_LOGO_URL,
    height: logoSize,
    width: logoSize,
    excavate: true,
  };

  const commonProps = {
    value,
    size,
    level: "H" as const, // niveau de correction max, obligatoire avec logo
    fgColor,
    bgColor,
    imageSettings,
    marginSize: 2, // quiet zone : évite les problèmes de scan en bordure
  };

  if (as === "canvas") {
    return (
      <QRCodeCanvas
        {...commonProps}
        className={className}
        data-testid="ticket-qr-canvas"
      />
    );
  }

  return (
    <QRCodeSVG
      {...commonProps}
      className={className}
      data-testid="ticket-qr-svg"
    />
  );
}

export default TicketQRCode;

/**
 * Exemple d'intégration dans /tickets ou /events/[id]/tickets/[ticketId] :
 *
 * <TicketQRCode
 *   value={ticket.qrCodeUuid}
 *   size={280}
 *   className="mx-auto rounded-lg shadow-md"
 * />
 *
 * Pour un export PNG téléchargeable (bouton "Télécharger mon billet") :
 * utiliser as="canvas", puis récupérer le canvas via une ref et appeler
 * canvas.toDataURL("image/png") pour générer le lien de téléchargement.
 */