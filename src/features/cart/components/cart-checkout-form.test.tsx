import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogItem } from "@/features/catalog/domain/catalog-item";
import { CartCheckoutForm } from "./cart-checkout-form";

const commerce = vi.hoisted(() => ({
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
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/commerce/components/commerce-state-provider", () => ({ useCommerceState: () => commerce }));

const item: CatalogItem = {
  mainId: "item-a", offerId: "offer-a", name: "Objeto vigente", description: "", imageUrl: null,
  type: "Atuendo", rarity: "Raro", regularPriceVbucks: 500, finalPriceVbucks: 500,
  priceMxn: 40, giftable: true, availableUntil: null, featured: false,
};

describe("CartCheckoutForm", () => {
  beforeEach(() => { commerce.authenticated = true; });

  it("muestra la sesión y oculta un login repetido antes de cotizar", () => {
    render(<CartCheckoutForm items={[item]} />);

    expect(screen.getByText("Sesión iniciada")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Iniciar sesión" })).not.toBeInTheDocument();
    expect(screen.getByText("ID y precio").closest("li")).toHaveAttribute("aria-current", "step");
  });

  it("ofrece login opcional al invitado antes de crear la cotización", () => {
    commerce.authenticated = false;
    render(<CartCheckoutForm items={[item]} />);

    expect(screen.getByText("Continuar como invitado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/cuenta?next=/checkout");
    expect(screen.queryByText("Precio confirmado")).not.toBeInTheDocument();
  });
});
