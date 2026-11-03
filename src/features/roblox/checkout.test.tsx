import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RobloxCheckout } from "./checkout";

describe("RobloxCheckout", () => {
  afterEach(() => vi.restoreAllMocks());

  it("solicita un código canjeable con precio y teléfono sin pedir una cuenta", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<RobloxCheckout pack={{ robux: 7500, price: 1650 }} whatsapp="5215619857749" />);
    fireEvent.change(screen.getByLabelText("Tu WhatsApp"), { target: { value: "5612345678" } });
    expect(screen.queryByLabelText("Nombre de usuario de Roblox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("button").closest("form")!);
    const url = new URL(String(open.mock.calls[0][0]));
    expect(url.hostname).toBe("wa.me");
    expect(url.pathname).toBe("/5215619857749");
    const message = url.searchParams.get("text");
    expect(message).toContain("7,500 Robux");
    expect(message).toContain("$1,650.00 MXN");
    expect(message).toContain("Código canjeable: 7,500 Robux");
    expect(message).not.toContain("Usuario de Roblox");
    expect(message).toContain("+525612345678");
  });

  it("bloquea solicitudes incompletas aunque el formulario sea enviado directamente", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<RobloxCheckout pack={{ robux: 200, price: 60 }} whatsapp="5215619857749" />);
    fireEvent.submit(screen.getByRole("button").closest("form")!);
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
