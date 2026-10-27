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

export const PAYPAL_FEE_USD_CENTS = 230;

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

export function calculateAuthoritativePrice(
  vbucks: number,
  tiers: readonly PriceTier[],
  overrideMxnCents?: number
): number {
  if (overrideMxnCents !== undefined) {
    if (!Number.isInteger(overrideMxnCents) || overrideMxnCents <= 0) {
      throw new UnsupportedVbucksPriceError(vbucks);
    }
    return overrideMxnCents / 100;
  }
  return calculateMxnPrice(vbucks, tiers);
}

export function priceTiersOverlap(left: PriceTier, right: PriceTier): boolean {
  const leftEnd = left.maxVbucks ?? Number.POSITIVE_INFINITY;
  const rightEnd = right.maxVbucks ?? Number.POSITIVE_INFINITY;
  return left.minVbucks <= rightEnd && right.minVbucks <= leftEnd;
}

export function formatMxn(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0
  }).format(amount);
}

export function calculateUsdPrice(vbucks: number): number {
  if (!Number.isInteger(vbucks) || vbucks <= 0) {
    throw new UnsupportedVbucksPriceError(vbucks);
  }

  const pesos = (vbucks / 100) * 8;
  const dollars = pesos / 16;
  const wholeDollars = Math.floor(dollars);
  return dollars - wholeDollars >= 0.3 ? wholeDollars + 1 : wholeDollars;
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatUsdCents(amountCents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}
