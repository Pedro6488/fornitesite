import { GamesMenuLink } from "@/shared/components/games-menu-link";
import { StorefrontTransition } from "@/features/storefront/components/storefront-transition";
import styles from "./loading.module.css";

export default function FortniteLoading() {
  return <StorefrontTransition><GamesMenuLink /><section className={styles.loading} aria-busy="true" aria-label="Catálogo de Fortnite"><p role="status">Preparando tu catálogo de Fortnite…</p><div className={styles.heading} aria-hidden="true" /><div className={styles.cards} aria-hidden="true">{Array.from({length: 6}, (_, index) => <div key={index}><span /><i /></div>)}</div></section></StorefrontTransition>;
}
