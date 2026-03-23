alter table services add column if not exists category text;
alter table services add column if not exists description text;
alter table services add column if not exists icon text;
alter table services add column if not exists color text;
alter table services add column if not exists image_urls text[] not null default '{}';
alter table services add column if not exists display_order int;

update services
set icon = coalesce(nullif(icon, ''), '✂️'),
    color = coalesce(nullif(color, ''), '#3B82F6')
where icon is null or icon = '' or color is null or color = '';
