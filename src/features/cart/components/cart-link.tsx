"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readCart, subscribeToCart } from "../application/cart-storage";

export function CartLink() {
  const [count, setCount] = useState(0);
  useEffect(() => { const update = () => setCount(readCart().length); update(); return subscribeToCart(update); }, []);
  return <Link className="cart-link" href="/carrito" aria-label={`Carrito, ${count} objetos`}>Carrito <span>{count}</span></Link>;
}
