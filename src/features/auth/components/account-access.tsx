"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";

type CustomerOrder = { id: string; status: string; item_name: string; amount_mxn_cents: number; public_token: string; created_at: string };

export function AccountAccess() {
  const [email, setEmail] = useState(""); const [message, setMessage] = useState<string | null>(null); const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: rows } = await supabase.from("orders").select("id,status,item_name,amount_mxn_cents,public_token,created_at").order("created_at", { ascending: false });
      setOrders(rows ?? []);
    });
  }, [supabase]);

  async function sendLink(event: FormEvent) {
    event.preventDefault(); if (!supabase) { setMessage("Supabase Auth todavía no está configurado."); return; }
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/cuenta` } });
    setMessage(error ? error.message : "Te enviamos un enlace seguro. Revisa tu correo.");
  }

  if (orders) return <div className="account-card"><h2>Mis pedidos</h2>{orders.length === 0 ? <p>No encontramos pedidos asociados a este correo.</p> : orders.map((order) => <a className="account-order" key={order.id} href={`/pedidos/${order.id}?access=${order.public_token}`}><span>{order.item_name}</span><strong>{order.status}</strong></a>)}</div>;
  return <form className="account-card" onSubmit={sendLink}><p className="eyebrow">ACCESO SIN CONTRASEÑA</p><h2>Consulta tus compras</h2><p>Usaremos el mismo correo de tus pedidos para asociarlos automáticamente.</p><label>Correo<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className="primary-button">Enviar enlace seguro</button>{message && <p className="notice">{message}</p>}</form>;
}
