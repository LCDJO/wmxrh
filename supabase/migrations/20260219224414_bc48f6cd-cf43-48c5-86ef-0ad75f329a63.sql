-- Extend connector_type check to include slack, email, cron
ALTER TABLE public.integration_connectors DROP CONSTRAINT integration_connectors_connector_type_check;
ALTER TABLE public.integration_connectors ADD CONSTRAINT integration_connectors_connector_type_check
  CHECK (connector_type = ANY (ARRAY['api','webhook','internal_module','marketplace_app','database','event_stream','slack','email','cron']));

-- Seed Slack and Email connectors
INSERT INTO public.integration_connectors (name, slug, connector_type, auth_type, auth_config, available_actions, available_triggers, description, is_system)
VALUES
  ('Slack', 'slack', 'slack', 'oauth2', '{"methods": ["oauth2", "bearer"], "fields": ["bot_token", "channel"]}', '["send_message", "send_notification", "thread_reply"]', '["message_received", "reaction_added"]', 'Envia mensagens e notificações para canais do Slack', true),
  ('Email (SMTP/API)', 'email', 'email', 'api_key', '{"methods": ["api_key", "basic"], "fields": ["api_key", "from_email"]}', '["send_email", "send_template", "send_bulk"]', '["email_received", "email_bounced"]', 'Envia emails transacionais via SMTP ou API', true)
ON CONFLICT DO NOTHING;