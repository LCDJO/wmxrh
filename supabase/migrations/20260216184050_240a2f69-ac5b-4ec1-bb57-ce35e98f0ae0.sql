
-- Add missing columns to nr_training_catalog
ALTER TABLE public.nr_training_catalog
  ADD COLUMN IF NOT EXISTS exige_reciclagem boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exige_avaliacao_medica boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exige_assinatura_termo boolean NOT NULL DEFAULT false;

-- Rename carga_horaria to carga_horaria_minima for clarity
ALTER TABLE public.nr_training_catalog
  RENAME COLUMN carga_horaria TO carga_horaria_minima;

-- Seed the standard NR training catalog (upsert by tenant_id + nr_codigo + nome)
-- Using a system tenant placeholder; real tenants will get copies via onboarding
-- We'll insert for any existing tenants
INSERT INTO public.nr_training_catalog (
  tenant_id, nr_codigo, nome, descricao, carga_horaria_minima, validade_meses,
  obrigatoria_para_grau_risco, periodicidade, base_legal, target_cbos,
  is_active, is_system, exige_reciclagem, exige_avaliacao_medica, exige_assinatura_termo
)
SELECT
  t.id,
  v.nr_codigo,
  v.nome,
  v.descricao,
  v.carga_horaria_minima,
  v.validade_meses,
  v.obrigatoria_para_grau_risco,
  v.periodicidade,
  v.base_legal,
  v.target_cbos,
  true,
  true,
  v.exige_reciclagem,
  v.exige_avaliacao_medica,
  v.exige_assinatura_termo
FROM tenants t
CROSS JOIN (VALUES
  (1,  'Treinamento sobre GRO/PGR',                 'Disposições Gerais e Gerenciamento de Riscos Ocupacionais', 2,  NULL, '{1,2,3,4}'::int[], 'admissional',  'NR-1, item 1.7.1',      '{}'::text[],                          false, false, false),
  (5,  'Treinamento de CIPA',                        'Comissão Interna de Prevenção de Acidentes e Assédio',      20, 12,   '{1,2,3,4}'::int[], 'periodico',    'NR-5, item 5.7.1',      '{}'::text[],                          true,  false, true),
  (6,  'Uso correto de EPI',                         'Equipamento de Proteção Individual',                        2,  NULL, '{2,3,4}'::int[],   'admissional',  'NR-6, item 6.6.1',      '{}'::text[],                          false, false, true),
  (10, 'NR-10 Básico - Segurança em Eletricidade',   'Segurança em Instalações e Serviços em Eletricidade',       40, 24,   '{2,3,4}'::int[],   'periodico',    'NR-10, item 10.8.8',    '{7241-10,7321-05}'::text[],           true,  true,  true),
  (10, 'NR-10 Complementar (SEP)',                   'Sistema Elétrico de Potência',                              40, 24,   '{3,4}'::int[],     'periodico',    'NR-10, item 10.8.8.2',  '{7241-10}'::text[],                   true,  true,  true),
  (11, 'Operação de Empilhadeira',                   'Transporte e Movimentação de Cargas',                       16, 12,   '{2,3,4}'::int[],   'periodico',    'NR-11, item 11.1.5',    '{8610-10}'::text[],                   true,  true,  true),
  (12, 'Segurança em Máquinas e Equipamentos',       'Proteção em máquinas industriais',                          8,  NULL, '{3,4}'::int[],     'admissional',  'NR-12, item 12.16.1',   '{7210-05}'::text[],                   false, false, true),
  (17, 'Treinamento de Ergonomia',                   'Adaptação das condições de trabalho às características psicofisiológicas', 2, NULL, '{1,2,3,4}'::int[], 'admissional', 'NR-17, item 17.1.2', '{}'::text[],                  false, false, false),
  (23, 'Prevenção e Combate a Incêndios',            'Proteção contra incêndios',                                 4,  12,   '{1,2,3,4}'::int[], 'periodico',    'NR-23, item 23.1',      '{}'::text[],                          true,  false, false),
  (35, 'Trabalho em Altura',                         'Atividades acima de 2 metros do piso',                      8,  24,   '{3,4}'::int[],     'periodico',    'NR-35, item 35.3.2',    '{7170-20,7241-10}'::text[],           true,  true,  true)
) AS v(nr_codigo, nome, descricao, carga_horaria_minima, validade_meses, obrigatoria_para_grau_risco, periodicidade, base_legal, target_cbos, exige_reciclagem, exige_avaliacao_medica, exige_assinatura_termo)
ON CONFLICT DO NOTHING;
