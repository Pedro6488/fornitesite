"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import { BadgeCheck, Clock3, Coins, Landmark, ShieldCheck, ShoppingBag } from "lucide-react";
import type { CatalogItem } from "@/features/catalog/domain/catalog-item";
import { useCommerceState } from "@/features/commerce/components/commerce-state-provider";
import { getIdentityPresentation } from "@/features/commerce/application/identity-presentation";
import { CommerceSheet } from "@/features/commerce/components/commerce-sheet";
import { calculateUsdPrice, formatMxn, formatUsdCents, PAYPAL_FEE_USD_CENTS } from "@/features/pricing/domain/price-calculator";
import { formatRegionalPrice, getRegionalPrice } from "@/features/pricing/components/regional-price";
import { useStoreRegion } from "@/features/pricing/components/region-provider";
import { getSupabaseBrowser } from "@/shared/infrastructure/supabase/browser";
import { SystemActionBar } from "@/shared/components/system-action-bar";
import { GamePageHero } from "@/features/storefront/components/game-page-hero";
import { PurchaseSteps } from "./purchase-steps";
import { resolveCartAvailability } from "../application/cart-availability";
import { useWallet } from "@/features/wallet/components/use-wallet";
import { notifyWalletChanged } from "@/features/wallet/components/use-wallet-balance";
import { WalletMeter } from "@/features/wallet/components/wallet-meter";
import { compareWalletPrice, walletMoney } from "@/features/wallet/domain/wallet";

type Quote = Readonly<{
  id: string;
  expiresAt: string;
  amountMxnCents: number;
  currency: "MXN" | "USD";
  subtotalUsdCents: number | null;
  paypalFeeUsdCents: number | null;
  amountUsdCents: number | null;
  totalVbucks: number;
  walletAllowed?: boolean;
  lines: readonly {
    walletAllowed?: boolean;
    itemMainId: string;
    name: string;
    imageUrl: string | null;
    vbucksPrice: number;
    amountMxnCents: number;
    amountUsdCents: number | null;
  }[];
  validationId: string;
  itemSignature: string;
  idempotencyKey: string;
}>;

