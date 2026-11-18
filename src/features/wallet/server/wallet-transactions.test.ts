// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

let db: PGlite;
const customer = randomUUID(), admin = randomUUID(), other = randomUUID(), session = randomUUID(), validation = randomUUID();
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema auth; create schema storage; create schema extensions;
    create role anon; create role authenticated; create role service_role bypassrls;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as 'select null::uuid';
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  const directory = path.resolve("supabase/migrations");
  for (const file of (await readdir(directory)).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = (await readFile(path.join(directory,file),"utf8")).replace("create extension if not exists pgcrypto with schema extensions;", "");
    try { await db.exec(sql); } catch (error) {
      const detail = error as { message: string; position?: string; internalPosition?: string; internalQuery?: string };
      throw new Error(`Migration ${file}: ${JSON.stringify(detail, ["message","position","internalPosition","internalQuery"])}`);
    }
  }
},120000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec("begin");
  await db.query("insert into auth.users(id,email) values($1,'customer@example.com'),($2,'admin@example.com'),($3,'other@example.com')",[customer,admin,other]);
  await db.query("update profiles set role='admin' where id=$1",[admin]);
  await db.query("insert into commerce_sessions(id,anonymous_token_hash,user_id) values($1,'test-token',$2)",[session,customer]);
  await db.query("insert into game_id_validations(id,commerce_session_id,user_id,platform,submitted_id,epic_account_id,display_name,status) values($1,$2,$3,'epic','Player','0123456789abcdef0123456789abcdef','Player','ready')",[validation,session,customer]);
  await db.exec("update wallet_rates set active=true,cents_per_100=500");
});
afterEach(async () => { await db.exec("rollback"); });

async function credit(vbucks=1000) {
  const t = (await db.query<{ id:string }>("select id from create_wallet_topup($1,'mx',$2,$3,$4)",[customer,vbucks,vbucks/100*500,randomUUID()])).rows[0];
  await db.query("update wallet_topups set status='submitted',receipt_path='test-proof' where id=$1",[t.id]);
  await db.query("select review_wallet_topup($1,$2,true,'Confirmado')",[t.id,admin]);
  return t.id;
}
async function quote(cost=800) {
  const id = randomUUID();
  await db.query("insert into checkout_quotes(id,commerce_session_id,validation_id,amount_mxn_cents,total_vbucks,expires_at) values($1,$2,$3,4000,$4,now()+interval '30 minutes')",[id,session,validation,cost]);
  await db.query("insert into checkout_quote_items(quote_id,item_main_id,offer_id,item_name,vbucks_price,unit_amount_mxn_cents,quantity) values($1,'main-a','offer-a','Objeto',$2,4000,1)",[id,cost]);
  return id;
}
const buy = (q:string,key=randomUUID(),user=customer) => db.query<{ order_id:string }>("select * from create_wallet_order($1,$2,$3,$4,'5512345678','customer@example.com',$5)",[user,session,q,validation,key]);
async function balance() { return (await db.query<{ balance:number }>("select balance from wallet_accounts where user_id=$1",[customer])).rows[0]?.balance ?? 0; }

