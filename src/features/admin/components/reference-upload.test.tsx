import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ReferenceUpload } from "./reference-upload";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./use-admin-request", () => ({
  useAdminRequest: () => request,
  useAdminData: () => ({ data: { orders: [
    { id: "order-a", epic_display_name: "Mr_gorrion_28", order_items: [{ item_name: "Oscar el Corsario" }] },
    { id: "order-b", epic_display_name: "Mr_gorrion_28", order_items: [{ item_name: "Miaudas" }] },
  ] }, loading: false, error: null }),
}));

it("muestra usuario y objetos y envía el pedido seleccionado aunque el usuario tenga varias entregas", async () => {
  request.mockResolvedValue({ ok: true });
  const onPublished = vi.fn().mockResolvedValue(undefined);
  render(<ReferenceUpload onPublished={onPublished} />);
  const select = screen.getByRole("combobox", { name: "Usuario y objetos entregados" });
  expect(screen.getByRole("option", { name: "Mr_gorrion_28 · Miaudas" })).toBeInTheDocument();
  expect(screen.queryByText("order-b")).not.toBeInTheDocument();
  fireEvent.change(select, { target: { value: "order-b" } });
  fireEvent.submit(select.closest("form")!);
  await waitFor(() => expect(onPublished).toHaveBeenCalledOnce());
  expect(request.mock.calls[0][1].body.get("orderId")).toBe("order-b");
  expect(select).toHaveValue("");
});
