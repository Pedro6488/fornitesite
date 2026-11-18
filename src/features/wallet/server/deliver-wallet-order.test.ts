import { beforeEach, describe, expect, it, vi } from "vitest";
import { deliverWalletOrder } from "./deliver-wallet-order";
const mocks = vi.hoisted(() => ({ deliver:vi.fn(),reconcile:vi.fn(),load:vi.fn(),client:vi.fn(),alert:vi.fn(),transition:vi.fn(),pause:vi.fn(),paused:vi.fn() }));
vi.mock("@/features/fulfillment/application/deliver-order", () => ({ deliverOrder:mocks.deliver,reconcileOrder:mocks.reconcile }));
vi.mock("@/features/fnshop/server/get-fnshop-client", () => ({ getFnShopClient:mocks.client,sendOperationsAlert:mocks.alert }));
vi.mock("@/features/fulfillment/infrastructure/supabase-delivery-store", () => ({ SupabaseDeliveryStore: class { load=mocks.load; transition=mocks.transition; } }));
vi.mock("./wallet-pause", () => ({ pauseWalletPayments:mocks.pause,walletPaymentsPaused:mocks.paused }));
function database(status="paid") {
  const rpc = vi.fn().mockResolvedValue({ data:0,error:null });
  return { rpc,from:() => ({ select:() => ({ eq:() => ({ single:async () => ({ data:{ id:"order",user_id:"customer",status,payment_source:"wallet",updated_at:"2026-01-01T00:00:00Z" },error:null }) }) }) }) };
}
describe("envío automático con pavos", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.client.mockReturnValue({}); mocks.load.mockResolvedValue({ status:"delivered",items:[] });
    mocks.deliver.mockResolvedValue({ status:"delivered",items:[],message:"" }); mocks.paused.mockResolvedValue(false);
  });
  it("envía un pedido pagado como sistema sin aprobar una transferencia", async () => {
    const db=database();
    await deliverWalletOrder(db as never,"order");
    expect(mocks.deliver).toHaveBeenCalledWith(expect.objectContaining({ actorId:"customer",confirmPayment:false,trigger:"system" }),expect.anything());
    expect(db.rpc).toHaveBeenCalledWith("refund_wallet_failures",{ p_order:"order",p_include_unattempted:false });
    expect(mocks.pause).not.toHaveBeenCalled();
  });
  it("si falla la cuenta emisora pausa el pago con pavos y devuelve al instante lo no intentado", async () => {
    mocks.deliver.mockResolvedValue({ status:"manual_review",items:[],message:"",senderDown:true });
    mocks.load.mockResolvedValue({ status:"refunded",items:[] });
    const db=database();
    await deliverWalletOrder(db as never,"order");
    expect(mocks.pause).toHaveBeenCalledWith(db,expect.stringContaining("cuenta emisora"));
    expect(mocks.alert).toHaveBeenCalledWith(db,expect.stringContaining("Pausé el pago con pavos"),expect.stringMatching(/^wallet:paused:/),"/admin/pavos");
    expect(db.rpc).toHaveBeenCalledWith("refund_wallet_failures",{ p_order:"order",p_include_unattempted:true });
  });
  it("mientras está pausado no reanuda envíos: devuelve lo pendiente y avisa", async () => {
    mocks.paused.mockResolvedValue(true);
    mocks.load.mockResolvedValue({ status:"manual_review",items:[{ fulfillment:null }] });
    const db=database("manual_review");
    await deliverWalletOrder(db as never,"order");
    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledWith("refund_wallet_failures",{ p_order:"order",p_include_unattempted:true });
  });
  it("reanuda objetos nunca intentados cuando no hay pausa", async () => {
    mocks.load.mockResolvedValue({ status:"manual_review",items:[{ fulfillment:null }] });
    await expect(deliverWalletOrder(database("manual_review") as never,"order")).rejects.toThrow("siguiente ejecución");
    expect(mocks.deliver).toHaveBeenCalledTimes(1);
  });
  it("no vuelve a enviar regalos con resultado incierto", async () => {
    mocks.load.mockResolvedValue({ status:"manual_review",items:[{ fulfillment:{ status:"failed" } }] });
    await deliverWalletOrder(database("manual_review") as never,"order");
    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(mocks.alert).toHaveBeenCalled();
  });
  it("consulta el historial al recuperar una entrega interrumpida", async () => {
    await deliverWalletOrder(database("delivering") as never,"order");
    expect(mocks.reconcile).toHaveBeenCalled(); expect(mocks.deliver).not.toHaveBeenCalled();
  });
  it("conserva la cola si el proveedor está temporalmente deshabilitado", async () => {
    mocks.client.mockReturnValue(null);
    await expect(deliverWalletOrder(database() as never,"order")).rejects.toThrow("no está disponible");
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
});
