import type { SupabaseClient } from "@supabase/supabase-js";
import { budgetDecision, crossedThresholds, type FnShopAction, type FnShopUsage } from "./fnshop-budget";
import { simulateFnShop } from "./fnshop-simulator";

/**
 * Único lugar del código que habla con FN Shop.
 *
 * - POST form-encoded con `X-Api-Key` (la API no acepta JSON).
 * - El éxito se lee en `result` y `code`, nunca en el HTTP 200.
 * - Antes de cada llamada revisa la cuota; después la registra en `provider_api_calls`.
 * - Fuera de producción no llama a la API: responde el simulador o falla.
 *   La key se liga al dominio en su primer uso, por eso local, CI y QA nunca la tocan.
 */
export type FnShopTrigger = "customer" | "admin" | "system";

export type FnShopCallContext = Readonly<{
  trigger: FnShopTrigger;
  actorId?: string | null;
  correlationId?: string | null;
  validationId?: string | null;
  orderId?: string | null;
  orderItemId?: string | null;
}>;

export type FnShopResponse = Readonly<{
  body: Record<string, unknown>;
  result: boolean | null;
  code: string | null;
  httpStatus: number;
  callId: number | null;
  simulated: boolean;
}>;

export type FnShopConfig = Readonly<{
  baseUrl: string;
  apiKey: string | null;
  simulate: boolean;
  liveAllowed: boolean;
  environment: string;
  monthlyLimit: number;
  dailyLimit: number;
  termStartsAt: Date;
  category: string | null;
  timeoutMs: number;
}>;

/** No se pudo llamar: falta configuración, la cuota no lo permite o el entorno no es producción. */
export class FnShopUnavailableError extends Error {
  constructor(readonly reason: "not_configured" | "live_blocked" | "budget", message: string) {
    super(message);
    this.name = "FnShopUnavailableError";
  }
}

/** La petición salió pero no hubo respuesta legible (timeout, red, HTML). Para un envío, el resultado es dudoso. */
export class FnShopTransportError extends Error {
  constructor(message: string, readonly callId: number | null) {
    super(message);
    this.name = "FnShopTransportError";
  }
}

export interface FnShopCaller {
  call(action: FnShopAction, params: Record<string, string>, context: FnShopCallContext): Promise<FnShopResponse>;
  decide(callId: number | null, decision: string): Promise<void>;
  usage(): Promise<FnShopUsage>;
  readonly config: FnShopConfig;
}

const DEFAULT_BASE_URL = "https://fnitem.shop/api/v3/service";
const SLOW_ACTIONS: readonly FnShopAction[] = ["gift_send", "gift_check", "friend_add"];

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function fnShopConfigFromEnv(env: Record<string, string | undefined> = process.env): FnShopConfig {
  const production = env.VERCEL_ENV === "production";
  const termStartsAt = new Date(env.FNSHOP_TERM_STARTS_AT?.trim() || Date.now() - 30 * 86400_000);
  return {
    baseUrl: (env.FNSHOP_API_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    apiKey: env.FNSHOP_API_KEY?.trim() || null,
    // El simulador nunca corre en producción, aunque alguien deje la variable encendida.
    simulate: env.FNSHOP_SIMULATE === "true" && !production,
    liveAllowed: production,
    environment: env.VERCEL_ENV ?? env.NODE_ENV ?? "development",
    monthlyLimit: positiveInteger(env.FNSHOP_MONTHLY_LIMIT, 5000),
    dailyLimit: positiveInteger(env.FNSHOP_DAILY_LIMIT, 300),
    termStartsAt: Number.isNaN(termStartsAt.getTime()) ? new Date(Date.now() - 30 * 86400_000) : termStartsAt,
    category: env.FNSHOP_CATEGORY?.trim() || null,
    timeoutMs: positiveInteger(env.FNSHOP_TIMEOUT_MS, 25_000),
  };
}

/** Sí se puede usar FN Shop en este entorno (simulado o real). */
export function fnShopAvailable(config: FnShopConfig): boolean {
  return config.simulate || (config.liveAllowed && Boolean(config.apiKey));
}

/** Solo los encabezados que sirven para entender la respuesta; nunca cookies ni credenciales. */
function safeHeaders(headers: Headers): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const name of ["content-type", "date", "retry-after", "x-ratelimit-remaining", "x-ratelimit-limit", "cf-ray"]) {
    const value = headers.get(name);
    if (value) kept[name] = value;
  }
  return kept;
}

export class FnShopClient implements FnShopCaller {
  constructor(
    private readonly database: SupabaseClient,
    readonly config: FnShopConfig,
    private readonly options: { fetch?: typeof fetch; alert?: (text: string, dedupeKey: string) => Promise<void> } = {},
  ) {}

  async usage(): Promise<FnShopUsage> {
    const { data, error } = await this.database.rpc("fnshop_usage_summary", { p_since: this.config.termStartsAt.toISOString() });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { counted_total?: number | string; counted_today?: number | string } | null;
    return { used: Number(row?.counted_total ?? 0), today: Number(row?.counted_today ?? 0) };
  }

