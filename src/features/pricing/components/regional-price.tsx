"use client";

import { calculateUsdPrice, formatMxn, formatUsd } from "../domain/price-calculator";
import { type StoreRegion, useStoreRegion } from "./region-provider";

export function getRegionalPrice(region: StoreRegion, vbucks: number, mxnPrice: number | null) {
  if (mxnPrice === null) return { amount: null, currency: null, label: "Consultar" };
  if (region === "us") return { amount: calculateUsdPrice(vbucks), currency: "USD", label: formatUsd(calculateUsdPrice(vbucks)) };
  return { amount: mxnPrice, currency: "MXN", label: formatMxn(mxnPrice) };
}

export function useRegionalPrice(vbucks: number, mxnPrice: number | null) {
  const { region } = useStoreRegion();
  return getRegionalPrice(region, vbucks, mxnPrice);
}

export function formatRegionalPrice(region: StoreRegion, vbucks: number, mxnPrice: number | null): string {
  const price = getRegionalPrice(region, vbucks, mxnPrice);
  return price.currency ? `${price.label} ${price.currency}` : price.label;
}

export function RegionalPrice({ vbucks, mxnPrice }: { vbucks: number; mxnPrice: number | null }) {
  const price = useRegionalPrice(vbucks, mxnPrice);
  return <>{price.label}{price.currency && <small>{price.currency}</small>}</>;
}
