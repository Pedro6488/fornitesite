"use client";

import Link from "next/link";
import { BadgeCheck, CircleAlert, Clock3, Gamepad2, Heart, PackageCheck, Plus, ScanLine } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCommerceState } from "@/features/commerce/components/commerce-state-provider";
import { getIdentityPresentation } from "@/features/commerce/application/identity-presentation";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";

type CustomerOrder = { id: string; status: string; item_name: string; amount_mxn_cents: number; public_token: string; created_at: string };
type AccountTab = "identities" | "orders" | "favorites";

function orderLabel(status: string) {
  if (status === "delivered") return "Recibido";
  if (["ready_to_send", "validating_delivery", "delivering", "paid"].includes(status)) return "Procesando";
  if (["rejected", "refunded", "canceled", "expired"].includes(status)) return "Requiere atención";
  if (["receipt_submitted", "transfer_review"].includes(status)) return "Comprobante en revisión";
  return "Pendiente de pago";
}

export function AccountAccess({ nextPath = "/cuenta", adminAccess = false, initialMode = "login" }: { nextPath?: string; adminAccess?: boolean; initialMode?: "login" | "register" }) {
  const commerce = useCommerceState();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">(initialMode);
  const [activeTab, setActiveTab] = useState<AccountTab>("identities");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [checking, setChecking] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase || !commerce.ready) return;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setChecking(false); return; }
      if (!adminAccess && nextPath !== "/cuenta") {
        window.location.replace(nextPath);
        return;
      }
      const { data: orderRows } = await supabase.from("orders")
        .select("id,status,item_name,amount_mxn_cents,public_token,created_at")
        .order("created_at", { ascending: false });
      setOrders(orderRows ?? []);
      setChecking(false);
    });
  }, [adminAccess, commerce.ready, nextPath, supabase]);

  const identity = getIdentityPresentation(commerce.validation);

  async function selectAccountIdentity(validationId: string) {
    setMessage(await commerce.selectValidation(validationId));
  }

  function moveAccountTab(event: ReactKeyboardEvent<HTMLButtonElement>, currentTab: AccountTab) {
    const tabs: AccountTab[] = ["identities", "orders", "favorites"];
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = (tabs.indexOf(currentTab) + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const nextTab: AccountTab = event.key === "Home" ? "identities"
      : event.key === "End" ? "favorites"
        : tabs[nextIndex] ?? "identities";
    setActiveTab(nextTab);
    window.requestAnimationFrame(() => document.getElementById(`account-tab-${nextTab}`)?.focus());
  }

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
    <div className="account-welcome"><p className="eyebrow">MI CUENTA</p><h2>Administra tu experiencia de compra.</h2><p>Cambia de sección sin perder el ID seleccionado para tu próxima entrega.</p></div>
    <div className="account-tabs" role="tablist" aria-label="Secciones de mi cuenta">
      <button id="account-tab-identities" type="button" role="tab" aria-selected={activeTab === "identities"} aria-controls="account-panel-identities" tabIndex={activeTab === "identities" ? 0 : -1} onKeyDown={(event) => moveAccountTab(event, "identities")} onClick={() => setActiveTab("identities")}><Gamepad2 aria-hidden="true" size={17} /><span>Destinatarios</span><b>{commerce.validations.length}</b></button>
      <button id="account-tab-orders" type="button" role="tab" aria-selected={activeTab === "orders"} aria-controls="account-panel-orders" tabIndex={activeTab === "orders" ? 0 : -1} onKeyDown={(event) => moveAccountTab(event, "orders")} onClick={() => setActiveTab("orders")}><PackageCheck aria-hidden="true" size={17} /><span>Mis compras</span><b>{orders.length}</b></button>
      <button id="account-tab-favorites" type="button" role="tab" aria-selected={activeTab === "favorites"} aria-controls="account-panel-favorites" tabIndex={activeTab === "favorites" ? 0 : -1} onKeyDown={(event) => moveAccountTab(event, "favorites")} onClick={() => setActiveTab("favorites")}><Heart aria-hidden="true" size={17} /><span>Favoritos</span><b>{commerce.favoriteItemIds.size}</b></button>
    </div>
    <section id="account-panel-identities" className={`account-identity-panel account-tab-panel ${identity.tone}`} role="tabpanel" aria-labelledby="account-tab-identities" hidden={activeTab !== "identities"}>
      <header><div className="account-identity-heading"><span><Gamepad2 aria-hidden="true" size={21} /></span><div><p className="eyebrow">DESTINATARIOS</p><h3>¿Quién recibirá tu próxima compra?</h3><p>Elige un ID guardado o agrega otro destinatario.</p></div></div></header>
      <div className="account-identity-list">
        {commerce.validations.map((validation) => {
          const entry = getIdentityPresentation(validation);
          const EntryIcon = entry.tone === "success" ? BadgeCheck : entry.tone === "danger" ? CircleAlert : entry.tone === "warning" ? Clock3 : ScanLine;
          const active = commerce.validation?.id === validation.id;
          return <button type="button" className={`account-identity-option ${entry.tone} ${active ? "active" : ""}`} key={validation.id} aria-pressed={active} disabled={commerce.syncing} onClick={() => void selectAccountIdentity(validation.id)}>
            <span className="account-identity-status"><EntryIcon aria-hidden="true" size={18} /></span><span><strong>{validation.display_name}</strong><small>{entry.label}</small></span>{active && <b>Activo</b>}
          </button>;
        })}
        <button type="button" className="account-add-identity" onClick={commerce.openIdentity}><span><Plus aria-hidden="true" size={18} /></span><span><strong>Agregar otro ID</strong><small>Registra un nuevo destinatario</small></span></button>
      </div>
      {message && <p className="notice error">{message}</p>}
    </section>
    <section id="account-panel-orders" className="orders-panel account-tab-panel" role="tabpanel" aria-labelledby="account-tab-orders" hidden={activeTab !== "orders"}>
      <div className="orders-heading"><div><p className="eyebrow">MIS COMPRAS</p><h3>Estado de tus pedidos</h3><p>{orders.filter((order) => order.status === "delivered").length} entregas confirmadas</p></div><Link href="/#catalogo">Ir a la tienda</Link></div>
      {orders.length === 0 ? <p className="empty-orders">Aún no tienes pedidos asociados a esta cuenta.</p> : orders.map((order) => <Link className="account-order" key={order.id} href={`/pedidos/${order.id}?access=${order.public_token}`}><span><b>Pedido #{order.id.slice(0, 8).toUpperCase()}</b><small>{new Date(order.created_at).toLocaleDateString("es-MX")} · Ver compra y objetos</small></span><strong className={`order-${order.status}`}>{orderLabel(order.status)}</strong></Link>)}
    </section>
    <section id="account-panel-favorites" className="account-favorites-panel account-tab-panel" role="tabpanel" aria-labelledby="account-tab-favorites" hidden={activeTab !== "favorites"}>
      <span><Heart aria-hidden="true" size={24} /></span><div><p className="eyebrow">FAVORITOS</p><h3>{commerce.favoriteItemIds.size === 1 ? "1 objeto guardado" : `${commerce.favoriteItemIds.size} objetos guardados`}</h3><p>Consulta cuáles siguen disponibles antes de agregarlos al carrito.</p><Link href="/favoritos">Ver mis favoritos</Link></div>
    </section>
  </div>;

  if (adminAccess) return <form className="account-card register-card" onSubmit={authenticate}><p className="eyebrow">ACCESO RESTRINGIDO</p><h2>Panel de administración</h2><p>Ingresa con el correo y la contraseña de una cuenta autorizada.</p><label>Correo de administrador<input type="email" required value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="tu@correo.com" autoComplete="email" /></label><label>Contraseña<input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label><button className="primary-button" disabled={submitting}>{submitting ? "Entrando…" : "Entrar al panel"}</button>{message && <p className="notice">{message}</p>}<small className="account-note">Solo las cuentas con rol de administrador pueden continuar.</small></form>;

  return <form className="account-card register-card" onSubmit={authenticate}><p className="eyebrow">{authMode === "login" ? "INICIA SESIÓN" : "CREA TU CUENTA"}</p><h2>Tu cuenta SigfriedLootBox</h2><p>Usa un nombre de usuario y contraseña para conservar tu ID validado, favoritos, carrito e historial. No enviamos correos.</p><label>Nombre de usuario<input type="text" required minLength={3} maxLength={authMode === "register" ? 24 : 120} pattern={authMode === "register" ? "[A-Za-z0-9_-]{3,24}" : undefined} value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="tu_usuario" autoComplete="username" /></label><label>Contraseña<input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={authMode === "login" ? "current-password" : "new-password"} /></label><button className="primary-button" disabled={submitting}>{submitting ? "Procesando…" : authMode === "login" ? "Iniciar sesión" : "Crear cuenta"}</button>{message && <p className="notice">{message}</p>}<button className="identity-account-button" type="button" onClick={() => { setAuthMode((current) => current === "login" ? "register" : "login"); setMessage(null); }}>{authMode === "login" ? "Crear una cuenta" : "Ya tengo cuenta"}</button><button className="identity-account-button" type="button" onClick={commerce.openIdentity}>Validar mi ID sin crear cuenta</button><small className="account-note">No necesitas correo. Tu nombre de usuario identifica la cuenta.</small></form>;
}
