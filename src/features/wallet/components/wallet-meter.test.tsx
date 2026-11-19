import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { topupToCover, WalletMeter } from "./wallet-meter";

describe("saldo antes y después de un pedido", () => {
  it("dice cuánto tienes, cuánto se descuenta y cuánto te queda", () => {
    render(<WalletMeter balance={13500} cost={5200} />);
    expect(screen.getByText("Tienes").parentElement).toHaveTextContent("13,500");
    expect(screen.getByText("Este pedido").parentElement).toHaveTextContent("−5,200");
    expect(screen.getByText("Te quedan").parentElement).toHaveTextContent("8,300");
    expect(screen.getByRole("img")).toHaveAccessibleName("Este pedido usa 39% de tu saldo; te quedan 8,300 pavos.");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("si no alcanza, dice cuánto falta y lleva a recargar justo eso", () => {
    render(<WalletMeter balance={1000} cost={2850} />);
    expect(screen.getByText("Te faltan").parentElement).toHaveTextContent("1,850");
    expect(screen.getByRole("link", { name: "Recargar 1,900 pavos" })).toHaveAttribute("href", "/pavos?cantidad=1900#recargar");
  });

  it("la recarga sugerida respeta múltiplos de 100 y los límites", () => {
    expect(topupToCover(1)).toBe(100);
    expect(topupToCover(1850)).toBe(1900);
    expect(topupToCover(80000)).toBe(50000);
  });
});
