/**
 * Integration Connector Registry — Available connector types
 * for the Workflow Designer actions.
 *
 * Each connector defines how the workflow engine interacts
 * with external systems or internal services.
 */

export type ConnectorType =
  | 'http_webhook'
  | 'rest_api'
  | 'slack'
  | 'email'
  | 'marketplace_app'
  | 'internal_module'
  | 'event_stream'
  | 'cron';

export interface IntegrationConnectorDef {
  type: ConnectorType;
  label: string;
  description: string;
  icon: string;
  color: string;
  authMethods: ('none' | 'api_key' | 'oauth2' | 'bearer' | 'basic' | 'hmac')[];
  configFields: ConnectorConfigField[];
}

export interface ConnectorConfigField {
  key: string;
  label: string;
  type: 'text' | 'url' | 'password' | 'select' | 'json' | 'number' | 'toggle';
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

// ════════════════════════════════════
// CONNECTOR DEFINITIONS
// ════════════════════════════════════

export const CONNECTOR_DEFINITIONS: IntegrationConnectorDef[] = [
  {
    type: 'http_webhook',
    label: 'HTTP Webhook',
    description: 'Envia/recebe payloads HTTP para URLs externas com suporte a retry e HMAC signing',
    icon: 'Webhook',
    color: 'hsl(210 80% 55%)',
    authMethods: ['none', 'api_key', 'hmac', 'bearer'],
    configFields: [
      { key: 'url', label: 'URL do Webhook', type: 'url', required: true, placeholder: 'https://api.example.com/webhook' },
      { key: 'method', label: 'Método HTTP', type: 'select', options: ['POST', 'PUT', 'PATCH'], required: true },
      { key: 'headers', label: 'Headers Customizados', type: 'json', placeholder: '{"X-Custom": "value"}' },
      { key: 'secret', label: 'HMAC Secret', type: 'password' },
      { key: 'retry_count', label: 'Retentativas', type: 'number', placeholder: '3' },
      { key: 'timeout_ms', label: 'Timeout (ms)', type: 'number', placeholder: '5000' },
    ],
  },
  {
    type: 'rest_api',
    label: 'REST API',
    description: 'Chamadas REST configuráveis com autenticação OAuth2, Bearer ou API Key',
    icon: 'ExternalLink',
    color: 'hsl(142 60% 45%)',
    authMethods: ['api_key', 'oauth2', 'bearer', 'basic'],
    configFields: [
      { key: 'base_url', label: 'Base URL', type: 'url', required: true, placeholder: 'https://api.service.com/v1' },
      { key: 'auth_type', label: 'Autenticação', type: 'select', options: ['api_key', 'oauth2', 'bearer', 'basic'], required: true },
      { key: 'auth_token', label: 'Token / API Key', type: 'password' },
      { key: 'default_headers', label: 'Headers Padrão', type: 'json', placeholder: '{"Accept": "application/json"}' },
      { key: 'rate_limit_rps', label: 'Rate Limit (req/s)', type: 'number', placeholder: '10' },
    ],
  },
  {
    type: 'slack',
    label: 'Slack',
    description: 'Envia mensagens, notificações e alertas para canais e usuários do Slack',
    icon: 'MessageSquare',
    color: 'hsl(320 60% 50%)',
    authMethods: ['oauth2', 'bearer'],
    configFields: [
      { key: 'channel', label: 'Canal Padrão', type: 'text', required: true, placeholder: '#general' },
      { key: 'bot_token', label: 'Bot Token', type: 'password', required: true },
      { key: 'username', label: 'Bot Username', type: 'text', placeholder: 'PlatformBot' },
      { key: 'icon_emoji', label: 'Emoji do Bot', type: 'text', placeholder: ':robot_face:' },
      { key: 'thread_replies', label: 'Responder em Thread', type: 'toggle' },
    ],
  },
  {
    type: 'email',
    label: 'Email (SMTP/API)',
    description: 'Envia emails transacionais via SMTP ou APIs de email (SendGrid, Resend, etc.)',
    icon: 'Mail',
    color: 'hsl(38 92% 50%)',
    authMethods: ['api_key', 'basic'],
    configFields: [
      { key: 'provider', label: 'Provedor', type: 'select', options: ['smtp', 'sendgrid', 'resend', 'ses'], required: true },
      { key: 'api_key', label: 'API Key / Password', type: 'password', required: true },
      { key: 'from_email', label: 'Email Remetente', type: 'text', required: true, placeholder: 'noreply@platform.com' },
      { key: 'from_name', label: 'Nome Remetente', type: 'text', placeholder: 'Platform' },
      { key: 'smtp_host', label: 'SMTP Host', type: 'text', placeholder: 'smtp.provider.com' },
      { key: 'smtp_port', label: 'SMTP Port', type: 'number', placeholder: '587' },
    ],
  },
  {
    type: 'marketplace_app',
    label: 'Marketplace App',
    description: 'Conecta com apps instalados do Marketplace via API sandboxed',
    icon: 'Store',
    color: 'hsl(150 55% 40%)',
    authMethods: ['oauth2', 'api_key'],
    configFields: [
      { key: 'app_id', label: 'App ID', type: 'text', required: true },
      { key: 'app_secret', label: 'App Secret', type: 'password', required: true },
      { key: 'scopes', label: 'Escopos', type: 'text', placeholder: 'read:data,write:events' },
      { key: 'sandbox_mode', label: 'Modo Sandbox', type: 'toggle' },
    ],
  },
  {
    type: 'internal_module',
    label: 'Módulo Interno',
    description: 'Invoca operações em módulos internos da plataforma via sandbox',
    icon: 'Boxes',
    color: 'hsl(270 50% 50%)',
    authMethods: ['none'],
    configFields: [
      { key: 'module_id', label: 'ID do Módulo', type: 'text', required: true },
      { key: 'operation', label: 'Operação', type: 'text', required: true, placeholder: 'createUser' },
      { key: 'input_mapping', label: 'Mapeamento de Entrada', type: 'json', placeholder: '{"email": "{{trigger.email}}"}' },
    ],
  },
  {
    type: 'event_stream',
    label: 'Event Stream',
    description: 'Publica/consome eventos do GlobalEventKernel',
    icon: 'Radio',
    color: 'hsl(35 90% 55%)',
    authMethods: ['none'],
    configFields: [
      { key: 'event_type', label: 'Tipo de Evento', type: 'text', required: true },
      { key: 'source', label: 'Source', type: 'text', placeholder: 'workflow' },
      { key: 'priority', label: 'Prioridade', type: 'select', options: ['low', 'normal', 'high', 'critical'] },
    ],
  },
  {
    type: 'cron',
    label: 'Agendador (Cron)',
    description: 'Executa workflows em intervalos agendados via expressão cron',
    icon: 'Clock',
    color: 'hsl(55 70% 45%)',
    authMethods: ['none'],
    configFields: [
      { key: 'cron_expression', label: 'Expressão Cron', type: 'text', required: true, placeholder: '0 */6 * * *' },
      { key: 'timezone', label: 'Timezone', type: 'text', placeholder: 'America/Sao_Paulo' },
      { key: 'max_retries', label: 'Max Retries', type: 'number', placeholder: '3' },
    ],
  },
];

/** Get connector definition by type. */
export function getConnectorDef(type: ConnectorType): IntegrationConnectorDef | undefined {
  return CONNECTOR_DEFINITIONS.find(c => c.type === type);
}

/** Get all connector types. */
export function getAllConnectorTypes(): ConnectorType[] {
  return CONNECTOR_DEFINITIONS.map(c => c.type);
}
