"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Ticket, MessageCircle } from "lucide-react";
import type { RobloxPackage } from "./packages";
import { RobuxArt } from "./robux-art";
import { GamePageHero } from "@/features/storefront/components/game-page-hero";
import styles from "../free-fire/checkout.module.css";

export function RobloxCheckout({ pack, whatsapp }: { pack: RobloxPackage; whatsapp: string }) {
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("52");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const quantity = pack.robux.toLocaleString("es-MX");
  const price = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(pack.price);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!/^\d{10}$/.test(phone) || !confirmed) {
      setError("Revisa tu WhatsApp y confirma que compras un código canjeable.");
      return;
    }
    const message = [
      "Hola, quiero comprar un código canjeable de Roblox:",
      `Código canjeable: ${quantity} Robux`,
      `Total: ${price} MXN`,
      `Mi WhatsApp: +${country}${phone}`,
      "Entiendo que recibiré un código canjeable. ¿Me ayudas a coordinar el pago y la entrega?",
    ].join("\n");
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  return <>
  <GamePageHero slim word="ROBLOX" accent="#e8b94a" eyebrow="Roblox · Código canjeable" title={<>Completa tu <span>compra</span></>} lead="Elige tus Robux y recibe un código para canjear." />
  <div className={styles.page}>
    <div className={styles.layout}>
      <div className={styles.leftColumn}>
        <section className={styles.summary} aria-labelledby="roblox-order-title">
          <h2 id="roblox-order-title">Tu pedido</h2>
          <div className={styles.order}><RobuxArt className={styles.orderImage} /><div><h3>{quantity} Robux</h3><p>Roblox · Código canjeable</p><span>{price} MXN</span></div></div>
          <div className={styles.total}><span>Total</span><strong>{price} <small>MXN</small></strong></div>
          <p className={styles.note}>Esta compra corresponde únicamente al paquete seleccionado.</p>
          <Link href="/roblox" className={styles.back}><ArrowLeft size={16} aria-hidden="true" /> Volver a los Robux</Link>
        </section>
        <aside className={styles.profileGuide} aria-labelledby="roblox-guide-title">
          <h2 id="roblox-guide-title"><Ticket size={20} aria-hidden="true" /> Recibirás un código canjeable</h2>
          <p>Este producto se entrega como un código canjeable de Roblox. No necesitamos los datos de tu cuenta. Coordina el pago y la entrega del código con el administrador por WhatsApp.</p>
        </aside>
      </div>
      <form className={styles.form} onSubmit={submit}>
        <h2>Tus datos</h2>
        <label htmlFor="roblox-phone">Tu WhatsApp</label>
        <div className={styles.phone}>
          <select aria-label="País de tu WhatsApp" value={country} onChange={(e) => setCountry(e.target.value)}><option value="52">México +52</option><option value="1">USA +1</option></select>
          <input id="roblox-phone" type="tel" autoComplete="tel-national" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required placeholder="10 dígitos" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} aria-describedby="roblox-phone-help" />
        </div>
        <p id="roblox-phone-help" className={styles.help}>Escribe tu número sin el código de país. Te contactaremos sobre tu compra.</p>
        <label className={styles.confirm}><input type="checkbox" required checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span>Entiendo que compro un código canjeable de {quantity} Robux.</span></label>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <button className={styles.submit} type="submit"><MessageCircle size={19} aria-hidden="true" /> Enviar solicitud por WhatsApp</button>
        <p className={styles.help}>Se abrirá WhatsApp con el código seleccionado, su precio y tu número de contacto. Envía el mensaje para coordinar el pago y la entrega del código con el administrador.</p>
      </form>
    </div>
  </div>
  </>;
}
