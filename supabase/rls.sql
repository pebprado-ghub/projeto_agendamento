-- Politicas iniciais de RLS para ambiente com auth habilitada.
-- Para MVP local com service_role no backend, isso pode ser aplicado depois.

alter table businesses enable row level security;
alter table users enable row level security;
alter table services enable row level security;
alter table business_hours enable row level security;
alter table calendar_connections enable row level security;
alter table message_templates enable row level security;
alter table conversation_state enable row level security;
alter table appointments enable row level security;
alter table customers enable row level security;
alter table customer_payments enable row level security;

-- Exemplo base: somente usuarios autenticados podem ler.
-- Ajustar para multi-tenant real com vinculo em auth.users.
create policy "authenticated_can_read_businesses"
on businesses
for select
to authenticated
using (true);

create policy "authenticated_can_read_services"
on services
for select
to authenticated
using (true);

-- Escrita via backend com service_role nao depende destas policies.
