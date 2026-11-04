import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReferenceGallery } from "./reference-gallery";

describe("ReferenceGallery", () => {
  it("cambia la evidencia principal desde las miniaturas", () => {
    render(<ReferenceGallery images={["/uno.png", "/dos.png"]} owner="Jugador" />);

    const stage = screen.getByRole("button", { name: "Ampliar evidencia 1 de jugador" });
    expect(stage.querySelector(".reference-stage-image")).toHaveAttribute("src", "/uno.png");

    fireEvent.click(screen.getByRole("button", { name: "Ver evidencia 2 de 2" }));

    const updated = screen.getByRole("button", { name: "Ampliar evidencia 2 de jugador" });
    expect(updated.querySelector(".reference-stage-image")).toHaveAttribute("src", "/dos.png");
    expect(screen.getByRole("button", { name: "Ver evidencia 2 de 2" })).toHaveAttribute("aria-pressed", "true");
  });

  it("no muestra miniaturas cuando solo hay una evidencia", () => {
    render(<ReferenceGallery images={["/uno.png"]} owner="Jugador" />);

    expect(screen.queryByRole("button", { name: /Ver evidencia/ })).not.toBeInTheDocument();
  });
});
