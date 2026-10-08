"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useCommerceState } from "@/features/commerce/components/commerce-state-provider";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";

type CustomerOrder = { id: string; status: string; item_name: string; amount_mxn_cents: number; public_token: string; created_at: string };

function orderLabel(status: string) {
  if (status === "delivered") return "Recibido";
  if (["ready_to_send", "validating_delivery", "delivering", "paid"].includes(status)) return "Procesando";
  if (["rejected", "refunded", "canceled", "expired"].includes(status)) return "Requiere atención";
  if (["receipt_submitted", "transfer_review"].includes(status)) return "Comprobante en revisión";
  return "Pendiente de pago";
}

export function AccountAccess({ nextPath = "/cuenta", adminAccess = false }: { nextPath?: string; adminAccess?: boolean }) {
  const commerce = useCommerceState();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [checking, setChecking] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase || !commerce.ready) return;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setChecking(false); return; }
      const { data: orderRows } = await supabase.from("orders")
        .select("id,status,item_name,amount_mxn_cents,public_token,created_at")
        .order("created_at", { ascending: false });
      setOrders(orderRows ?? []);
      setChecking(false);
    });
  }, [commerce.ready, supabase]);

  async function authenticate(event: FormEvent) {
    event.preventDefault();
    if (!supabase) { setMessage("El acceso todavía no está configurado."); return; }
    setSubmitting(true);
    setMessage(null);
    if (adminAccess || authMode === "login") {
      const login = adminAccess || identifier.includes("@") ? identifier.trim().toLowerCase() : `${identifier.trim().toLowerCase()}@accounts.sigfriedlootbox.local`;
      const { error } = await supabase.auth.signInWithPassword({ email: login, password });
      if (error) { setMessage(adminAccess ? "Correo o contraseña incorrectos." : "Usuario o contraseña incorrectos."); setSubmitting(false); return; }
      window.location.assign(nextPath);
      return;
    }
    const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: identifier, password }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setMessage(body.error ?? "No fue posible crear la cuenta.");
    else {
      const { error } = await supabase.auth.signInWithPassword({ email: body.login, password });
      if (error) setMessage("La cuenta se creó, pero no pudimos iniciar sesión.");
      else { window.location.assign(nextPath); return; }
    }
    setSubmitting(false);
  }

  if (checking) return <div className="account-card"><p>Cargando tu cuenta…</p></div>;
  if (orders) return <div className="account-dashboard">
    <div className="account-welcome"><div><p className="eyebrow">MI DASHBOARD</p><h2>Tu cuenta está lista.</h2></div><button type="button" onClick={() => void supabase?.auth.signOut().then(() => window.location.reload())}>Cerrar sesión</button></div>
    <div className="dashboard-grid">
      <button type="button" className="dashboard-card profile-card" onClick={commerce.openIdentity}><span className="dashboard-icon">◎</span><div><small>ID PARA RECIBIR</small><strong>{commerce.validation?.display_name ?? "Agregar mi ID"}</strong><p>{commerce.validation?.status === "ready" ? "ID validado · listo para comprar" : commerce.validation?.status === "waiting" ? "Solicitud enviada · espera de 48 h →" : commerce.validation?.status === "manual_review" ? "En revisión manual →" : "Agregar ID →"}</p></div></button>
      <Link href="/favoritos" className="dashboard-card"><span className="dashboard-icon">♡</span><div><small>FAVORITOS</small><strong>{commerce.favoriteItemIds.size} objetos</strong><p>Ver disponibilidad →</p></div></Link>
      <section className="dashboard-card"><span className="dashboard-icon">✓</span><div><small>OBJETOS RECIBIDOS</small><strong>{orders.filter((order) => order.status === "delivered").length}</strong><p>Entregas confirmadas</p></div></section>
    </div>
    <section className="orders-panel"><div className="orders-heading"><div><p className="eyebrow">MIS COMPRAS</p><h3>Estado de tus pedidos</h3></div><Link href="/#catalogo">Ir a la tienda</Link></div>{orders.length === 0 ? <p className="empty-orders">Aún no tienes pedidos asociados a esta cuenta.</p> : orders.map((order) => <Link className="account-order" key={order.id} href={`/pedidos/${order.id}?access=${order.public_token}`}><span><b>Pedido #{order.id.slice(0, 8).toUpperCase()}</b><small>{new Date(order.created_at).toLocaleDateString("es-MX")} · Ver compra y objetos</small></span><strong className={`order-${order.status}`}>{orderLabel(order.status)}</strong></Link>)}</section>
  </div>;

  if (adminAccess) return <form className="account-card register-card" onSubmit={authenticate}><p className="eyebrow">ACCESO RESTRINGIDO</p><h2>Panel de administración</h2><p>Ingresa con el correo y la contraseña de una cuenta autorizada.</p><label>Correo de administrador<input type="email" required value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="tu@correo.com" autoComplete="email" /></label><label>Contraseña<input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label><button className="primary-button" disabled={submitting}>{submitting ? "Entrando…" : "Entrar al panel"}</button>{message && <p className="notice">{message}</p>}<small className="account-note">Solo las cuentas con rol de administrador pueden continuar.</small></form>;

  return <form className="account-card register-card" onSubmit={authenticate}><p className="eyebrow">{authMode === "login" ? "INICIA SESIÓN" : "CREA TU CUENTA"}</p><h2>Tu cuenta SigfriedLootBox</h2><p>Usa un nombre de usuario y contraseña para conservar tu ID validado, favoritos, carrito e historial. No enviamos correos.</p><label>Nombre de usuario<input type="text" required minLength={3} maxLength={authMode === "register" ? 24 : 120} pattern={authMode === "register" ? "[A-Za-z0-9_-]{3,24}" : undefined} value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="tu_usuario" autoComplete="username" /></label><label>Contraseña<input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={authMode === "login" ? "current-password" : "new-password"} /></label><button className="primary-button" disabled={submitting}>{submitting ? "Procesando…" : authMode === "login" ? "Iniciar sesión" : "Crear cuenta"}</button>{message && <p className="notice">{message}</p>}<button className="identity-account-button" type="button" onClick={() => { setAuthMode((current) => current === "login" ? "register" : "login"); setMessage(null); }}>{authMode === "login" ? "Crear una cuenta" : "Ya tengo cuenta"}</button><button className="identity-account-button" type="button" onClick={commerce.openIdentity}>Validar mi ID sin crear cuenta</button><small className="account-note">No necesitas correo. Tu nombre de usuario identifica la cuenta.</small></form>;
}
