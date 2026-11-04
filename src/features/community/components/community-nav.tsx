import Link from "next/link";
import { BackButton } from "@/shared/components/back-button";

/** Cambia entre las dos páginas públicas de comunidad. */
export function CommunityNav({ active, summary }: { active: "clientes" | "referencias"; summary?: string }) {
  return <div className="community-bar">
    <BackButton fallbackHref="/fortnite#catalogo" label="Atrás" />
    <nav className="community-tabs" aria-label="Comunidad">
      <Link className={active === "clientes" ? "active" : ""} aria-current={active === "clientes" ? "page" : undefined} href="/clientes">Clientes</Link>
      <Link className={active === "referencias" ? "active" : ""} aria-current={active === "referencias" ? "page" : undefined} href="/referencias">Referencias</Link>
    </nav>
    {summary && <span className="community-summary">{summary}</span>}
  </div>;
}
