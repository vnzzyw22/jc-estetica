-- Remove os dados demonstrativos (clientes com telefone "009…" e tudo ligado a eles).
-- Seguro para rodar num banco sem demo. NÃO toca em clientes reais.
do $$
declare
  demo_clients uuid[] := array(select id from public.clients where phone like '009%');
begin
  delete from public.payments where client_id = any (demo_clients) or (kind = 'other' and description like '%(demo)%');
  delete from public.evolutions where treatment_id in (select id from public.treatments where client_id = any (demo_clients));
  delete from public.appointments where client_id = any (demo_clients);
  delete from public.treatments where client_id = any (demo_clients);
  delete from public.anamneses where client_id = any (demo_clients);
  delete from public.screenings where client_id = any (demo_clients);
  delete from public.clients where id = any (demo_clients);
  delete from public.package_services where package_id in (select id from public.treatment_packages where notes = 'Valor demonstrativo.');
  delete from public.treatment_packages where notes = 'Valor demonstrativo.';
  delete from public.expenses where description like '%(demo)%';
  delete from public.consent_terms where version = 'demo';
end;
$$;
