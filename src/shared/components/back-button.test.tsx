import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackButton } from "./back-button";

const router = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router
}));

describe("BackButton", () => {
  beforeEach(() => {
    router.back.mockReset();
    router.push.mockReset();
  });

  it("regresa al historial cuando la navegación nació en el mismo sitio", () => {
    vi.spyOn(document, "referrer", "get").mockReturnValue(`${window.location.origin}/#catalogo`);

    render(<BackButton />);
    fireEvent.click(screen.getByRole("button", { name: "Volver al catálogo" }));

    expect(router.back).toHaveBeenCalledOnce();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("usa el catálogo como ruta segura cuando no hay historial interno", () => {
    vi.spyOn(document, "referrer", "get").mockReturnValue("https://example.com/landing");

    render(<BackButton />);
    fireEvent.click(screen.getByRole("button", { name: "Volver al catálogo" }));

    expect(router.push).toHaveBeenCalledWith("/#catalogo");
    expect(router.back).not.toHaveBeenCalled();
  });
});
