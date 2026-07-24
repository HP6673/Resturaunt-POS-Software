-- Removes the "needs_payment" stage from the tab lifecycle: seated -> ordered
-- -> eating -> closed. Checkout no longer parks a tab in an intermediate
-- payment stage; closing it (with a payment method) goes straight to closed.
-- Run once in the Supabase SQL editor. Safe to re-run.

update tabs set status = 'eating' where status = 'needs_payment';

alter table tabs drop constraint if exists tabs_status_check;
alter table tabs add constraint tabs_status_check check (status in ('seated', 'ordered', 'eating', 'closed'));
