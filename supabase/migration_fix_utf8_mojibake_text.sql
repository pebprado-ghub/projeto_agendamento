-- Corrige texto UTF-8 que foi gravado como se cada byte fosse Latin-1 (ex.: "NegÃ³cio" → "Negócio").
-- Seguro: só altera quando a conversão produz valor diferente; em caso de erro ou texto já correto, mantém o original.
--
-- Uso no Supabase SQL Editor:
--   1) Rode só o bloco CREATE FUNCTION abaixo (ou o arquivo inteiro).
--   2) Opcional: pré-visualize com os SELECTs comentados no final.
--   3) Rode os UPDATEs (ou o arquivo completo de uma vez).

create or replace function public.repair_utf8_misread_as_latin1(p text)
returns text
language plpgsql
immutable
as $$
begin
  if p is null or length(p) = 0 then
    return p;
  end if;
  -- Padrões típicos de mojibake UTF-8→Latin-1 em português (Ã, Â, etc.)
  if p !~ '[ÂÃÄÅ]' then
    return p;
  end if;
  begin
    return convert_from(convert_to(p, 'LATIN1'), 'UTF8');
  exception
    when others then
      return p;
  end;
end;
$$;

comment on function public.repair_utf8_misread_as_latin1(text) is
  'Reinterpreta string como bytes Latin-1 e decodifica como UTF-8; falha silenciosamente devolvendo o original.';

-- ─── businesses ───

update public.businesses
set name = public.repair_utf8_misread_as_latin1(name)
where name is not null
  and public.repair_utf8_misread_as_latin1(name) is distinct from name;

update public.businesses
set legal_name = public.repair_utf8_misread_as_latin1(legal_name)
where legal_name is not null
  and public.repair_utf8_misread_as_latin1(legal_name) is distinct from legal_name;

update public.businesses
set trade_name = public.repair_utf8_misread_as_latin1(trade_name)
where trade_name is not null
  and public.repair_utf8_misread_as_latin1(trade_name) is distinct from trade_name;

update public.businesses
set address_line = public.repair_utf8_misread_as_latin1(address_line)
where address_line is not null
  and public.repair_utf8_misread_as_latin1(address_line) is distinct from address_line;

update public.businesses
set address_number = public.repair_utf8_misread_as_latin1(address_number)
where address_number is not null
  and public.repair_utf8_misread_as_latin1(address_number) is distinct from address_number;

update public.businesses
set address_complement = public.repair_utf8_misread_as_latin1(address_complement)
where address_complement is not null
  and public.repair_utf8_misread_as_latin1(address_complement) is distinct from address_complement;

update public.businesses
set neighborhood = public.repair_utf8_misread_as_latin1(neighborhood)
where neighborhood is not null
  and public.repair_utf8_misread_as_latin1(neighborhood) is distinct from neighborhood;

update public.businesses
set city = public.repair_utf8_misread_as_latin1(city)
where city is not null
  and public.repair_utf8_misread_as_latin1(city) is distinct from city;

update public.businesses
set state = public.repair_utf8_misread_as_latin1(state)
where state is not null
  and public.repair_utf8_misread_as_latin1(state) is distinct from state;

update public.businesses
set contact_name = public.repair_utf8_misread_as_latin1(contact_name)
where contact_name is not null
  and public.repair_utf8_misread_as_latin1(contact_name) is distinct from contact_name;

-- Só roda se a coluna existir (ex.: após migration_businesses_cnae.sql)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'businesses'
      and column_name = 'cnae_description'
  ) then
    update public.businesses
    set cnae_description = public.repair_utf8_misread_as_latin1(cnae_description)
    where cnae_description is not null
      and public.repair_utf8_misread_as_latin1(cnae_description) is distinct from cnae_description;
  end if;
end $$;

-- ─── subscription_plans (nome exibido no painel) ───

update public.subscription_plans
set name = public.repair_utf8_misread_as_latin1(name)
where name is not null
  and public.repair_utf8_misread_as_latin1(name) is distinct from name;

/*
-- Pré-visualização (rode após criar a função):

select id, name as antes, public.repair_utf8_misread_as_latin1(name) as depois
from public.businesses
where name is not null
  and public.repair_utf8_misread_as_latin1(name) is distinct from name;

select code, name as antes, public.repair_utf8_misread_as_latin1(name) as depois
from public.subscription_plans
where name is not null
  and public.repair_utf8_misread_as_latin1(name) is distinct from name;
*/
