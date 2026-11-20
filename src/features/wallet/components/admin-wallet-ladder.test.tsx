import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TierLadder } from "./admin-wallet-ladder";

const pedro = { region: "mx" as const, cents_per_100: 1000, active: true, cost_cents_per_100: 1000, min_margin_bp: 100 };
const priced = { region: "mx" as const, cents_per_100: 900, active: true, cost_cents_per_100: 600, min_margin_bp: 1000 };
const fill = (step: number, min: string, price: string) => {
  fireEvent.change(screen.getByLabelText(`Escalón ${step}: desde cuántos pavos`), { target: { value: min } });
  fireEvent.change(screen.getByLabelText(`Escalón ${step}: precio por 100 pavos`), { target: { value: price } });
};

describe("escalera de precio por volumen", () => {
  it("muestra 4 escalones vacíos para llenar a la vez", () => {
    render(<TierLadder region="mx" rate={priced} tiers={[]} onSave={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getAllByLabelText(/desde cuántos pavos/)).toHaveLength(4);
    expect(screen.getByText(/Precio mínimo permitido/)).toHaveTextContent("$6.60");
  });

  it("caso de Pedro: $8 con costo $10 explica el mínimo junto a la fila y no envía nada", async () => {
    const onSave = vi.fn();
    render(<TierLadder region="mx" rate={pedro} tiers={[]} onSave={onSave} onSaved={vi.fn()} />);
    fill(1, "600", "8");
    expect(screen.getByRole("alert")).toHaveTextContent("Mínimo permitido: $10.10");
    fireEvent.click(screen.getByRole("button", { name: "Guardar escalera" }));
    expect(await screen.findByText("Corrige los escalones marcados antes de guardar.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("guarda 4 escalones que bajan de precio y muestra lo que pagará el cliente", async () => {
    const onSave = vi.fn().mockResolvedValue(null);
    const onSaved = vi.fn().mockResolvedValue(undefined);
    render(<TierLadder region="mx" rate={priced} tiers={[]} onSave={onSave} onSaved={onSaved} />);
    fill(1, "1000", "8.5"); fill(2, "2800", "8"); fill(3, "5000", "7.5"); fill(4, "13500", "7");
    const row = screen.getByRole("row", { name: /5,000 pavos/ });
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["$375.00 MXN", "$7.50 MXN", "−16.7%"]);
    fireEvent.click(screen.getByRole("button", { name: "Guardar escalera" }));
    expect(await screen.findByText("Escalera guardada. Aplica a las recargas nuevas.")).toBeInTheDocument();
    expect(onSave.mock.calls.map(([body]) => [body.minVbucks, body.centsPer100])).toEqual([[1000, 850], [2800, 800], [5000, 750], [13500, 700]]);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("si el servidor rechaza un escalón, el error sale en esa fila", async () => {
    const onSave = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce("Con este precio o bono vendes debajo del margen mínimo.");
    render(<TierLadder region="mx" rate={priced} tiers={[]} onSave={onSave} onSaved={vi.fn().mockResolvedValue(undefined)} />);
    fill(1, "1000", "8.5"); fill(2, "2800", "8");
    fireEvent.click(screen.getByRole("button", { name: "Guardar escalera" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("vendes debajo del margen mínimo"));
    expect(screen.getByRole("status")).toHaveTextContent("Se guardaron 1 escalones. No se pudieron guardar los marcados en rojo.");
  });

  it("no reenvía escalones sin cambios", async () => {
    const onSave = vi.fn();
    render(<TierLadder region="mx" rate={priced} tiers={[{ id: "t1", region: "mx", min_vbucks: 1000, cents_per_100: 850, active: true }]} onSave={onSave} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Guardar escalera" }));
    expect(await screen.findByText("No hay cambios por guardar.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
