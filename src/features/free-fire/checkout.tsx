"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Gamepad2, MessageCircle } from "lucide-react";
import type { FreeFirePackage } from "./packages";
import { GamePageHero } from "@/features/storefront/components/game-page-hero";
import styles from "./checkout.module.css";

export function FreeFireCheckout({ pack, whatsapp, profileExampleSrc }: { pack: FreeFirePackage; whatsapp: string; profileExampleSrc?: string }) {
  const [nick, setNick] = useState("");
  const [uid, setUid] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("52");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const quantity = pack.diamonds.toLocaleString("es-MX");
  const price = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(pack.price);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!nick.trim() || !/^\d{6,15}$/.test(uid.trim()) || !/^\d{10}$/.test(phone) || !confirmed) {
      setError("Revisa tu WhatsApp, tu nick y tu UID, y confirma que los datos son correctos.");
      return;
    }
    const message = [
      "Hola, quiero solicitar esta recarga de Free Fire:",
      `Paquete: ${quantity} diamantes`,
      `Total: ${price} MXN`,
      `Nick: ${nick.trim()}`,
      `UID: ${uid.trim()}`,
      `Mi WhatsApp: +${country}${phone}`,
      "Confirmo que revisé los datos de mi jugador. ¿Me ayudas a continuar con la compra?",
    ].join("\n");
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  return <>
  <GamePageHero slim word="FREE FIRE" accent="#f97316" eyebrow="Free Fire · Recarga por UID" title={<>Completa tu <span>compra</span></>} lead="Tu paquete y los datos de tu jugador, en un solo lugar." />
  <div className={styles.page}>
    <div className={styles.layout}>
      <div className={styles.leftColumn}>
      <section className={styles.summary} aria-labelledby="order-title">
        <h2 id="order-title">Tu pedido</h2>
        <div className={styles.order}>
          <Image src="/games/diamantes-freefire.png" alt="Diamantes de Free Fire" width={88} height={60} className={styles.orderImage} />
          <div><h3>{quantity} diamantes</h3><p>Free Fire · Recarga por UID</p><span>{price} MXN</span></div>
        </div>
        <div className={styles.total}><span>Total</span><strong>{price} <small>MXN</small></strong></div>
        <p className={styles.note}>Esta compra corresponde únicamente al paquete seleccionado.</p>
        <Link href="/free-fire" className={styles.back}><ArrowLeft size={16} aria-hidden="true" /> Volver a los diamantes</Link>
      </section>
      <aside className={styles.profileGuide} aria-labelledby="profile-guide-title">
        <h2 id="profile-guide-title"><Gamepad2 size={20} aria-hidden="true" /> ¿Dónde encuentro mi nick y UID?</h2>
        <p>Abre tu perfil dentro de Free Fire. Ubica estos dos datos para completar tu recarga:</p>
        {profileExampleSrc && <figure className={styles.profileFigure}>
          <a href={profileExampleSrc} target="_blank" rel="noopener noreferrer" aria-label="Ampliar imagen de ejemplo del nick y UID en Free Fire">
            <Image src={profileExampleSrc} alt="Ejemplo de un perfil de Free Fire: el nick está resaltado en rojo en la parte superior y el UID en la parte inferior derecha." width={2016} height={825} sizes="(max-width: 800px) 100vw, 45vw" className={styles.profileImage} />
          </a>
          <figcaption>Imagen de ejemplo. Toca para ampliar; escribe los datos de tu propio perfil.</figcaption>
        </figure>}
        <ol className={styles.profileSteps}>
          <li><span>1</span><div><strong>Nick del jugador</strong><p>Tu nombre aparece en la parte superior del perfil. Cópialo con sus símbolos y espacios.</p></div></li>
          <li><span>2</span><div><strong>UID del jugador</strong><p>Es el número que aparece junto a “UID”, en la parte inferior derecha. Puedes copiarlo con el icono que tiene al lado.</p></div></li>
        </ol>
      </aside>
      </div>
      <form className={styles.form} onSubmit={submit}>
        <h2>Tus datos</h2>
        <label htmlFor="ff-phone">Tu WhatsApp</label>
        <div className={styles.phone}>
          <select aria-label="País de tu WhatsApp" value={country} onChange={(e) => setCountry(e.target.value)}><option value="52">México +52</option><option value="1">USA +1</option></select>
          <input id="ff-phone" type="tel" autoComplete="tel-national" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required placeholder="10 dígitos" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} aria-describedby="ff-phone-help" />
        </div>
        <p id="ff-phone-help" className={styles.help}>Escribe tu número sin el código de país. Lo usaremos para contactarte sobre tu recarga.</p>
        <fieldset className={styles.player}>
          <legend><Gamepad2 size={18} aria-hidden="true" /> Datos para tu recarga</legend>
          <label htmlFor="ff-uid">UID del jugador</label>
          <input id="ff-uid" inputMode="numeric" pattern="[0-9]{6,15}" minLength={6} maxLength={15} required value={uid} onChange={(e) => setUid(e.target.value.replace(/\D/g, ""))} placeholder="Ej. 3075674651" aria-describedby="ff-uid-help" />
          <p id="ff-uid-help" className={styles.help}>Solo números, de 6 a 15 dígitos. Abre tu perfil en Free Fire: el UID aparece debajo de la información de tu jugador.</p>
          <label htmlFor="ff-nick">Nick del jugador</label>
          <input id="ff-nick" required maxLength={60} value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Tu nombre dentro de Free Fire" aria-describedby="ff-nick-help" />
          <p id="ff-nick-help" className={styles.help}>Cópialo tal como aparece en la parte superior de tu perfil, incluidos símbolos y espacios.</p>
        </fieldset>
        <label className={styles.confirm}><input type="checkbox" required checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span>Revisé que el nick y el UID corresponden al jugador que recibirá los diamantes.</span></label>
        <p className={styles.help}>El administrador revisará tu solicitud. Estos datos no se verifican automáticamente con Free Fire.</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <button className={styles.submit} type="submit"><MessageCircle size={19} aria-hidden="true" /> Enviar solicitud por WhatsApp</button>
        <p className={styles.help}>Se abrirá WhatsApp con el paquete, precio y datos que ingresaste. Envía el mensaje para coordinar el pago con el administrador.</p>
      </form>
    </div>
  </div>
  </>;
}
