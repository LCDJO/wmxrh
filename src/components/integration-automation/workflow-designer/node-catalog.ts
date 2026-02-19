/**
 * Node Catalog — Available triggers, actions, and conditions for the Workflow Designer.
 */
import type { WfNodeTemplate } from './types';

export const TRIGGER_NODES: WfNodeTemplate[] = [
  {
    key: 'trigger.tenant_created',
    category: 'trigger',
    label: 'TenantCreated',
    description: 'Disparado quando um novo tenant é criado na plataforma',
    icon: 'Building2',
    configFields: [
      { key: 'filter_plan', label: 'Filtrar por Plano', type: 'select', options: ['any', 'starter', 'professional', 'enterprise'] },
    ],
  },
  {
    key: 'trigger.landing_published',
    category: 'trigger',
    label: 'LandingPublished',
    description: 'Disparado quando uma landing page é publicada',
    icon: 'Globe',
    configFields: [
      { key: 'filter_tenant', label: 'Tenant ID (opcional)', type: 'text' },
    ],
  },
  {
    key: 'trigger.invoice_generated',
    category: 'trigger',
    label: 'InvoiceGenerated',
    description: 'Disparado quando uma nova fatura é gerada',
    icon: 'Receipt',
    configFields: [
      { key: 'min_amount', label: 'Valor Mínimo (BRL)', type: 'number' },
    ],
  },
  {
    key: 'trigger.referral_converted',
    category: 'trigger',
    label: 'ReferralConverted',
    description: 'Disparado quando um referral converte em assinatura',
    icon: 'UserPlus',
    configFields: [],
  },
  {
    key: 'trigger.api_request_received',
    category: 'trigger',
    label: 'ApiRequestReceived',
    description: 'Disparado quando uma requisição de API é recebida no gateway',
    icon: 'Webhook',
    configFields: [
      { key: 'endpoint_filter', label: 'Filtrar Endpoint', type: 'text' },
      { key: 'method_filter', label: 'Método HTTP', type: 'select', options: ['any', 'GET', 'POST', 'PUT', 'DELETE'] },
    ],
  },
];

export const ACTION_NODES: WfNodeTemplate[] = [
  {
    key: 'action.create_user',
    category: 'action',
    label: 'CreateUser',
    description: 'Cria um novo usuário no tenant especificado',
    icon: 'UserPlus',
    configFields: [
      { key: 'email', label: 'Email', type: 'text', required: true },
      { key: 'role', label: 'Role', type: 'select', options: ['admin', 'member', 'viewer'] },
    ],
  },
  {
    key: 'action.send_webhook',
    category: 'action',
    label: 'SendWebhook',
    description: 'Envia um webhook HTTP para uma URL externa',
    icon: 'Send',
    configFields: [
      { key: 'url', label: 'URL', type: 'text', required: true },
      { key: 'method', label: 'Método', type: 'select', options: ['POST', 'PUT', 'PATCH'] },
      { key: 'payload', label: 'Payload (JSON)', type: 'json' },
    ],
  },
  {
    key: 'action.update_plan',
    category: 'action',
    label: 'UpdatePlan',
    description: 'Atualiza o plano de um tenant',
    icon: 'CreditCard',
    configFields: [
      { key: 'target_plan', label: 'Plano Destino', type: 'select', options: ['starter', 'professional', 'enterprise'], required: true },
    ],
  },
  {
    key: 'action.generate_coupon',
    category: 'action',
    label: 'GenerateCoupon',
    description: 'Gera um novo cupom de desconto',
    icon: 'Ticket',
    configFields: [
      { key: 'discount_type', label: 'Tipo Desconto', type: 'select', options: ['percentage', 'fixed'], required: true },
      { key: 'discount_value', label: 'Valor', type: 'number', required: true },
      { key: 'duration_months', label: 'Duração (meses)', type: 'number' },
    ],
  },
  {
    key: 'action.call_external_api',
    category: 'action',
    label: 'CallExternalAPI',
    description: 'Faz uma chamada para uma API externa configurável',
    icon: 'ExternalLink',
    configFields: [
      { key: 'url', label: 'URL', type: 'text', required: true },
      { key: 'method', label: 'Método', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'] },
      { key: 'headers', label: 'Headers (JSON)', type: 'json' },
      { key: 'body', label: 'Body (JSON)', type: 'json' },
    ],
  },
];

export const CONDITION_NODES: WfNodeTemplate[] = [
  {
    key: 'condition.plan_check',
    category: 'condition',
    label: 'If Plan ==',
    description: 'Verifica se o plano do tenant é igual ao especificado',
    icon: 'GitBranch',
    configFields: [
      { key: 'plan', label: 'Plano', type: 'select', options: ['starter', 'professional', 'enterprise'], required: true },
      { key: 'operator', label: 'Operador', type: 'select', options: ['==', '!='] },
    ],
  },
  {
    key: 'condition.usage_check',
    category: 'condition',
    label: 'If Usage > Limit',
    description: 'Verifica se o uso ultrapassou o limite do plano',
    icon: 'BarChart3',
    configFields: [
      { key: 'metric', label: 'Métrica', type: 'select', options: ['api_calls', 'storage_mb', 'users', 'workflows'], required: true },
      { key: 'operator', label: 'Operador', type: 'select', options: ['>', '>=', '<', '<=', '=='] },
      { key: 'threshold', label: 'Limite', type: 'number', required: true },
    ],
  },
];

export const ALL_NODE_TEMPLATES: WfNodeTemplate[] = [
  ...TRIGGER_NODES,
  ...ACTION_NODES,
  ...CONDITION_NODES,
];

export function getTemplateByKey(key: string): WfNodeTemplate | undefined {
  return ALL_NODE_TEMPLATES.find(t => t.key === key);
}
