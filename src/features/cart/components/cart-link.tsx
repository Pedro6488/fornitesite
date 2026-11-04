"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { readCart, subscribeToCart } from "../application/cart-storage";
import { useOptionalCommerceState } from "@/features/commerce/components/commerce-state-provider";

export function CartLink({ label = "Carrito" }: { label?: string }) {
  const commerce = useOptionalCommerceState();
  const [fallbackCount, setFallbackCount] = useState(0);
  useEffect(() => {
    if (commerce) return;
    const update = () => setFallbackCount(readCart().length);
    const frame = window.requestAnimationFrame(update);
    const unsubscribe = subscribeToCart(update);
    return () => { window.cancelAnimationFrame(frame); unsubscribe(); };
  }, [commerce]);
  const count = commerce ? commerce.cartItemIds.length : fallbackCount;
  return <Link className="cart-link" href="/carrito" aria-label={`${label}, ${count} objetos`}><ShoppingBag aria-hidden="true" size={17} />{label} <span>{count}</span></Link>;
}
