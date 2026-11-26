import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddToCartButton } from "./add-to-cart-button";

const UNAVAILABLE = "Este objeto ya no está disponible en la tienda.";
const commerce = vi.hoisted(() => ({
  syncing: false,
  cartItemIds: [] as string[],
  addCartItem: vi.fn()
}));

vi.mock("@/features/commerce/components/commerce-state-provider", () => ({
  CART_ITEM_UNAVAILABLE: "Este objeto ya no está disponible en la tienda.",
  useOptionalCommerceState: () => commerce
}));

const item = {
  mainId: "CID_A_454_Athena_Commando_M_Ohana",
  offerId: "offer",
  name: "John Cena",
  imageUrl: null,
  type: "Atuendo",
  rarity: "Épica",
  finalPriceVbucks: 1500,
  priceMxn: 113
};

describe("AddToCartButton", () => {
  beforeEach(() => commerce.addCartItem.mockReset());

  it("avisa que no está disponible cuando el servidor no acepta el objeto", async () => {
    commerce.addCartItem.mockResolvedValue(UNAVAILABLE);
    render(<AddToCartButton item={item} />);

    fireEvent.click(screen.getByRole("button", { name: "Agregar al carrito: John Cena" }));

    const button = await screen.findByRole("button", { name: "No disponible: John Cena" });
    expect(button).toBeDisabled();
    expect(commerce.addCartItem).toHaveBeenCalledWith("CID_A_454_Athena_Commando_M_Ohana");
  });

  it("deja reintentar cuando falla la red", async () => {
    commerce.addCartItem.mockResolvedValue("No fue posible guardar el carrito.");
    render(<AddToCartButton item={item} />);

    fireEvent.click(screen.getByRole("button", { name: "Agregar al carrito: John Cena" }));

    expect(await screen.findByRole("button", { name: "Intenta de nuevo: John Cena" })).toBeEnabled();
  });
});
