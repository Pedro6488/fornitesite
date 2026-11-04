import { FREE_FIRE_PACKAGES } from "@/features/free-fire/packages";
import { ROBLOX_PACKAGES } from "@/features/roblox/packages";

export const STOREFRONT_GAMES = [
  { id: "fortnite", name: "Fortnite", href: "/fortnite", catalogHref: "/fortnite#catalogo", type: "Objetos de la tienda", delivery: "Compra en la web", image: "/games/fortnite.jpg" },
  { id: "free-fire", name: "Free Fire", href: "/free-fire", catalogHref: "/free-fire", type: "Diamantes por UID", delivery: "Solicitud por WhatsApp", image: "/games/free-fire.jpg" },
  { id: "roblox", name: "Roblox", href: "/roblox", catalogHref: "/roblox", type: "Códigos de Robux", delivery: "Solicitud por WhatsApp", image: "/games/robux.png" },
] as const;

export const FREE_FIRE_STARTING_PRICE = Math.min(...FREE_FIRE_PACKAGES.map((pack) => pack.price));
export const ROBLOX_STARTING_PRICE = Math.min(...ROBLOX_PACKAGES.map((pack) => pack.price));
export const formatStoreMxn = (amount: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(amount);
export function gameForPath(pathname: string) {
  return STOREFRONT_GAMES.find((game) => pathname === game.href || pathname.startsWith(`${game.href}/`));
}
