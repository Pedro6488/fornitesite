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

export function AccountAccess({ nextPath = "/cuenta" }: { nextPath?: string }) {
  const commerce = useCommerceState();
  const [email, setEmail] = useState("");
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

  async function sendLink(event: FormEvent) {
    event.preventDefault();
    if (!supabase) { setMessage("El acceso todavía no está configurado."); return; }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` }
    });
    setMessage(error ? error.message : "Te enviamos un enlace seguro. Ábrelo desde tu correo para entrar sin contraseña.");
  }

  if (checking) return <div className="account-card"><p>Cargando tu cuenta…</p></div>;
  if (orders) return <div className="account-dashboard">
    <div className="account-welcome"><div><p className="eyebrow">MI DASHBOARD</p><h2>Tu cuenta está lista.</h2></div><button type="button" onClick={() => void supabase?.auth.signOut().then(() => window.location.reload())}>Cerrar sesión</button></div>
    <div className="dashboard-grid">
      <button type="button" className="dashboard-card profile-card" onClick={commerce.openIdentity}><span className="dashboard-icon">◎</span><div><small>ID PARA RECIBIR</small><strong>{commerce.validation?.display_name ?? "Validar mi ID"}</strong><p>{commerce.validation?.status === "ready" ? "Listo para comprar" : "Revisar identidad →"}</p></div></button>
      <Link href="/favoritos" className="dashboard-card"><span className="dashboard-icon">♡</span><div><small>FAVORITOS</small><strong>{commerce.favoriteItemIds.size} objetos</strong><p>Ver disponibilidad →</p></div></Link>
      <section className="dashboard-card"><span className="dashboard-icon">✓</span><div><small>OBJETOS RECIBIDOS</small><strong>{orders.filter((order) => order.status === "delivered").length}</strong><p>Entregas confirmadas</p></div></section>
    </div>
    <section className="orders-panel"><div className="orders-heading"><div><p className="eyebrow">MIS COMPRAS</p><h3>Estado de tus pedidos</h3></div><Link href="/#catalogo">Ir a la tienda</Link></div>{orders.length === 0 ? <p className="empty-orders">Aún no tienes pedidos asociados a esta cuenta.</p> : orders.map((order) => <Link className="account-order" key={order.id} href={`/pedidos/${order.id}?access=${order.public_token}`}><span>{order.item_name}<small>{new Date(order.created_at).toLocaleDateString("es-MX")}</small></span><strong className={`order-${order.status}`}>{orderLabel(order.status)}</strong></Link>)}</section>
  </div>;

  return <form className="account-card register-card" onSubmit={sendLink}><p className="eyebrow">REGÍSTRATE O INICIA SESIÓN</p><h2>Tu cuenta SigfriedLootBox</h2><p>Usamos un enlace seguro por correo, sin contraseñas. Iniciar sesión es opcional: te permite sincronizar favoritos, carrito e historial entre dispositivos.</p><label>Correo electrónico<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></label><button className="primary-button">Enviar enlace seguro</button>{message && <p className="notice">{message}</p>}<button className="identity-account-button" type="button" onClick={commerce.openIdentity}>Validar mi ID sin crear cuenta</button><small className="account-note">Para comprar como invitado sólo necesitas un ID entregable y WhatsApp.</small></form>;
}
