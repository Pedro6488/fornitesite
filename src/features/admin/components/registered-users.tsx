"use client";

import { useState, type FormEvent } from "react";
import { AdminPageHeader } from "./admin-shell";
import { useAdminData, useAdminRequest } from "./use-admin-request";
import { formatDateTime } from "../application/format";
import styles from "./registered-users.module.css";
import { PasswordField } from "@/features/auth/components/password-field";

type Account = { id: string; login: string; type: string; createdAt: string; lastSignInAt: string | null };
type Accounts = { users: Account[]; page: number; nextPage: number | null };

export function RegisteredUsers() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAdminData<Accounts>(`/api/admin/users?page=${page}`);
  const [selected, setSelected] = useState<Account | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const request = useAdminRequest();

  function close() { setSelected(null); setPassword(""); setConfirmation(""); }
  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (!selected || busy) return;
    if (password !== confirmation) { setMessage("Las contraseñas no coinciden."); return; }
    setBusy(true); setMessage("");
    try {
      const result = await request<{ warning: string | null }>(`/api/admin/users/${selected.id}/password`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
      });
      setMessage(result.warning ?? `Contraseña actualizada para ${selected.login}. Ya puede iniciar sesión con la nueva contraseña.`);
      close();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "No se cambió la contraseña."); }
    finally { setBusy(false); }
  }

  return <>
    <AdminPageHeader title="Usuarios registrados" lead="Cuentas de acceso a la página, incluidas las que todavía no han comprado."
      actions={<button className="ac-ghost" disabled={loading || busy} onClick={() => void reload()}>Actualizar</button>} />
    {error && <p className="ac-notice is-error" role="alert">{error}</p>}
    {message && <p className="ac-notice" role="status">{message}</p>}
    {selected && <section className="ac-card" aria-labelledby="password-heading">
      <h2 id="password-heading">Cambiar contraseña de {selected.login}</h2>
      <p>Establece una nueva contraseña para esta cuenta. La contraseña actual no se puede consultar.</p>
      <form className={styles.form} onSubmit={changePassword}>
        <PasswordField label="Nueva contraseña" value={password} onChange={setPassword} disabled={busy} />
        <PasswordField label="Confirmar nueva contraseña" value={confirmation} onChange={setConfirmation} disabled={busy} />
        <p>El usuario podrá reemplazarla después de iniciar sesión, en Mi cuenta → Cambiar contraseña.</p>
        <div className={styles.actions}>
          <button className="ac-ghost" type="button" disabled={busy} onClick={close}>Cancelar</button>
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar nueva contraseña"}</button>
        </div>
      </form>
    </section>}
    {loading && <p role="status">Cargando cuentas…</p>}
    {!loading && data?.users.length === 0 && <p className="ac-empty">No hay cuentas en esta página.</p>}
    <div className={styles.list} aria-label="Cuentas registradas" aria-busy={loading}>
      {data?.page === page && data.users.map((account) => <article key={account.id} className={`ac-card ${styles.account}`}>
        <div><h2 className={styles.login}>{account.login}</h2><p>Acceso con {account.type.toLowerCase()}</p>
          <p>Registro: {formatDateTime(account.createdAt)}</p>
          <p>Último acceso: {account.lastSignInAt ? formatDateTime(account.lastSignInAt) : "Todavía no inicia sesión"}</p>
        </div>
        <button className="ac-ghost" disabled={busy || loading} onClick={() => { close(); setSelected(account); setMessage(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Cambiar contraseña</button>
      </article>)}
    </div>
    <nav className={styles.actions} aria-label="Páginas de usuarios">
      <button className="ac-ghost" disabled={page === 1 || loading || busy} onClick={() => { close(); setPage(page - 1); }}>Anterior</button>
      <span>Página {page}</span>
      <button className="ac-ghost" disabled={!data || data.page !== page || data.nextPage === null || loading || busy} onClick={() => { close(); setPage(data!.nextPage!); }}>Siguiente</button>
    </nav>
  </>;
}
