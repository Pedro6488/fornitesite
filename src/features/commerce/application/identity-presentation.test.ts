import { describe, expect, it } from "vitest";
import { getIdentityPresentation } from "./identity-presentation";

describe("getIdentityPresentation", () => {
  it.each([
    [undefined, "Agrega el ID que recibirá los objetos", "Agregar ID", false, "neutral"],
    [{ status: "manual_review" as const }, "ID en revisión por el equipo", "Ver estado", false, "warning"],
    [{ status: "pending_friendship" as const }, "Solicitud de amistad pendiente", "Ver estado", false, "warning"],
    [{ status: "waiting" as const, giftable_at: "2026-10-20T12:00:00.000Z" }, "Espera de 48 horas en curso", "Ver fecha", false, "warning"],
    [{ status: "ready" as const }, "ID listo para recibir objetos", "Continuar", true, "success"],
    [{ status: "blocked" as const }, "ID no disponible para entrega", "Probar otro ID", false, "danger"],
  ])("presenta cada estado con una acción consistente", (validation, label, actionLabel, canQuote, tone) => {
    expect(getIdentityPresentation(validation)).toMatchObject({ label, actionLabel, canQuote, tone });
  });
});
