import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { FavoriteButton } from "./favorite-button";

describe("FavoriteButton", () => {
  beforeEach(() => window.localStorage.clear());

  it("guarda y elimina un favorito localmente", () => {
    render(<FavoriteButton itemId="item-1" itemName="Leon" />);

    const saveButton = screen.getByRole("button", { name: "Guardar Leon en favoritos" });
    fireEvent.click(saveButton);

    expect(window.localStorage.getItem("drop-shop-mx:favorites")).toBe('["item-1"]');
    const removeButton = screen.getByRole("button", { name: "Quitar Leon de favoritos" });
    fireEvent.click(removeButton);
    expect(window.localStorage.getItem("drop-shop-mx:favorites")).toBe("[]");
  });
});
