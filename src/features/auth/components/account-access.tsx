"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { readFavoriteIds, subscribeToFavorites } from "@/features/catalog/application/favorite-storage";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";

type Platform = "epic" | "xbl" | "nintendo" | "psn";
type CustomerOrder = { id: string; status: string; item_name: string; amount_mxn_cents: number; public_token: string; created_at: string };
type GameAccount = { id: string; display_name: string; epic_account_id: string; platform: Platform };
const platformNames: Record<Platform, string> = { epic: "Epic Games", xbl: "Xbox", nintendo: "Nintendo Switch", psn: "PlayStation" };

function orderLabel(status: string) {
  if (status === "delivered") return "Recibido";
  if (["ready_to_send", "validating_delivery", "delivering"].includes(status)) return "Enviado / en proceso";
  if (["rejected", "refunded", "canceled", "expired"].includes(status)) return "Requiere atención";
  return "En espera";
}

export function AccountAccess() {
  const [email, setEmail] = useState(""); const [gameId, setGameId] = useState(""); const [platform, setPlatform] = useState<Platform>("epic");
  const [message, setMessage] = useState<string | null>(null); const [orders, setOrders] = useState<CustomerOrder[] | null>(null); const [account, setAccount] = useState<GameAccount | null>(null); const [favoriteCount, setFavoriteCount] = useState(0);
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  useEffect(() => {
    const syncFavorites = () => setFavoriteCount(readFavoriteIds().size);
    syncFavorites(); return subscribeToFavorites(syncFavorites);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const draft = window.localStorage.getItem("sigfried-account-draft");
      if (draft) {
        try {
          const saved = JSON.parse(draft) as { gameId: string; platform: Platform };
          if (saved.gameId) await supabase.from("epic_accounts").upsert({ user_id: data.user.id, display_name: saved.gameId, epic_account_id: saved.gameId, platform: saved.platform }, { onConflict: "user_id,epic_account_id" });
          window.localStorage.removeItem("sigfried-account-draft");
        } catch { window.localStorage.removeItem("sigfried-account-draft"); }
      }
      const [{ data: orderRows }, { data: accountRows }] = await Promise.all([
        supabase.from("orders").select("id,status,item_name,amount_mxn_cents,public_token,created_at").order("created_at", { ascending: false }),
        supabase.from("epic_accounts").select("id,display_name,epic_account_id,platform").order("created_at", { ascending: false }).limit(1),
      ]);
      setOrders(orderRows ?? []); setAccount((accountRows?.[0] as GameAccount | undefined) ?? null);
    });
  }, [supabase]);

  async function sendLink(event: FormEvent) {
    event.preventDefault();
    if (!supabase) { setMessage("El acceso todavía no está configurado. Configura Supabase para activar el registro."); return; }
    window.localStorage.setItem("sigfried-account-draft", JSON.stringify({ gameId, platform }));
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/cuenta` } });
    setMessage(error ? error.message : "Te enviamos un enlace seguro. Ábrelo desde tu correo para activar tu cuenta.");
  }

  if (orders) return <div className="account-dashboard">
    <div className="account-welcome"><div><p className="eyebrow">MI DASHBOARD</p><h2>Hola, tu cuenta está lista.</h2></div><button type="button" onClick={() => void supabase?.auth.signOut().then(() => window.location.reload())}>Cerrar sesión</button></div>
    <div className="dashboard-grid">
      <section className="dashboard-card profile-card"><span className="dashboard-icon">◎</span><div><small>ID PARA AGREGARTE</small><strong>{account?.display_name ?? "Aún no registras tu ID"}</strong><p>{account ? platformNames[account.platform] : "Agrega tu ID al registrarte"}</p></div></section>
      <Link href="/favoritos" className="dashboard-card"><span className="dashboard-icon">♡</span><div><small>FAVORITOS</small><strong>{favoriteCount} {favoriteCount === 1 ? "objeto" : "objetos"}</strong><p>Ver disponibilidad en tienda →</p></div></Link>
      <section className="dashboard-card"><span className="dashboard-icon">✓</span><div><small>OBJETOS RECIBIDOS</small><strong>{orders.filter((order) => order.status === "delivered").length}</strong><p>Entregas confirmadas</p></div></section>
    </div>
    <section className="orders-panel"><div className="orders-heading"><div><p className="eyebrow">MIS COMPRAS</p><h3>Estado de tus pedidos</h3></div><Link href="/#catalogo">Ir a la tienda</Link></div>{orders.length === 0 ? <p className="empty-orders">Aún no tienes pedidos. Cuando compres, verás aquí si están en espera, enviados o recibidos.</p> : orders.map((order) => <Link className="account-order" key={order.id} href={`/pedidos/${order.id}?access=${order.public_token}`}><span>{order.item_name}<small>{new Date(order.created_at).toLocaleDateString("es-MX")}</small></span><strong className={`order-${order.status}`}>{orderLabel(order.status)}</strong></Link>)}</section>
  </div>;

  return <form className="account-card register-card" onSubmit={sendLink}><p className="eyebrow">REGÍSTRATE O INICIA SESIÓN</p><h2>Tu cuenta SigfriedLootBox</h2><p>Usamos un enlace seguro por correo, sin contraseñas. Tu ID nos permite identificar la plataforma para agregarte.</p><label>Correo electrónico<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></label><div className="account-fields"><label>Tu ID de jugador<input required value={gameId} onChange={(event) => setGameId(event.target.value)} placeholder="Ej. TuNombre" /></label><label>Plataforma<select value={platform} onChange={(event) => setPlatform(event.target.value as Platform)}><option value="epic">Epic Games</option><option value="xbl">Xbox</option><option value="nintendo">Nintendo Switch</option><option value="psn">PlayStation</option></select></label></div><button className="primary-button">Enviar enlace seguro</button>{message && <p className="notice">{message}</p>}<small className="account-note">Al continuar aceptas recibir actualizaciones relacionadas con tus compras.</small></form>;
}
