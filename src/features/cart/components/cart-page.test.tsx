import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogItem } from "@/features/catalog/domain/catalog-item";
import { CartPage } from "./cart-page";

const router = vi.hoisted(() => ({ push: vi.fn() }));
const commerce = vi.hoisted(() => ({
  ready: true,
  authenticated: false,
  syncing: false,
  cartItemIds: ["available", "expired", "missing"],
  validation: null,
  removeCartItem: vi.fn().mockResolvedValue(null)
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/commerce/components/commerce-state-provider", () => ({
  useCommerceState: () => commerce
}));

const item = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  mainId: "available",
  offerId: "offer",
  name: "Objeto vigente",
  description: "",
  imageUrl: null,
  type: "Atuendo",
  rarity: "Raro",
  regularPriceVbucks: 500,
  finalPriceVbucks: 500,
  priceMxn: 40,
  giftable: true,
  availableUntil: null,
  featured: false,
  ...overrides
});

describe("CartPage", () => {
  beforeEach(() => {
    router.push.mockReset();
    commerce.removeCartItem.mockClear();
  });

  it("muestra los objetos caducados y permite quitarlos juntos", async () => {
    render(<CartPage items={[
      item(),
      item({ mainId: "expired", name: "Objeto vencido", availableUntil: "2000-01-01T00:00:00.000Z" })
    ]} />);

    expect(screen.getByText("Objeto vencido")).toBeInTheDocument();
    expect(screen.getByText("Objeto ya no disponible")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hay objetos no disponibles" })).toBeDisabled();
    expect(screen.getByText("ID y precio")).toBeInTheDocument();
    expect(screen.getByText("Carrito").closest("span")).toHaveAttribute("aria-current", "step");

    fireEvent.click(screen.getByRole("button", { name: "Quitar no disponibles" }));
    await waitFor(() => expect(commerce.removeCartItem).toHaveBeenCalledWith("expired"));
  });
});
