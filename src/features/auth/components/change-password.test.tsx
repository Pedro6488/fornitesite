import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ChangePassword } from "./change-password";

const { updateUser } = vi.hoisted(() => ({ updateUser: vi.fn() }));
vi.mock("@/shared/infrastructure/supabase/browser", () => ({ getSupabaseBrowser: () => ({ auth: { updateUser } }) }));
beforeEach(() => { updateUser.mockReset(); updateUser.mockResolvedValue({ error: null }); });
afterEach(cleanup);

function openForm() {
  render(<ChangePassword />);
  fireEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
  return screen.getByLabelText("Nueva contraseña");
}

it("muestra y oculta lo escrito sin enviar el formulario", () => {
  const input = openForm();
  fireEvent.change(input, { target: { value: "clave-temporal" } });
  expect(input).toHaveAttribute("type", "password");
  fireEvent.click(screen.getByRole("button", { name: "Mostrar nueva contraseña" }));
  expect(input).toHaveAttribute("type", "text");
  expect(input).toHaveValue("clave-temporal");
  fireEvent.click(screen.getByRole("button", { name: "Ocultar nueva contraseña" }));
  expect(input).toHaveAttribute("type", "password");
  expect(updateUser).not.toHaveBeenCalled();
});

it("rechaza confirmación distinta sin llamar al proveedor", () => {
  const input = openForm();
  fireEvent.change(input, { target: { value: "mi-nueva-clave" } });
  fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), { target: { value: "otra-clave" } });
  fireEvent.submit(input.closest("form")!);
  expect(screen.getByRole("status")).toHaveTextContent("no coinciden");
  expect(updateUser).not.toHaveBeenCalled();
});

it("cambia solo la contraseña de la sesión actual y limpia los campos", async () => {
  const input = openForm();
  for (const label of ["Nueva contraseña", "Confirmar nueva contraseña"]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: "mi-clave-personal" } });
  }
  fireEvent.submit(input.closest("form")!);
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("se actualizó"));
  expect(updateUser).toHaveBeenCalledExactlyOnceWith({ password: "mi-clave-personal" });
  fireEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
  expect(screen.getByLabelText("Nueva contraseña")).toHaveValue("");
});

it("no anuncia éxito si Supabase rechaza el cambio", async () => {
  updateUser.mockResolvedValue({ error: { message: "expired" } });
  const input = openForm();
  for (const label of ["Nueva contraseña", "Confirmar nueva contraseña"]) fireEvent.change(screen.getByLabelText(label), { target: { value: "mi-clave-personal" } });
  fireEvent.submit(input.closest("form")!);
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No se pudo"));
});
