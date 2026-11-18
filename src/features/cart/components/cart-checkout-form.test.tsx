import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogItem } from "@/features/catalog/domain/catalog-item";
import { CartCheckoutForm } from "./cart-checkout-form";

const commerce = vi.hoisted(() => ({
  sessionId: "session-a",
  whatsapp: "525512345678" as string | null,
  email: "cliente@example.com" as string | null,
  ready: true,
  authenticated: true,
  syncing: false,
  cartItemIds: ["item-a"],
  validation: {
    id: "validation-a",
    platform: "epic",
    submitted_id: "Player",
    epic_account_id: "epic-a",
    display_name: "Player",
    status: "ready" as const,
    giftable_at: null,
    last_checked_at: "2026-10-18T10:00:00.000Z",
  },
  openIdentity: vi.fn(),
  removeCartItem: vi.fn().mockResolvedValue(null),
  clearCart: vi.fn(),
  refresh: vi.fn().mockResolvedValue(undefined),
}));
const wallet = vi.hoisted(() => ({ balance:1000, frozen:false, paused:false }));
vi.mock("@/features/wallet/components/use-wallet", () => ({ useWallet:() => ({ data:{ balance:wallet.balance,frozen:wallet.frozen,paused:wallet.paused,automaticDelivery:true },error:null }) }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/commerce/components/commerce-state-provider", () => ({ useCommerceState: () => commerce }));

const item: CatalogItem = {
  mainId: "item-a", offerId: "offer-a", name: "Objeto vigente", description: "", imageUrl: null,
  type: "Atuendo", rarity: "Raro", regularPriceVbucks: 500, finalPriceVbucks: 500,
  priceMxn: 40, giftable: true, availableUntil: null, featured: false,
};

describe("CartCheckoutForm", () => {
  beforeEach(() => {
    commerce.authenticated = true;
    wallet.balance=1000; wallet.frozen=false; wallet.paused=false;
    commerce.sessionId = "session-a";
    commerce.whatsapp = "525512345678";
    commerce.email = "cliente@example.com";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => url === "/api/cart-orders" ? { order:{ id:"order-a",publicToken:"public-token" } } : url === "/api/customer-email" ? {} : { quote: {
      id: "quote-a", currency: "MXN", amountMxnCents: 4000, expiresAt: "2099-01-01T00:00:00Z", lines: [{ itemMainId: "item-a", name: "Objeto vigente", vbucksPrice: 500, amountMxnCents: 4000 }],
    } } })));
  });

  async function openContact() {
    fireEvent.click(screen.getByRole("button", { name: "Confirmar precio y continuar" }));
    return screen.findByLabelText("WhatsApp de contacto");
  }

  it("no permite pagar ni enviar si los pavos no cubren todo el pedido", async () => {
    wallet.balance=100;
    render(<CartCheckoutForm items={[item]} />); await openContact();
    fireEvent.click(screen.getByRole("radio",{ name:"Mis pavos de la tienda" }));
    expect(screen.getByRole("button",{ name:"Pagar con mis pavos y enviar" })).toBeDisabled();
    expect(screen.getByText(/No alcanza el saldo para todo el pedido/)).toBeInTheDocument();
  });

  it("bloquea el pago con pavos si la cuenta está congelada aunque alcance el saldo", async () => {
    wallet.frozen=true;
    render(<CartCheckoutForm items={[item]} />); await openContact();
    fireEvent.click(screen.getByRole("radio",{ name:"Mis pavos de la tienda" }));
    expect(screen.getByRole("button",{ name:"Pagar con mis pavos y enviar" })).toBeDisabled();
    expect(screen.getByText(/Tu saldo está en revisión/)).toBeInTheDocument();
  });

  it("bloquea el pago con pavos mientras está pausado por una falla de la cuenta emisora", async () => {
    wallet.paused=true;
    render(<CartCheckoutForm items={[item]} />); await openContact();
    fireEvent.click(screen.getByRole("radio",{ name:"Mis pavos de la tienda" }));
    expect(screen.getByRole("button",{ name:"Pagar con mis pavos y enviar" })).toBeDisabled();
    expect(screen.getByText(/está pausado unos minutos/)).toBeInTheDocument();
  });

  it("envía únicamente el método pavos y permite volver al pago habitual",async () => {
    render(<CartCheckoutForm items={[item]} />); await openContact();
    const external=screen.getByRole("radio",{ name:"Transferencia bancaria" });
    fireEvent.click(screen.getByRole("radio",{ name:"Mis pavos de la tienda" }));
    expect(external).not.toBeChecked();
    expect(screen.getByRole("button",{ name:"Pagar con mis pavos y enviar" })).toBeEnabled();
    fireEvent.click(external);
    expect(screen.getByRole("radio",{ name:"Mis pavos de la tienda" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("radio",{ name:"Mis pavos de la tienda" }));
    fireEvent.click(screen.getByRole("button",{ name:"Pagar con mis pavos y enviar" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/cart-orders",expect.objectContaining({ body:expect.stringContaining('"paymentSource":"wallet"') })));
  });

  it("autocompleta el correo y permite editarlo sin trasladarlo a otra sesión", async () => {
    const { rerender } = render(<CartCheckoutForm items={[item]} />);
    await openContact();
    const input = screen.getByRole("textbox", { name: /Correo electrónico/ });
    expect(input).toHaveValue("cliente@example.com");
    fireEvent.change(input, { target: { value: "nuevo@example.com" } });
    expect(input).toHaveValue("nuevo@example.com");
    commerce.sessionId = "session-b";
    commerce.email = null;
    rerender(<CartCheckoutForm items={[item]} />);
    expect(input).toHaveValue("");
  });

  it("recupera el teléfono guardado y limita las modificaciones a doce dígitos", async () => {
    render(<CartCheckoutForm items={[item]} />);
    const input = await openContact();
    expect(input).toHaveValue("525512345678");
    expect(input).toHaveAttribute("maxlength", "12");
    fireEvent.change(input, { target: { value: "+52 (55) 9876-5432 999" } });
    expect(input).toHaveValue("525598765432");
  });

  it("no reutiliza un teléfono editado al cambiar de sesión", async () => {
    const { rerender } = render(<CartCheckoutForm items={[item]} />);
    const input = await openContact();
    fireEvent.change(input, { target: { value: "5512345678" } });
    commerce.sessionId = "session-b";
    commerce.whatsapp = null;
    rerender(<CartCheckoutForm items={[item]} />);
    expect(input).toHaveValue("");
  });

  it("mantiene la sesión activa fuera del contenido del checkout", () => {
    render(<CartCheckoutForm items={[item]} />);

    expect(screen.queryByText("Sesión iniciada")).not.toBeInTheDocument();
    expect(screen.queryByText("Compra sin crear una cuenta")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Prefiero iniciar sesión" })).not.toBeInTheDocument();
    expect(screen.getByText("ID y precio").closest("li")).toHaveAttribute("aria-current", "step");
  });

  it("ofrece login opcional al invitado antes de crear la cotización", () => {
    commerce.authenticated = false;
    render(<CartCheckoutForm items={[item]} />);

    expect(screen.getByText("Compra sin crear una cuenta")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Prefiero iniciar sesión" })).toHaveAttribute("href", "/cuenta?next=/checkout");
    expect(screen.queryByText("Precio confirmado")).not.toBeInTheDocument();
  });
});
