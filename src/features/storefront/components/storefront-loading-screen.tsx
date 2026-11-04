import Image from "next/image";
import { ScrollToTopOnLoading } from "./route-scroll";
import styles from "./storefront-loading-screen.module.css";

/** Ocupa toda la pantalla bajo el encabezado: la ruta aún no tiene contenido que mostrar. */
export function StorefrontLoadingScreen({ title, detail }: { title: string; detail: string }) {
  return (
    <div className={styles.screen} role="status" aria-live="polite">
      <ScrollToTopOnLoading />
      <div className={styles.emblem} aria-hidden="true">
        <span className={styles.ring} />
        <Image src="/games/logofin.png" alt="" width={72} height={72} priority />
      </div>
      <p className={styles.title}>{title}</p>
      <p className={styles.detail}>{detail}</p>
    </div>
  );
}
