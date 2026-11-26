import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CollectionPrices } from "./collection-prices";
const mocks = vi.hoisted(() => ({ request: vi.fn(), reload: vi.fn(), configured: true }));
vi.mock("./use-admin-request", () => ({
  useAdminRequest: () => mocks.request,
  useAdminData: () => ({ loading: false, error: null, reload: mocks.reload, data: {
    configured: mocks.configured,
    sections: [{ name: "ES HORA DE ANOTAR", count: 28 }, { name: "Hatsune Miku", count: 10 }, { name: "Otros objetos", count: 2 }],
    rules: [{ collection: "Sección anterior", mxn_per_hundred: 10, active: true }],
  } }),
}));
beforeEach(() => { vi.clearAllMocks(); mocks.configured = true; mocks.request.mockResolvedValue({ ok: true }); mocks.reload.mockResolvedValue(undefined); });
afterEach(cleanup);

it("permite elegir la tarifa aunque falte preparar la base, sin intentar guardarla", () => {
  mocks.configured = false;
  render(<CollectionPrices />);
  fireEvent.change(screen.getByRole("combobox", { name: "Colección completa" }), { target: { value: "Hatsune Miku" } });
  const input = screen.getByRole("spinbutton", { name: "MXN por cada 100 paVos" });
  expect(input).toBeEnabled();
  expect(input).toHaveValue(null);
  fireEvent.change(input, { target: { value: "6.25" } });
  expect(input).toHaveValue(6.25);
  expect(screen.getByText(/1,000 paVos = \$63 MXN/)).toBeInTheDocument();
  fireEvent.submit(input.closest("form")!);
  expect(mocks.request).not.toHaveBeenCalled();
});

it("muestra todos los apartados y guarda una única regla para los 28 objetos", async () => {
  render(<CollectionPrices />);
  expect(screen.getByRole("option", { name: "Hatsune Miku · 10 objetos" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Otros objetos · 2 objetos" })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Colección completa" }), { target: { value: "ES HORA DE ANOTAR" } });
  expect(screen.getByText(/Esta regla abarca los 28 objetos/)).toBeInTheDocument();
  const input = screen.getByRole("spinbutton", { name: "MXN por cada 100 paVos" });
  fireEvent.change(input, { target: { value: "7.50" } });
  fireEvent.submit(input.closest("form")!);
  await waitFor(() => expect(mocks.reload).toHaveBeenCalledOnce());
  expect(mocks.request).toHaveBeenCalledOnce();
  expect(JSON.parse(mocks.request.mock.calls[0][1].body)).toEqual({ collection: "ES HORA DE ANOTAR", mxnPerHundred: 7.5, active: true });
});
it("permite desactivar la regla de una sección que salió de tienda", async () => {
  render(<CollectionPrices />);
  const article = screen.getByRole("heading", { name: "Sección anterior" }).closest("article")!;
  expect(within(article).queryByRole("button", { name: "Editar tarifa" })).toBeNull();
  fireEvent.click(within(article).getByRole("button", { name: "Desactivar" }));
  await waitFor(() => expect(mocks.reload).toHaveBeenCalledOnce());
  expect(JSON.parse(mocks.request.mock.calls[0][1].body)).toEqual({ collection: "Sección anterior", mxnPerHundred: 10, active: false });
});