describe("transacciones reales de pavos en PostgreSQL", () => {
  it("solo un worker puede reclamar el envío y recupera trabajos interrumpidos", async () => {
    await credit(); const id=(await buy(await quote())).rows[0].order_id;
    expect((await db.query("select * from claim_wallet_job($1)",[id])).rows).toHaveLength(1);
    expect((await db.query("select * from claim_wallet_job($1)",[id])).rows).toHaveLength(0);
    await db.query("update outbox_jobs set locked_at=now()-interval '6 minutes' where aggregate_id=$1",[id]);
    expect((await db.query("select * from claim_wallet_job($1)",[id])).rows).toHaveLength(1);
  });
  it("una recarga rechazada no aumenta el saldo", async () => {
    const t = (await db.query<{id:string}>("select id from create_wallet_topup($1,'mx',1000,5000,$2)",[customer,randomUUID()])).rows[0];
    await db.query("update wallet_topups set status='submitted',receipt_path='proof' where id=$1",[t.id]);
    await db.query("select review_wallet_topup($1,$2,false,'El pago no se refleja')",[t.id,admin]);
    expect(await balance()).toBe(0);
  });
  it("no descuenta saldo para un destinatario que ya no está listo", async () => {
    await credit(); const q=await quote();
    await db.query("update game_id_validations set status='blocked' where id=$1",[validation]);
    await db.exec("savepoint blocked");
    await expect(buy(q)).rejects.toThrow("recipient_not_ready");
    await db.exec("rollback to blocked");
    expect(await balance()).toBe(1000);
  });
  it("acredita una recarga una sola vez aunque se apruebe de nuevo", async () => {
    const id = await credit(3500);
    await db.query("select review_wallet_topup($1,$2,true,'Reintento')",[id,admin]);
    expect(await balance()).toBe(3500);
    expect((await db.query("select * from wallet_ledger")).rows).toHaveLength(1);
  });
  it("rechaza acreditar una recarga sin comprobante o por un cliente", async () => {
    const t = (await db.query<{id:string}>("select id from create_wallet_topup($1,'mx',1000,5000,$2)",[customer,randomUUID()])).rows[0];
    await db.exec("savepoint invalid_review");
    await expect(db.query("select review_wallet_topup($1,$2,true,'')",[t.id,admin])).rejects.toThrow("receipt_required");
    await db.exec("rollback to invalid_review");
    await expect(db.query("select review_wallet_topup($1,$2,true,'')",[t.id,customer])).rejects.toThrow("not_admin");
  });
  it("descuenta una sola vez, marca pagado y encola la entrega automáticamente", async () => {
    await credit(3500); const q = await quote(1500), key=randomUUID();
    const first = await buy(q,key), second = await buy(q,key);
    expect(first.rows).toEqual(second.rows);
    expect(await balance()).toBe(2000);
    const o = (await db.query<{status:string;payment_source:string}>("select status,payment_source from orders")).rows[0];
    expect(o).toEqual({ status:"paid",payment_source:"wallet" });
    expect((await db.query("select * from outbox_jobs where job_type='wallet.deliver'")).rows).toHaveLength(1);
  });
  it("no crea pedidos ni consume la cotización cuando falta saldo", async () => {
    await credit(); const q=await quote(1500);
    await db.exec("savepoint insufficient");
    await expect(buy(q)).rejects.toThrow("insufficient_balance");
    await db.exec("rollback to insufficient");
    expect(await balance()).toBe(1000);
    expect((await db.query("select * from orders")).rows).toHaveLength(0);
    expect((await db.query<{consumed_at:null}>("select consumed_at from checkout_quotes where id=$1",[q])).rows[0].consumed_at).toBeNull();
  });
  it("un segundo pedido no puede gastar saldo que ya se utilizó", async () => {
    await credit(1000); const q1=await quote(800),q2=await quote(800);
    await buy(q1); await db.exec("savepoint second_buy");
    await expect(buy(q2)).rejects.toThrow("insufficient_balance");
    await db.exec("rollback to second_buy");
    expect(await balance()).toBe(200);
  });
  it("no permite usar la cuenta de pavos de otro usuario", async () => {
    await credit(); const q=await quote();
    await expect(buy(q,randomUUID(),other)).rejects.toThrow("login_required");
  });
  it("devuelve una sola vez un rechazo definitivo y bloquea su reenvío", async () => {
    await credit(); const o=(await buy(await quote())).rows[0].order_id;
    await db.query("update orders set status='delivering' where id=$1",[o]);
    const item=(await db.query<{id:string}>("select id from order_items where order_id=$1",[o])).rows[0].id;
    expect((await db.query<{claimed:boolean}>("select claim_wallet_delivery_item($1,$2,'Player',null,$3) as claimed",[o,item,customer])).rows[0].claimed).toBe(true);
    await db.query("update fulfillments set status='failed',result_code='purchase_not_allowed' where order_item_id=$1",[item]);
    await db.query("update orders set status='manual_review' where id=$1",[o]);
    await db.query("select refund_wallet_failures($1)",[o]); await db.query("select refund_wallet_failures($1)",[o]);
    expect(await balance()).toBe(1000);
    await db.query("update orders set status='delivering' where id=$1",[o]);
    expect((await db.query<{claimed:boolean}>("select claim_wallet_delivery_item($1,$2,'Player',null,$3) as claimed",[o,item,customer])).rows[0].claimed).toBe(false);
  });
  it.each([['unknown','transport_error'],['failed','not_in_history'],['sent','gift_sent_successfully']])("no devuelve saldo para un envío %s / %s",async(status,code) => {
    await credit(); const o=(await buy(await quote())).rows[0].order_id;
    await db.query("update orders set status='manual_review' where id=$1",[o]);
    await db.query("insert into fulfillments(order_id,order_item_id,status,result_code) select order_id,id,$2,$3 from order_items where order_id=$1",[o,status,code]);
    await db.query("select refund_wallet_failures($1)",[o]);
    expect(await balance()).toBe(200);
  });
  it("no habilita recargas sin tarifa ni acepta precios manipulados", async () => {
    await db.exec("update wallet_rates set active=false; savepoint disabled_rate");
    await expect(credit()).rejects.toThrow("rate_disabled");
    await db.exec("rollback to disabled_rate; update wallet_rates set active=true");
    await expect(db.query("select * from create_wallet_topup($1,'mx',1000,1,$2)",[customer,randomUUID()])).rejects.toThrow("rate_changed");
  });
  it("el worker general ya no toma entregas con pavos; solo claim_wallet_job", async () => {
    await credit(); const id=(await buy(await quote())).rows[0].order_id;
    await db.query("insert into outbox_jobs(job_type,payload,dedupe_key) values('email.welcome','{}','test:welcome')");
    const general = (await db.query<{ job_type:string }>("select job_type from claim_outbox_jobs(100)")).rows.map((row) => row.job_type);
    expect(general).toContain("email.welcome");
    expect(general).not.toContain("wallet.deliver");
    expect((await db.query("select * from claim_wallet_job($1)",[id])).rows).toHaveLength(1);
  });
  it("una recarga vencida no acepta comprobante y el barrido la marca como vencida", async () => {
    const fresh = (await db.query<{id:string;expires_at:string}>("select id,expires_at from create_wallet_topup($1,'mx',1000,5000,$2)",[customer,randomUUID()])).rows[0];
    expect(new Date(fresh.expires_at).getTime() - Date.now()).toBeGreaterThan(47 * 3600_000);
    await db.query("update wallet_topups set expires_at=now()-interval '1 minute' where id=$1",[fresh.id]);
    await db.exec("savepoint expired_receipt");
    await expect(db.query("update wallet_topups set status='submitted',receipt_path='late-proof' where id=$1",[fresh.id])).rejects.toThrow("topup_expired");
    await db.exec("rollback to expired_receipt");
    expect((await db.query<{ n:number }>("select expire_wallet_topups() as n")).rows[0].n).toBe(1);
    expect((await db.query<{ status:string }>("select status from wallet_topups where id=$1",[fresh.id])).rows[0].status).toBe("expired");
    expect(await balance()).toBe(0);
  });
  it("una cuenta congelada no puede comprar con pavos y vuelve a comprar al descongelarla", async () => {
    await credit(); const q = await quote();
    await db.exec("savepoint short_reason");
    await expect(db.query("select set_wallet_frozen($1,$2,true,'')",[customer,admin])).rejects.toThrow("reason_required");
    await db.exec("rollback to short_reason");
    await db.query("select set_wallet_frozen($1,$2,true,'Contracargo de PayPal')",[customer,admin]);
    await db.exec("savepoint frozen_buy");
    await expect(buy(q)).rejects.toThrow("account_frozen");
    await db.exec("rollback to frozen_buy");
    expect(await balance()).toBe(1000);
    await db.query("select set_wallet_frozen($1,$2,false,'')",[customer,admin]);
    await buy(q);
    expect(await balance()).toBe(200);
  });
  it("un ajuste exige admin y motivo, nunca deja saldo negativo y queda en los totales", async () => {
    await credit(1000);
    await db.exec("savepoint not_admin_adjust");
    await expect(db.query("select adjust_wallet($1,$2,500,'Compensación')",[customer,customer])).rejects.toThrow("not_admin");
    await db.exec("rollback to not_admin_adjust; savepoint no_reason");
    await expect(db.query("select adjust_wallet($1,$2,500,'')",[customer,admin])).rejects.toThrow("reason_required");
    await db.exec("rollback to no_reason; savepoint negative");
    await expect(db.query("select adjust_wallet($1,$2,-1500,'Contracargo parcial')",[customer,admin])).rejects.toThrow("adjustment_exceeds_balance");
    await db.exec("rollback to negative");
    expect((await db.query<{ b:number }>("select adjust_wallet($1,$2,-400,'Recarga aprobada de más') as b",[customer,admin])).rows[0].b).toBe(600);
    const totals = (await db.query<{ adjusted:string; balance:number; frozen:boolean }>("select adjusted,balance,frozen from wallet_customer_totals where user_id=$1",[customer])).rows[0];
    expect({ ...totals, adjusted: Number(totals.adjusted) }).toEqual({ adjusted:-400, balance:600, frozen:false });
    expect((await db.query("select * from audit_log where action='wallet.adjust'")).rows).toHaveLength(1);
  });
  it("cada recarga tiene la referencia de pago que ve el cliente", async () => {
    const t = (await db.query<{ id:string; reference_code:string }>("select id,reference_code from create_wallet_topup($1,'mx',1000,5000,$2)",[customer,randomUUID()])).rows[0];
    expect(t.reference_code).toBe(`RECARGA-${t.id.slice(0,8).toUpperCase()}`);
  });
  it("el admin ve el WhatsApp del cliente para avisarle: el de su último pedido o el de su sesión", async () => {
    await credit(1000);
    const phone = async () => (await db.query<{ whatsapp:string|null }>("select whatsapp from wallet_customer_totals where user_id=$1",[customer])).rows[0].whatsapp;
    await db.query("update commerce_sessions set whatsapp='5511112222' where id=$1",[session]);
    expect(await phone()).toBe("5511112222");
    await buy(await quote());
    expect(await phone()).toBe("5512345678");
    expect((await db.query("select * from outbox_jobs where job_type like 'email.%'")).rows).toHaveLength(0);
  });
  it("la pausa bloquea compras nuevas, solo un admin la quita y conserva el saldo", async () => {
    await credit(); const q = await quote();
    await db.query("select pause_wallet_payments(30,'Sin cupo de regalos')");
    expect((await db.query<{ p:boolean }>("select wallet_payments_paused() as p")).rows[0].p).toBe(true);
    await db.exec("savepoint paused_buy");
    await expect(buy(q)).rejects.toThrow("wallet_paused");
    await db.exec("rollback to paused_buy; savepoint customer_resume");
    await expect(db.query("select resume_wallet_payments($1)",[customer])).rejects.toThrow("not_admin");
    await db.exec("rollback to customer_resume");
    expect(await balance()).toBe(1000);
    await db.query("select resume_wallet_payments($1)",[admin]);
    await buy(q);
    expect(await balance()).toBe(200);
  });
  it("con la emisora caída devuelve al instante los objetos nunca intentados, no los inciertos", async () => {
    await credit(3000); const id=randomUUID();
    await db.query("insert into checkout_quotes(id,commerce_session_id,validation_id,amount_mxn_cents,total_vbucks,expires_at) values($1,$2,$3,9000,1500,now()+interval '30 minutes')",[id,session,validation]);
    await db.query("insert into checkout_quote_items(quote_id,item_main_id,offer_id,item_name,vbucks_price,unit_amount_mxn_cents,quantity) values($1,'main-a','offer-a','Falla',500,3000,1),($1,'main-b','offer-b','Dudoso',500,3000,1),($1,'main-c','offer-c','Sin intentar',500,3000,1)",[id]);
    const o=(await buy(id)).rows[0].order_id;
    await db.query("update orders set status='manual_review' where id=$1",[o]);
    await db.query("insert into fulfillments(order_id,order_item_id,status,result_code) select order_id,id,'failed','plan_limit_reached' from order_items where order_id=$1 and item_name='Falla'",[o]);
    await db.query("insert into fulfillments(order_id,order_item_id,status,result_code) select order_id,id,'unknown','transport_error' from order_items where order_id=$1 and item_name='Dudoso'",[o]);
    expect((await db.query<{ n:number }>("select refund_wallet_failures($1) as n",[o])).rows[0].n).toBe(500);
    expect((await db.query<{ n:number }>("select refund_wallet_failures($1,true) as n",[o])).rows[0].n).toBe(500);
    expect(await balance()).toBe(2500);
    const refunded = (await db.query<{ item_name:string }>("select item_name from order_items where order_id=$1 and wallet_refunded order by item_name",[o])).rows.map((r) => r.item_name);
    expect(refunded).toEqual(["Falla","Sin intentar"]);
  });
  it("el resumen del admin muestra el pasivo y lo gastado y devuelto hoy", async () => {
    await credit(3000); await buy(await quote(800));
    const s = (await db.query<Record<string,string|number|null>>("select * from wallet_admin_summary()")).rows[0];
    expect({ liability:Number(s.liability), spent:Number(s.spent_today), credited:Number(s.credited_today), paused:s.paused_until }).toEqual({ liability:2200, spent:800, credited:3000, paused:null });
  });
  it("impide a una sesión autenticada modificar saldos directamente", async () => {
    await credit(); await db.exec("set local role authenticated");
    await expect(db.exec("update public.wallet_accounts set balance=999999")).rejects.toThrow("permission denied");
  });
});
