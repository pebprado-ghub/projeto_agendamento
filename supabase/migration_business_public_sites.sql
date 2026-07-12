-- Site público / vitrine de marketing por negócio (1:1 com businesses).

create table if not exists business_public_sites (
  business_id uuid primary key references businesses(id) on delete cascade,
  is_published boolean not null default false,
  headline text not null default '',
  subheadline text not null default '',
  about_text text not null default '',
  hero_image_url text,
  gallery_urls text[] not null default '{}',
  cta_label text not null default 'Agendar',
  show_prices boolean not null default true,
  updated_at timestamptz not null default now(),
  last_edit_at timestamptz,
  edit_count integer not null default 0,
  edit_count_month text
);

comment on table business_public_sites is
  'Conteúdo de marketing da página pública /b/[slug]: textos, hero, galeria e CTA.';

create index if not exists business_public_sites_published_idx
  on business_public_sites (is_published)
  where is_published = true;
