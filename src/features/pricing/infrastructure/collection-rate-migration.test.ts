// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";

let db: PGlite;
const actor = "00000000-0000-4000-8000-000000000001";
let beforeData: unknown, afterData: unknown, beforeSchema: unknown, afterSchema: unknown;

async function legacyData(tables: string[]) {
  const snapshot: Record<string, unknown> = {};
  for (const name of tables) {
    const identifier = `"${name.replaceAll('"', '""')}"`;
    snapshot[name] = (await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) as rows from public.${identifier} t`)).rows;
  }
  return snapshot;
}
async function legacySchema() {
  const tables = (await db.query(`select c.relname,c.relkind,c.relrowsecurity,c.relacl::text
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname not like 'collection_price_rules%' order by c.relname`)).rows;
  const functions = (await db.query(`select p.proname,pg_get_function_identity_arguments(p.oid) as args,pg_get_functiondef(p.oid) as definition,p.proacl::text
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind in ('f','p') and p.proname<>'audit_collection_price' order by p.proname,args`)).rows;
  const policies = (await db.query("select * from pg_policies where schemaname='public' order by tablename,policyname")).rows;
  const triggers = (await db.query(`select t.tgname,pg_get_triggerdef(t.oid) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname='public' and c.relname<>'collection_price_rules' order by c.relname,t.tgname`)).rows;
  return { tables, functions, policies, triggers };
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema auth; create schema storage; create schema extensions;
    create role anon; create role authenticated; create role service_role bypassrls;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as 'select null::uuid';
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  const target = "20261126000200_collection_price_rules.sql";
  for (const file of (await readdir("supabase/migrations")).filter((file) => file.endsWith(".sql") && file < target).sort()) {
    const sql = (await readFile(`supabase/migrations/${file}`, "utf8")).replace("create extension if not exists pgcrypto with schema extensions;", "");
    await db.exec(sql);
  }
  await db.query("insert into auth.users(id,email) values($1,'admin@example.com')", [actor]);
  await db.query("update profiles set role='admin' where id=$1", [actor]);
  await db.exec(`insert into catalog_items(main_id,name,item_type,rarity) values('existing-item','Objeto existente','Atuendo','Raro');
    insert into offer_price_overrides(main_id,amount_mxn_cents,wallet_allowed) values('existing-item',9900,false);
    insert into orders(customer_email,epic_account_id,epic_display_name,item_main_id,offer_id,item_name,vbucks_price,amount_mxn_cents,payment_method)
      values('client@example.com','0123456789abcdef0123456789abcdef','Cliente','existing-item','offer','Objeto existente',1500,9900,'bank_transfer');`);
  const tables = (await db.query<{ tablename: string }>("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map((row) => row.tablename);
  beforeData = await legacyData(tables);
  beforeSchema = await legacySchema();
  await db.exec(await readFile("supabase/migrations/20261126000200_collection_price_rules.sql", "utf8"));
  afterData = await legacyData(tables);
  afterSchema = await legacySchema();
}, 120000);
beforeEach(async () => { await db.exec("begin"); });
afterEach(async () => { await db.exec("rollback"); });
afterAll(async () => { await db?.close(); });

it("guarda una sola regla por apartado y registra creación y cambio en la bitácora", async () => {
  await db.exec("set local role service_role");
  await db.query("insert into collection_price_rules(collection,mxn_per_hundred,updated_by) values('Miku',10,$1)", [actor]);
  await db.query("insert into collection_price_rules(collection,mxn_per_hundred,updated_by) values('Miku',20,$1) on conflict(collection) do update set mxn_per_hundred=excluded.mxn_per_hundred", [actor]);
  expect((await db.query("select * from collection_price_rules")).rows).toHaveLength(1);
  await db.exec("reset role");
  const logs = (await db.query<{ before_data: { mxn_per_hundred: number } | null; after_data: { mxn_per_hundred: number } }>("select before_data,after_data from audit_log where action='price.collection_price' order by id")).rows;
  expect(logs).toHaveLength(2);
  expect(logs[0].before_data).toBeNull();
  expect(logs[1].before_data?.mxn_per_hundred).toBe(10);
  expect(logs[1].after_data.mxn_per_hundred).toBe(20);
});
it.each(["anon", "authenticated"])("impide que %s lea o escriba directamente reglas", async (role) => {
  await db.exec(`set local role ${role}`);
  await expect(db.query("select * from collection_price_rules")).rejects.toThrow(/permission denied/i);
});
it("la base rechaza tarifas de cero pesos", async () => {
  await expect(db.query("insert into collection_price_rules(collection,mxn_per_hundred,updated_by) values('Miku',0,$1)", [actor])).rejects.toThrow(/check constraint/i);
});

it("no cambia ninguna fila existente al aplicar la migración sobre el esquema completo", () => {
  expect(afterData).toEqual(beforeData);
});
it("conserva tablas, permisos, funciones, políticas y triggers anteriores", () => {
  expect(afterSchema).toEqual(beforeSchema);
});
it("crea la tabla vacía y conserva el bloqueo de pago con pavos de las excepciones existentes", async () => {
  expect((await db.query("select * from collection_price_rules")).rows).toEqual([]);
  expect((await db.query("select * from wallet_blocked_items(array['existing-item'])")).rows).toHaveLength(1);
});
