-- Atomic counter increments for the public experiment assignment/conversion
-- endpoints, so concurrent visitors never lose an increment to a race
-- condition. Restricted to the four known counter columns via a CASE, not
-- dynamic SQL, so this cannot be used to write to an arbitrary column.
create or replace function public.increment_web_experiment_counter(p_experiment_id uuid, p_column text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_column = 'control_visitors' then
    update web_experiments set control_visitors = control_visitors + 1, updated_at = now() where id = p_experiment_id;
  elsif p_column = 'variant_visitors' then
    update web_experiments set variant_visitors = variant_visitors + 1, updated_at = now() where id = p_experiment_id;
  elsif p_column = 'control_conversions' then
    update web_experiments set control_conversions = control_conversions + 1, updated_at = now() where id = p_experiment_id;
  elsif p_column = 'variant_conversions' then
    update web_experiments set variant_conversions = variant_conversions + 1, updated_at = now() where id = p_experiment_id;
  else
    raise exception 'Unsupported counter column: %', p_column;
  end if;
end;
$$;

revoke all on function public.increment_web_experiment_counter(uuid, text) from public;
grant execute on function public.increment_web_experiment_counter(uuid, text) to service_role;
