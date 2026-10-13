-- Empty carts were previously created on every session refresh. They do not
-- represent purchase intent and can be removed without losing products.
delete from public.shopping_carts as cart
where cart.status = 'active'
  and not exists (
    select 1 from public.shopping_cart_items as item where item.cart_id = cart.id
  );

-- Favorites were copied to the canonical session during login. Remove the
-- source copies left by sessions that were already merged.
delete from public.customer_favorites as favorite
using public.commerce_sessions as session
where favorite.commerce_session_id = session.id
  and session.merged_into is not null;

-- Keep one canonical price exception per catalog object. Prefer an active
-- exception and then the most recently created record.
with ranked_overrides as (
  select id,
    row_number() over (
      partition by main_id
      order by active desc, created_at desc, id desc
    ) as position
  from public.offer_price_overrides
)
delete from public.offer_price_overrides as target
using ranked_overrides as ranked
where target.id = ranked.id and ranked.position > 1;

create unique index if not exists offer_price_overrides_main_id_unique
  on public.offer_price_overrides(main_id);
