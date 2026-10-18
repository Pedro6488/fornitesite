import type { IdentityValidationStatus } from "./identity-review-state";

type PresentableValidation = Readonly<{
  status: IdentityValidationStatus;
  giftable_at?: string | null;
}>;

export type IdentityPresentation = Readonly<{
  label: string;
  description: string;
  actionLabel: string;
  canQuote: boolean;
  tone: "neutral" | "warning" | "success" | "danger";
}>;

export function getIdentityPresentation(validation: PresentableValidation | null | undefined): IdentityPresentation {
  if (!validation) return {
    label: "Agrega el ID que recibirá los objetos",
    description: "Selecciona el destinatario antes de confirmar el precio.",
    actionLabel: "Agregar ID",
    canQuote: false,
    tone: "neutral",
  };
  if (validation.status === "manual_review") return {
    label: "ID en revisión por el equipo",
    description: "El equipo debe enviar la solicitud antes de iniciar las 48 horas.",
    actionLabel: "Ver estado",
    canQuote: false,
    tone: "warning",
  };
  if (validation.status === "pending_friendship") return {
    label: "Solicitud de amistad pendiente",
    description: "Acepta la solicitud de amistad en Fortnite.",
    actionLabel: "Ver estado",
    canQuote: false,
    tone: "warning",
  };
  if (validation.status === "waiting") return {
    label: "Espera de 48 horas en curso",
    description: validation.giftable_at
      ? `Disponible ${new Date(validation.giftable_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}.`
      : "La solicitud fue enviada; consulta la fecha de disponibilidad.",
    actionLabel: "Ver fecha",
    canQuote: false,
    tone: "warning",
  };
  if (validation.status === "ready") return {
    label: "ID listo para recibir objetos",
    description: "Puedes confirmar el precio de esta compra.",
    actionLabel: "Continuar",
    canQuote: true,
    tone: "success",
  };
  return {
    label: "ID no disponible para entrega",
    description: "Selecciona o agrega otro ID para continuar.",
    actionLabel: "Probar otro ID",
    canQuote: false,
    tone: "danger",
  };
}
