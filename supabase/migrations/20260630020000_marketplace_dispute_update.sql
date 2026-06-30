-- Allow parties to an order (buyer or the listing's supplier) to update its dispute
-- (submit a response / add evidence). Final resolution/refund stays with admin mediation.

drop policy if exists "mkt_disputes_party_update" on public.marketplace_disputes;
create policy "mkt_disputes_party_update" on public.marketplace_disputes for update using (
  order_id in (
    select id from public.marketplace_orders
    where buyer_id = auth.uid()
       or supplier_id in (select id from public.marketplace_suppliers where user_id = auth.uid())
  )
);
