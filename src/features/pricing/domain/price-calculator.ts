export type PriceTier = Readonly<{
  minVbucks: number;
  maxVbucks: number | null;
  mxnPerHundred: number;
}>;

export const DEFAULT_PRICE_TIERS: readonly PriceTier[] = [
  { minVbucks: 100, maxVbucks: 499, mxnPerHundred: 10 },
  { minVbucks: 500, maxVbucks: 1_499, mxnPerHundred: 8 },
  { minVbucks: 1_500, maxVbucks: 2_999, mxnPerHundred: 7.5 },
  { minVbucks: 3_000, maxVbucks: null, mxnPerHundred: 7 }
];

export class UnsupportedVbucksPriceError extends Error {
  constructor(vbucks: number) {
    super(`No existe una tarifa para ${vbucks} paVos.`);
    this.name = "UnsupportedVbucksPriceError";
  }
}

export function calculateMxnPrice(
  vbucks: number,
  tiers: readonly PriceTier[] = DEFAULT_PRICE_TIERS
): number {
  if (!Number.isInteger(vbucks) || vbucks <= 0) {
    throw new UnsupportedVbucksPriceError(vbucks);
  }

  const tier = tiers.find(
    ({ minVbucks, maxVbucks }) =>
      vbucks >= minVbucks && (maxVbucks === null || vbucks <= maxVbucks)
  );

  if (!tier) throw new UnsupportedVbucksPriceError(vbucks);
  return Math.ceil((vbucks / 100) * tier.mxnPerHundred);
}

export function formatMxn(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0
  }).format(amount);
}