async function authHeaders(): Promise<HeadersInit> {
  const token = (await getSupabaseBrowser()?.auth.getSession())?.data.session
    ?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function CartCheckoutForm({ items }: { items: readonly CatalogItem[] }) {
  const router = useRouter();
  const commerce = useCommerceState();
  const { region } = useStoreRegion();
  const wallet = useWallet(commerce.authenticated, commerce.sessionId);
  // null = el cliente aún no elige: si su saldo alcanza, se propone pagar con pavos.
  const [paymentChoice, setPaymentSource] = useState<"external" | "wallet" | null>(null);
  const [emailDraft, setEmailDraft] = useState<{ sessionId: string | null; value: string } | null>(null);
  const email = emailDraft && emailDraft.sessionId === commerce.sessionId ? emailDraft.value : commerce.email ?? "";
  const [phoneDraft, setPhoneDraft] = useState<{ sessionId: string | null; value: string } | null>(null);
  const whatsapp = phoneDraft && phoneDraft.sessionId === commerce.sessionId
    ? phoneDraft.value
    : (commerce.whatsapp ?? "").replace(/\D/g, "").slice(0, 12);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteSheetOpen, setQuoteSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cartEntries = useMemo(
    () => resolveCartAvailability(commerce.cartItemIds, items),
    [commerce.cartItemIds, items],
  );
  const unavailableEntries = useMemo(
    () => cartEntries.filter((entry) => !entry.available),
    [cartEntries],
  );
  const lines = useMemo(
    () =>
      cartEntries.flatMap((entry) =>
        entry.available && entry.item ? [entry.item] : [],
      ),
    [cartEntries],
  );
  const visibleTotal = lines.reduce(
    (sum, item) => sum + (item.priceMxn ?? 0),
    0,
  );
  const displayTotal = lines.reduce(
    (sum, item) => sum + (getRegionalPrice(region, item.finalPriceVbucks, item.priceMxn).amount ?? 0),
    0,
  );
  const formatRegionalAmount = (vbucks: number, amountMxnCents: number) => formatRegionalPrice(region, vbucks, amountMxnCents / 100);
  const displayTotalWithFeeCents = Math.round(displayTotal * 100) + (region === "us" ? PAYPAL_FEE_USD_CENTS : 0);
  const formatDisplayTotal = region === "us"
    ? `${formatUsdCents(displayTotalWithFeeCents)} USD`
    : formatMxn(displayTotal);
  const catalogById = useMemo(() => new Map(items.map((item) => [item.mainId, item])), [items]);
  const identity = getIdentityPresentation(commerce.validation);
  const isReady = identity.canQuote;
  const itemSignature = commerce.cartItemIds.join("|");
  const activeQuote =
    quote &&
    quote.currency === (region === "us" ? "USD" : "MXN") &&
    quote.validationId === commerce.validation?.id &&
    quote.itemSignature === itemSignature
      ? quote
      : null;
  const activeQuoteTotal = activeQuote?.lines.reduce(
    (sum, line) => sum + (getRegionalPrice(region, line.vbucksPrice, line.amountMxnCents / 100).amount ?? 0),
    0,
  ) ?? displayTotal;
  const walletCost = activeQuote?.totalVbucks ?? lines.reduce((sum,item) => sum+item.finalPriceVbucks,0);
  const walletPromo = wallet.data?.bonuses?.filter((bonus) => bonus.region === region).toSorted((a, b) => b.bonus_bp - a.bonus_bp)[0] ?? null;
  const walletBlockedItems = activeQuote?.lines.filter((line) => line.walletAllowed === false).map((line) => line.name) ?? [];
  const walletComparison = activeQuote && wallet.data ? compareWalletPrice(region === "us" ? activeQuote.amountUsdCents : activeQuote.amountMxnCents, walletCost, wallet.data.rates?.find((rate) => rate.region === region)) : null;
  const insufficientWallet = !wallet.data || walletBlockedItems.length > 0 || wallet.data.frozen || wallet.data.paused || wallet.data.balance < walletCost || !wallet.data.automaticDelivery;
  const paymentSource = paymentChoice ?? (commerce.authenticated && !insufficientWallet ? "wallet" : "external");
  const useWalletPayment = paymentSource === "wallet" && commerce.authenticated;
  const walletBlockReason = !wallet.data ? null : wallet.data.frozen ? "Tu saldo está en revisión." : wallet.data.paused ? "Pausado unos minutos." : !wallet.data.automaticDelivery ? "Entrega automática no disponible por ahora." : walletBlockedItems.length > 0 ? "Hay objetos con precio especial." : wallet.data.balance < walletCost ? `Te faltan ${(walletCost - wallet.data.balance).toLocaleString("es-MX")} pavos.` : null;
  const formatActiveQuoteTotal = useWalletPayment ? `${walletCost.toLocaleString("es-MX")} pavos` : region === "us"
    ? `${formatUsdCents(activeQuote?.amountUsdCents ?? displayTotalWithFeeCents)} USD`
    : formatMxn(activeQuoteTotal);

  const createQuote = useCallback(async () => {
    if (!commerce.validation || !lines.length) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/checkout/quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          validationId: commerce.validation.id,
          itemIds: lines.map((item) => item.mainId),
          region,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setQuote({
        ...body.quote,
        validationId: commerce.validation.id,
        itemSignature,
        idempotencyKey: crypto.randomUUID(),
      });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No fue posible revisar la compra.",
      );
    } finally {
      setLoading(false);
    }
  }, [commerce.validation, itemSignature, lines, region]);

  const closeQuoteSheet = useCallback(() => setQuoteSheetOpen(false), []);

  const openQuoteSheet = useCallback(() => {
    setQuoteSheetOpen(true);
    void createQuote();
  }, [createQuote]);

  const continueToContact = useCallback(() => {
    setQuoteSheetOpen(false);
    window.requestAnimationFrame(() =>
      document
        .getElementById("checkout-contact")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!activeQuote || !commerce.validation || (useWalletPayment && insufficientWallet)) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/cart-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          quoteId: activeQuote.id,
          validationId: commerce.validation.id,
          whatsapp,
          customerEmail: email,
          idempotencyKey: activeQuote.idempotencyKey,
          paymentSource: useWalletPayment ? "wallet" : "external",
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      commerce.clearCart();
      if (useWalletPayment) notifyWalletChanged();
      await commerce.refresh();
      router.push(`/pedidos/${body.order.id}?access=${body.order.publicToken}`);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No fue posible confirmar el pedido.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function removeUnavailable() {
    setLoading(true);
    setError(null);
    const failure = unavailableEntries[0]
      ? await commerce.removeCartItem(unavailableEntries[0].itemId)
      : null;
    setError(failure);
    setLoading(false);
  }

  if (commerce.ready && commerce.cartItemIds.length === 0)
    return (
      <section className="flow-shell">
        <GamePageHero slim word="CHECKOUT" accent="#8b5cf6" eyebrow="Solicitud" title={<>Tu carrito está <span>vacío</span></>} />
        <div className="loot-page-body">
          <div className="loot-empty">
            <span aria-hidden="true"><ShoppingBag size={26} /></span>
            <h2>Todavía no hay nada que confirmar</h2>
            <p>Agrega objetos a tu carrito y vuelve aquí para terminar tu compra.</p>
            <Link className="primary-button" href="/fortnite#catalogo">
              Explorar tienda
            </Link>
          </div>
        </div>
      </section>
    );
  if (commerce.ready && unavailableEntries.length > 0)
    return (
      <section className="flow-shell checkout-flow">
        <GamePageHero
          slim
          word="CHECKOUT"
          accent="#ff2d6b"
          eyebrow="Carrito actualizado"
          title={<>Algunos objetos <span>ya no están</span></>}
          lead="Salieron de la tienda antes de confirmar tu solicitud. No se generó ningún pedido ni cobro."
        />
        <div className="loot-page-body">
        <div className="checkout-card expired-selection" role="alert">
          <div className="checkout-items">
            {unavailableEntries.map((entry) => (
              <p key={entry.itemId}>
                <span>{entry.item?.name ?? "Objeto fuera del catálogo"}</span>
                <strong>No disponible</strong>
              </p>
            ))}
          </div>
          <button
            type="button"
            className="primary-button"
            disabled={loading}
            onClick={() => void removeUnavailable()}
          >
            {loading ? "Actualizando…" : "Quitar no disponibles"}
          </button>
          <Link className="cart-secondary" href="/carrito">
            Volver al carrito
          </Link>
          {error && <p className="notice error">{error}</p>}
        </div>
        </div>
      </section>
    );

  return (
    <section className="flow-shell checkout-flow">
      <GamePageHero
        slim
        word="CHECKOUT"
        accent="#8b5cf6"
        eyebrow="Checkout seguro"
        title={<>Confirma tu <span>solicitud</span></>}
        lead="Revisa tu pedido y confirma el precio antes de crear tu orden."
        aside={<PurchaseSteps current={activeQuote ? 3 : 2} />}
      />
      <div className="loot-page-body">
      <form className="checkout-card" onSubmit={submit}>
        <section className="checkout-order" aria-labelledby="checkout-order-title">
          <header className="order-summary">
            <div>
              <p className="eyebrow">LO QUE COMPRAS</p>
              <h2 id="checkout-order-title">
                {lines.length} {lines.length === 1 ? "objeto" : "objetos"}
              </h2>
              <span>Una unidad de cada objeto</span>
            </div>
            <Link className="cart-secondary" href="/carrito">
              Volver al carrito
            </Link>
          </header>
          <div className="checkout-items">
            {(
              activeQuote?.lines ??
              lines.map((item) => ({
                itemMainId: item.mainId,
                name: item.name,
                vbucksPrice: item.finalPriceVbucks,
                amountMxnCents: (item.priceMxn ?? 0) * 100,
                amountUsdCents: region === "us" ? calculateUsdPrice(item.finalPriceVbucks) * 100 : null,
              }))
            ).map((item) => (
              <p key={item.itemMainId}>
                <span className="checkout-item-name">
                  <span className="checkout-item-art" data-rarity={catalogById.get(item.itemMainId)?.rarity ?? ""} aria-hidden="true">
                    {catalogById.get(item.itemMainId)?.imageUrl && <Image src={catalogById.get(item.itemMainId)?.imageUrl ?? ""} alt="" fill sizes="48px" />}
                  </span>
                  <span>{item.name}</span>
                </span>
                <strong>{useWalletPayment ? `${item.vbucksPrice.toLocaleString("es-MX")} pavos` : region === "us" && item.amountUsdCents !== null ? `${formatUsdCents(item.amountUsdCents)} USD` : formatRegionalAmount(item.vbucksPrice, item.amountMxnCents)}</strong>
              </p>
            ))}
            {!useWalletPayment && region === "us" && <p className="checkout-fee"><span>Comisión PayPal</span><strong>{formatUsdCents(activeQuote?.paypalFeeUsdCents ?? PAYPAL_FEE_USD_CENTS)} USD</strong></p>}
          </div>
          <p className="checkout-order-total">
            <span>{activeQuote ? "Total confirmado" : "Total estimado"}</span>
            <strong>{formatActiveQuoteTotal}</strong>
          </p>
          {useWalletPayment && wallet.data && <p className="checkout-wallet-after">{wallet.data.balance >= walletCost
            ? <>Sale de tu saldo de {wallet.data.balance.toLocaleString("es-MX")} pavos · <b>te quedan {(wallet.data.balance - walletCost).toLocaleString("es-MX")}</b></>
            : <>Tu saldo es de {wallet.data.balance.toLocaleString("es-MX")} pavos · <b>te faltan {(walletCost - wallet.data.balance).toLocaleString("es-MX")}</b></>}</p>}
        </section>
        <div className="checkout-path">
          <section className={`checkout-gate ${identity.tone}`} aria-labelledby="checkout-recipient-title">
            <header className="checkout-step-title">
              <b>2</b>
              <div>
                <small>ID Y PRECIO</small>
                <h2 id="checkout-recipient-title">¿Quién recibe tu compra?</h2>
              </div>
            </header>
            <div className="checkout-gate-state">
              <div>
                <strong>{commerce.validation?.display_name ?? "Aún no eliges un ID"}</strong>
                <p>
                  {commerce.validation && <b>{identity.label}. </b>}
                  {identity.description}
                </p>
              </div>
              {isReady && (
                <button type="button" onClick={commerce.openIdentity}>
                  Cambiar ID
                </button>
              )}
            </div>
          </section>
          <section className={`checkout-contact ${activeQuote ? "" : "is-locked"}`} aria-labelledby="checkout-contact-title">
            <header className="checkout-step-title">
              <b>3</b>
              <div>
                <small>CONTACTO Y ORDEN</small>
                <h2 id="checkout-contact-title">¿Cómo te contactamos?</h2>
              </div>
            </header>
            {!activeQuote && (
              <p className="checkout-locked-note">
                Se activa cuando confirmes el precio. Ahí nos dejas tu WhatsApp y creas tu orden.
              </p>
            )}
            {activeQuote && (
              <>
                {(region === "us" ? activeQuote.amountUsdCents !== displayTotalWithFeeCents : activeQuote.amountMxnCents !== visibleTotal * 100) && (
                  <p className="notice">
                    El precio fue actualizado por el servidor. Revisa el total antes
                    de confirmar.
                  </p>
                )}
                <div id="checkout-contact" />
                <label>
                  WhatsApp de contacto
                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    pattern="[0-9]{8,12}"
                    minLength={8}
                    maxLength={12}
                    value={whatsapp}
                    onChange={(event) => setPhoneDraft({ sessionId: commerce.sessionId, value: event.target.value.replace(/\D/g, "").slice(0, 12) })}
                    placeholder="55 5555 5555"
                  />
                </label>
                <label>
                  Correo electrónico <span>(opcional)</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmailDraft({ sessionId: commerce.sessionId, value: event.target.value })}
                    placeholder="tu@correo.com"
                  />
                </label>
                {!commerce.authenticated && <p className="wallet-comparison">⚡ ¿Compras seguido? Con una cuenta y saldo de pavos, tus próximas compras se envían al instante, sin subir comprobante. <Link href="/pavos">Conoce los pavos</Link></p>}
                {commerce.authenticated && <fieldset className="payment-choice" disabled={loading}>
                  <legend>¿Cómo quieres pagar?</legend>
                  <p className="payment-choice-hint">Se paga el pedido completo con un solo método.</p>
                  <div className="payment-choice-cards">
                    <label className="payment-card" data-selected={useWalletPayment || undefined} data-unavailable={(insufficientWallet && !!wallet.data) || undefined}>
                      <input type="radio" name="payment-source" checked={useWalletPayment} onChange={() => setPaymentSource("wallet")} />
                      <span className="payment-card-head"><Coins aria-hidden="true" size={18} /><strong>Mis pavos de la tienda</strong>{walletComparison && walletComparison.savingsCents > 0 && <em>Ahorras {walletMoney(walletComparison.savingsCents, region)}</em>}</span>
                      <span className="payment-card-take">{!wallet.data ? (wallet.error ? "No pudimos leer tu saldo" : "Consultando tu saldo…") : wallet.data.balance >= walletCost
                        ? <>Se descuentan <b>{walletCost.toLocaleString("es-MX")} pavos</b> de tus {wallet.data.balance.toLocaleString("es-MX")}</>
                        : <>Necesitas <b>{walletCost.toLocaleString("es-MX")} pavos</b>; tienes {wallet.data.balance.toLocaleString("es-MX")}</>}</span>
                      <span className="payment-card-note">{walletBlockReason ?? "Envío automático a tu ID. Sin subir comprobante."}</span>
                    </label>
                    <label className="payment-card" data-selected={!useWalletPayment || undefined}>
                      <input type="radio" name="payment-source" checked={!useWalletPayment} onChange={() => setPaymentSource("external")} />
                      <span className="payment-card-head"><Landmark aria-hidden="true" size={18} /><strong>{region === "us" ? "PayPal" : "Transferencia bancaria"}</strong></span>
                      <span className="payment-card-take">Pagas <b>{region === "us" ? `${formatUsdCents(activeQuote.amountUsdCents ?? displayTotalWithFeeCents)} USD` : formatMxn(activeQuote.amountMxnCents / 100)}</b></span>
                      <span className="payment-card-note">Subes tu comprobante y enviamos al confirmarlo. No toca tu saldo.</span>
                    </label>
                  </div>
                  {useWalletPayment && wallet.data && <div className="payment-choice-detail">
                    <WalletMeter balance={wallet.data.balance} cost={walletCost} />
                    {walletComparison && walletComparison.savingsCents > 0 && <p className="wallet-comparison is-savings">Con pavos ahorras <strong>{walletMoney(walletComparison.savingsCents, region)}</strong>: el pago habitual sería {walletMoney(walletComparison.regularCents, region)}; tus {walletCost.toLocaleString("es-MX")} pavos equivalen a ≈ {walletMoney(walletComparison.equivalentCents, region)} a la tarifa de recarga actual.</p>}
                    {walletComparison && walletComparison.savingsCents < 0 && <p className="wallet-comparison">Para este pedido el pago habitual sale más barato: {walletMoney(walletComparison.regularCents, region)}, contra ≈ {walletMoney(walletComparison.equivalentCents, region)} en pavos a la tarifa de recarga actual.</p>}
                    {walletBlockedItems.length > 0 && <p role="alert">{walletBlockedItems.join(", ")} {walletBlockedItems.length === 1 ? "tiene" : "tienen"} precio especial y no se {walletBlockedItems.length === 1 ? "puede" : "pueden"} pagar con pavos. Usa el pago habitual o {walletBlockedItems.length === 1 ? "quítalo" : "quítalos"} del carrito.</p>}
                    {!wallet.data.automaticDelivery && <p role="alert">La entrega automática está temporalmente deshabilitada. No se descontará saldo; usa el pago habitual.</p>}
                    {wallet.data.frozen && <p role="alert">Tu saldo está en revisión y no se puede usar por ahora. Elige el pago habitual o escríbenos.</p>}
                    {wallet.data.paused && !wallet.data.frozen && <p role="alert">El pago con pavos está pausado unos minutos mientras revisamos las entregas. Tu saldo está seguro; usa el pago habitual o intenta más tarde.</p>}
                    {!insufficientWallet && <p className="payment-choice-next">Al confirmar se descuentan los pavos y el envío a <b>{commerce.validation?.display_name ?? "tu ID"}</b> empieza solo.</p>}
                  </div>}
                  {wallet.error && <p role="alert">{wallet.error}</p>}
                  {!useWalletPayment && wallet.data && wallet.data.balance === 0 && <p className="wallet-comparison">⚡ Recarga pavos una vez y tus próximas compras se envían al instante, sin subir comprobante. <Link href="/pavos">Ver cómo funciona</Link></p>}
                  {walletPromo && (!wallet.data || wallet.data.balance < walletCost) && <p className="wallet-comparison is-savings">🎁 {walletPromo.label}: recarga desde {walletPromo.min_vbucks.toLocaleString("es-MX")} pavos y recibe +{(walletPromo.bonus_bp / 100).toLocaleString("es-MX")}% de regalo, hasta el {new Date(walletPromo.ends_at).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}. <Link href="/pavos">Comprar pavos</Link></p>}
                  <small>Los pavos de la tienda son tu saldo en SigfriedLootBox, no paVos de tu cuenta de Epic.</small>
                </fieldset>}
                {!useWalletPayment && <div className="transfer-only">
                  <span aria-hidden="true">▣</span>
                  <div>
                    <strong>{region === "us" ? "Pago por PayPal" : "Transferencia bancaria"}</strong>
                    <small>
                      Después podrás subir tu comprobante o continuar por WhatsApp.
                    </small>
                  </div>
                </div>}
              </>
            )}
          </section>
          {!activeQuote && (
            <SystemActionBar className="checkout-quote-action" primaryFull>
              <span>
                <small>Total estimado</small>
                <strong>{formatDisplayTotal}</strong>
                <em>
                  {isReady
                    ? "Se confirma antes de crear tu orden"
                    : "Necesitas un ID listo para continuar"}
                </em>
              </span>
              <button
                type="button"
                className="primary-button"
                disabled={loading || !lines.length}
                onClick={isReady ? openQuoteSheet : commerce.openIdentity}
              >
                {loading
                  ? "Confirmando…"
                  : isReady
                    ? "Confirmar precio y continuar"
                    : identity.actionLabel}
              </button>
            </SystemActionBar>
          )}
          {activeQuote && (
            <SystemActionBar className="checkout-final-action" primaryFull>
              <span>
                <small>Total confirmado</small>
                <strong>{formatActiveQuoteTotal}</strong>
                <em>
                  {useWalletPayment && wallet.data && wallet.data.balance >= walletCost ? `Te quedan ${(wallet.data.balance - walletCost).toLocaleString("es-MX")} pavos · ` : ""}
                  Reservado hasta{" "}
                  {new Date(activeQuote.expiresAt).toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </em>
              </span>
              <button className="primary-button" disabled={loading || (useWalletPayment && insufficientWallet)}>
                {loading ? "Creando pedido…" : useWalletPayment ? "Pagar con mis pavos y enviar" : "Confirmar pedido"}
              </button>
            </SystemActionBar>
          )}
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          {commerce.ready && !commerce.authenticated && (
            <aside id="checkout-account" className="checkout-guest-access">
              <div>
                <strong>Compra sin crear una cuenta</strong>
                <p>Tu ID receptor y WhatsApp son suficientes para continuar.</p>
              </div>
              <Link href="/cuenta?next=/checkout">Prefiero iniciar sesión</Link>
            </aside>
          )}
        </div>
      </form>
      </div>
      <CommerceSheet
        open={quoteSheetOpen}
        onClose={closeQuoteSheet}
        titleId="quote-sheet-title"
        eyebrow="PASO 2 · COMPRA PROTEGIDA"
        title="Precio y disponibilidad"
        description="Confirmamos los importes directamente en el servidor antes de crear tu orden."
        className="quote-confirmation-sheet"
      >
        {loading && (
          <div className="quote-sheet-loading" aria-live="polite">
            <Clock3 aria-hidden="true" size={22} />
            <div>
              <strong>Confirmando tu selección</strong>
              <span>Revisamos precio y disponibilidad de cada objeto.</span>
            </div>
          </div>
        )}
        {!loading && activeQuote && (
          <div className="quote-sheet-result" aria-live="polite">
            <div className="quote-sheet-status">
              <BadgeCheck aria-hidden="true" size={20} />
              <div>
                <strong>Precio confirmado</strong>
                <span>Disponible para continuar con contacto y orden.</span>
              </div>
            </div>
            <div className="quote-sheet-lines">
              {activeQuote.lines.map((line) => (
                <p key={line.itemMainId}>
                  <span>{line.name}</span>
                  <strong>{useWalletPayment ? `${line.vbucksPrice} pavos` : activeQuote.currency === "USD" && line.amountUsdCents !== null ? `${formatUsdCents(line.amountUsdCents)} USD` : formatRegionalAmount(line.vbucksPrice, line.amountMxnCents)}</strong>
                </p>
              ))}
              {!useWalletPayment && activeQuote.currency === "USD" && <p><span>Comisión PayPal</span><strong>{formatUsdCents(activeQuote.paypalFeeUsdCents ?? PAYPAL_FEE_USD_CENTS)} USD</strong></p>}
            </div>
            <div className="quote-sheet-total">
              <span>Total confirmado</span>
              <strong>{formatActiveQuoteTotal}</strong>
            </div>
            <p className="quote-sheet-expiry">
              <ShieldCheck aria-hidden="true" size={15} />
              Reservado hasta{" "}
              {new Date(activeQuote.expiresAt).toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <SystemActionBar
              className="quote-sheet-actions"
              variant="contained"
            >
              <button
                type="button"
                className="primary-button"
                onClick={continueToContact}
              >
                Continuar a contacto y orden
              </button>
            </SystemActionBar>
          </div>
        )}
        {!loading && error && (
          <div className="quote-sheet-error">
            <p className="notice error" role="alert">
              {error}
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={() => void createQuote()}
            >
              Intentar nuevamente
            </button>
          </div>
        )}
      </CommerceSheet>
    </section>
  );
}
