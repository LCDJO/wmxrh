
INSERT INTO public.platform_permission_definitions (module, code, resource, action, description)
VALUES
  ('landing', 'landing.create',            'landing', 'create',            'Criar landing pages'),
  ('landing', 'landing.edit',              'landing', 'edit',              'Editar landing pages existentes'),
  ('landing', 'landing.submit_for_review', 'landing', 'submit_for_review', 'Submeter landing page para aprovação'),
  ('landing', 'landing.view_drafts',       'landing', 'view_drafts',       'Visualizar rascunhos de landing pages'),
  ('landing', 'landing.approve',           'landing', 'approve',           'Aprovar landing pages submetidas'),
  ('landing', 'landing.reject',            'landing', 'reject',            'Rejeitar landing pages submetidas'),
  ('landing', 'landing.publish',           'landing', 'publish',           'Publicar landing pages aprovadas')
ON CONFLICT (code) DO NOTHING;
