insert into public.community_links (title, platform, href, minimum_plan)
select * from (
  values
    ('Grupo oficial de boas-vindas', 'whatsapp'::public.community_platform, 'https://wa.me/5500000000000', 'nivel2'::public.plan_id),
    ('Canal premium de protocolos', 'telegram'::public.community_platform, 'https://t.me/viveresaude-premium', 'nivel3'::public.plan_id)
) as source(title, platform, href, minimum_plan)
where not exists (
  select 1
  from public.community_links target
  where target.title = source.title
);

insert into public.content_assets (title, category, summary, resource_type, minimum_plan)
select * from (
  values
    (
      'E-book de receitas naturais',
      'Material rico',
      'Material inicial para alimentação funcional.',
      'ebook'::public.resource_type,
      'nivel2'::public.plan_id
    ),
    (
      'Protocolo de imunidade',
      'Orientação',
      'Sugestões de produtos e rotina para imunidade.',
      'protocol'::public.resource_type,
      'nivel2'::public.plan_id
    ),
    (
      'Chá calmante funcional',
      'Receita',
      'Receita introdutória com foco em relaxamento.',
      'recipe'::public.resource_type,
      'nivel1'::public.plan_id
    )
) as source(title, category, summary, resource_type, minimum_plan)
where not exists (
  select 1
  from public.content_assets target
  where target.title = source.title
);
