-- A duração cadastrada no seed (60 min) é provisória: o sistema precisa de um valor para calcular
-- horários, mas o site não deve exibi-la como se fosse informação real. `duration_confirmed`
-- controla a exibição pública; o cálculo de agenda usa duration_minutes de qualquer forma.
alter table public.services add column duration_confirmed boolean not null default false;
