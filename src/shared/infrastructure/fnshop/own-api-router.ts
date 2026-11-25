import type { SupabaseClient } from "@supabase/supabase-js";
import type { FnShopAction, FnShopUsage } from "./fnshop-budget";
import type { FnShopCallContext, FnShopCaller, FnShopConfig, FnShopResponse } from "./fnshop-client";

/**
 * Migración gradual a nuestra propia API (epic-gifting, compatible con FN Shop v3).
 *
 * - `primary`: se llama primero a nuestra API; si no responde o responde un código de
 *   «no puedo» (sin cuentas, Epic caído…), se llama a FN Shop como respaldo.
 * - `shadow`: decide FN Shop; nuestra API se llama en paralelo solo para comparar y registrar.
 * - Las acciones que gastan paVos (`gift_send`) y la conciliación nunca van a `primary` aquí:
 *   un envío dudoso jamás se repite en otro proveedor.
 *
 * Cada llamada a nuestra API queda en `provider_api_calls` con `provider = 'own'`
 * (no cuenta contra la cuota de FN Shop).
 */
export type OwnApiConfig = Readonly<{
  baseUrl: string;
  apiKey: string;
  primary: readonly FnShopAction[];
  shadow: readonly FnShopAction[];
  timeoutMs: number;
}>;

/** Nunca pueden ir primero a nuestra API desde esta capa: gastan paVos o deciden un envío. */
const NEVER_PRIMARY: readonly FnShopAction[] = ["gift_send", "order_history"];

/** Respuestas de nuestra API que significan «no pude», no «la respuesta es no». */
const FALLBACK_CODES = new Set([
  "no_sender_accounts", "epic_unavailable", "action_not_supported", "internal_error", "invalid_api_key", "unknown_action",
]);

function actions(value: string | undefined, fallback: readonly FnShopAction[]): FnShopAction[] {
  if (value === undefined) return [...fallback];
  return value.split(",").map((item) => item.trim()).filter(Boolean) as FnShopAction[];
}

export function ownApiConfigFromEnv(env: Record<string, string | undefined>, fnshop: FnShopConfig): OwnApiConfig | null {
  // Como FN Shop: solo producción llama a servicios reales (nuestra API usa cuentas de Epic reales).
  if (!fnshop.liveAllowed || fnshop.simulate) return null;
  const baseUrl = env.OWN_API_BASE_URL?.trim().replace(/\/+$/, "");
  const apiKey = env.OWN_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  return {
    baseUrl,
    apiKey,
    primary: actions(env.OWN_API_PRIMARY, ["friend_add", "friend_status"]).filter((action) => !NEVER_PRIMARY.includes(action)),
    shadow: actions(env.OWN_API_SHADOW, ["gift_check"]),
    timeoutMs: Number.parseInt(env.OWN_API_TIMEOUT_MS ?? "", 10) > 0 ? Number.parseInt(env.OWN_API_TIMEOUT_MS!, 10) : 20_000,
  };
}

type OwnOutcome = { usable: boolean; response: FnShopResponse | null; reason: string | null };

export class OwnApiFirstCaller implements FnShopCaller {
  constructor(
    private readonly database: SupabaseClient,
    private readonly fnshop: FnShopCaller,
    private readonly own: OwnApiConfig,
    private readonly options: { fetch?: typeof fetch } = {},
  ) {}

  get config(): FnShopConfig {
    return this.fnshop.config;
  }

  usage(): Promise<FnShopUsage> {
    return this.fnshop.usage();
  }

  decide(callId: number | null, decision: string): Promise<void> {
    return this.fnshop.decide(callId, decision);
  }

  async call(action: FnShopAction, params: Record<string, string>, context: FnShopCallContext): Promise<FnShopResponse> {
    if (this.own.primary.includes(action)) {
      const own = await this.callOwn(action, params, context, "primary");
      if (own.usable && own.response) return own.response;
      console.warn("own_api.fallback_to_fnshop", { action, reason: own.reason });
      return this.fnshop.call(action, params, context);
    }
    if (this.own.shadow.includes(action)) {
      const shadow = this.callOwn(action, params, context, "shadow").catch(() => null);
      const main = await this.fnshop.call(action, params, context);
      await shadow;
      return main;
    }
    return this.fnshop.call(action, params, context);
  }

  private async callOwn(action: FnShopAction, params: Record<string, string>, context: FnShopCallContext, mode: "primary" | "shadow"): Promise<OwnOutcome> {
    const requestParams = { svr: this.fnshop.config.domain, ...params };
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), mode === "shadow" ? Math.min(this.own.timeoutMs, 15_000) : this.own.timeoutMs);
    let httpStatus = 0;
    let body: Record<string, unknown> | null = null;
    let transportError: string | null = null;
    try {
      const response = await (this.options.fetch ?? fetch)(`${this.own.baseUrl}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "X-Api-Key": this.own.apiKey },
        body: new URLSearchParams(requestParams).toString(),
        cache: "no-store",
        signal: controller.signal,
      });
      httpStatus = response.status;
      const parsed: unknown = JSON.parse(await response.text());
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
      else transportError = "La respuesta no es un objeto JSON.";
    } catch (error) {
      transportError = error instanceof Error && error.name === "AbortError" ? "Tiempo de espera agotado." : error instanceof Error ? error.message : "Error de red.";
    } finally {
      clearTimeout(timeout);
    }

    const result = typeof body?.result === "boolean" ? body.result : null;
    const code = typeof body?.code === "string" ? body.code : null;
    const reason = transportError ?? (httpStatus >= 500 ? `HTTP ${httpStatus}` : code && FALLBACK_CODES.has(code) ? code : null);
    const usable = mode === "primary" && body !== null && reason === null;
    const decision = mode === "shadow" ? "shadow" : usable ? null : "fallback_to_fnshop";

    const { data, error } = await this.database.from("provider_api_calls").insert({
      provider: "own",
      action,
      environment: this.fnshop.config.environment,
      simulated: false,
      trigger: context.trigger,
      actor_id: context.actorId ?? null,
      correlation_id: context.correlationId ?? null,
      validation_id: context.validationId ?? null,
      order_id: context.orderId ?? null,
      order_item_id: context.orderItemId ?? null,
      request_params: requestParams,
      http_status: httpStatus || null,
      response_body: body,
      response_headers: null,
      result,
      code,
      counted: false,
      duration_ms: Date.now() - started,
      error: transportError,
      decision,
    }).select("id").single<{ id: number }>();
    if (error) console.error("own_api.ledger.insert.failed", { action, code, error });

    if (!usable || !body) return { usable: false, response: null, reason: reason ?? "sin respuesta" };
    return { usable: true, response: { body, result, code, httpStatus, callId: data?.id ?? null, simulated: false }, reason: null };
  }
}

