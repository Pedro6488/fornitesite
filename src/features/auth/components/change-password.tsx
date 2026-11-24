"use client";

import { useState, type FormEvent } from "react";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";
import { PasswordField } from "./password-field";

export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function clear() { setPassword(""); setConfirmation(""); setOpen(false); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (password.length < 8 || password.length > 72) { setMessage("Usa entre 8 y 72 caracteres."); return; }
    if (password !== confirmation) { setMessage("Las contraseñas no coinciden."); return; }
    setBusy(true); setMessage("");
    try {
      const client = getSupabaseBrowser();
      if (!client) throw new Error("El servicio de acceso no está disponible.");
      // La API de sesión actual solo puede cambiar la contraseña del usuario autenticado.
      const { error } = await client.auth.updateUser({ password });
      if (error) { setMessage("No se pudo cambiar la contraseña. Comprueba que cumpla los requisitos de seguridad. Si tu sesión expiró, vuelve a iniciar sesión."); return; }
      clear();
      setMessage("Tu contraseña se actualizó. Usa la nueva contraseña la próxima vez que inicies sesión.");
    } catch { setMessage("No fue posible conectar. Intenta de nuevo."); }
    finally { setBusy(false); }
  }

  return <section className="account-card" aria-labelledby="account-password-heading" style={{ marginTop: 24 }}>
    <h2 id="account-password-heading">Contraseña de tu cuenta</h2>
    <p>Si el administrador te asignó una contraseña, aquí puedes reemplazarla por una que elijas.</p>
    {!open ? <button className="primary-button" type="button" onClick={() => { setOpen(true); setMessage(""); }}>Cambiar contraseña</button> : <form onSubmit={submit} style={{ display: "grid", gap: 16, maxWidth: 520 }}>
      <PasswordField label="Nueva contraseña" value={password} onChange={setPassword} disabled={busy} />
      <PasswordField label="Confirmar nueva contraseña" value={confirmation} onChange={setConfirmation} disabled={busy} />
      <small>Entre 8 y 72 caracteres.</small>
      <button className="primary-button" type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar mi contraseña"}</button>
      <button type="button" disabled={busy} onClick={() => { clear(); setMessage(""); }}>Cancelar</button>
    </form>}
    {message && <p className="notice" role="status">{message}</p>}
  </section>;
}