  async call(action: FnShopAction, params: Record<string, string>, context: FnShopCallContext): Promise<FnShopResponse> {
    const simulated = this.config.simulate;
    if (!simulated) {
      if (!this.config.liveAllowed) throw new FnShopUnavailableError("live_blocked", "FN Shop solo se llama desde producción. Usa FNSHOP_SIMULATE=true en local y QA.");
      if (!this.config.apiKey) throw new FnShopUnavailableError("not_configured", "Falta FNSHOP_API_KEY.");
    }

    const usageBefore = await this.usage();
    const decision = budgetDecision(action, usageBefore, this.config);
    if (!decision.allowed) {
      await this.alertOnce(`⚠️ FN Shop: se bloqueó ${action}. ${decision.reason}`, `fnshop:blocked:${decision.level}:${new Date().toISOString().slice(0, 10)}`);
      throw new FnShopUnavailableError("budget", decision.reason ?? "La cuota de FN Shop no permite esta llamada.");
    }

    const requestParams = { ...params };
    const started = Date.now();
    let httpStatus = 0;
    let body: Record<string, unknown> | null = null;
    let headers: Record<string, string> | null = null;
    let transportError: string | null = null;

    if (simulated) {
      body = simulateFnShop(action, params);
      httpStatus = 200;
    } else {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SLOW_ACTIONS.includes(action) ? this.config.timeoutMs : Math.min(this.config.timeoutMs, 15_000));
      try {
        const response = await (this.options.fetch ?? fetch)(`${this.config.baseUrl}/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "X-Api-Key": this.config.apiKey! },
          body: new URLSearchParams(params).toString(),
          cache: "no-store",
          signal: controller.signal,
        });
        httpStatus = response.status;
        headers = safeHeaders(response.headers);
        const text = await response.text();
        try {
          const parsed: unknown = JSON.parse(text);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
          else transportError = "La respuesta no es un objeto JSON.";
        } catch {
          transportError = `Respuesta no JSON (HTTP ${response.status}).`;
        }
      } catch (error) {
        transportError = error instanceof Error && error.name === "AbortError" ? "Tiempo de espera agotado." : error instanceof Error ? error.message : "Error de red.";
      } finally {
        clearTimeout(timeout);
      }
    }

    const result = typeof body?.result === "boolean" ? body.result : null;
    const code = typeof body?.code === "string" ? body.code : null;
    // verify_license nunca cuenta; un rechazo por plan_limit_reached tampoco.
    // Sin respuesta legible no sabemos si contó: se cuenta para no quedarnos cortos.
    const counted = !simulated && action !== "verify_license" && code !== "plan_limit_reached";
    const callId = await this.record({
      action, simulated, context, requestParams, httpStatus, body, headers, result, code, counted,
      durationMs: Date.now() - started, error: transportError,
    });

    if (counted) {
      const after = usageBefore.used + 1;
      for (const percent of crossedThresholds(usageBefore.used, after, this.config.monthlyLimit)) {
        await this.alertOnce(`📊 FN Shop: se usó el ${percent} % de la cuota (${after} de ${this.config.monthlyLimit} requests).`, `fnshop:quota:${percent}:${this.config.termStartsAt.toISOString().slice(0, 10)}`);
      }
      if (usageBefore.today + 1 === this.config.dailyLimit) {
        await this.alertOnce(`📊 FN Shop: se alcanzó el tope diario de ${this.config.dailyLimit} requests.`, `fnshop:daily:${new Date().toISOString().slice(0, 10)}`);
      }
    }
    if (code === "plan_limit_reached") {
      await this.alertOnce("⛔ FN Shop respondió plan_limit_reached: se acabaron los requests del plan.", `fnshop:plan_limit:${new Date().toISOString().slice(0, 10)}`);
    }

    if (transportError || !body) throw new FnShopTransportError(transportError ?? "Sin respuesta.", callId);
    return { body, result, code, httpStatus, callId, simulated };
  }

  async decide(callId: number | null, decision: string): Promise<void> {
    if (callId === null) return;
    const { error } = await this.database.from("provider_api_calls").update({ decision }).eq("id", callId).is("decision", null);
    if (error) console.error("fnshop.ledger.decision.failed", { callId, error });
  }

  private async record(entry: {
    action: FnShopAction; simulated: boolean; context: FnShopCallContext; requestParams: Record<string, string>;
    httpStatus: number; body: Record<string, unknown> | null; headers: Record<string, string> | null;
    result: boolean | null; code: string | null; counted: boolean; durationMs: number; error: string | null;
  }): Promise<number | null> {
    const { data, error } = await this.database.from("provider_api_calls").insert({
      provider: "fnshop",
      action: entry.action,
      environment: this.config.environment,
      simulated: entry.simulated,
      trigger: entry.context.trigger,
      actor_id: entry.context.actorId ?? null,
      correlation_id: entry.context.correlationId ?? null,
      validation_id: entry.context.validationId ?? null,
      order_id: entry.context.orderId ?? null,
      order_item_id: entry.context.orderItemId ?? null,
      request_params: entry.requestParams,
      http_status: entry.httpStatus || null,
      response_body: entry.body,
      response_headers: entry.headers,
      result: entry.result,
      code: entry.code,
      counted: entry.counted,
      duration_ms: entry.durationMs,
      error: entry.error,
    }).select("id").single<{ id: number }>();
    if (error) {
      // La llamada ya salió: no se puede deshacer. Se registra en los logs para cuadrar a mano.
      console.error("fnshop.ledger.insert.failed", { action: entry.action, code: entry.code, error });
      return null;
    }
    return data.id;
  }

  private async alertOnce(text: string, dedupeKey: string) {
    try { await this.options.alert?.(text, dedupeKey); }
    catch (error) { console.error("fnshop.alert.failed", { dedupeKey, error }); }
  }
}
