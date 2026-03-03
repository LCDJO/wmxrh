INSERT INTO platform_roles (name, slug, description, is_system_role)
VALUES (
  'Platform Architect',
  'platform_architect',
  'Responsável pela gestão da arquitetura da plataforma, dependências e documentação técnica',
  true
)
ON CONFLICT (slug) DO NOTHING;