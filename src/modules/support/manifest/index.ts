export const SUPPORT_MODULE_ID = 'support_module';

/**
 * Duas camadas versionadas do módulo de suporte:
 *  1) SupportTenantApp — Portal do cliente (tickets, wiki, chat)
 *  2) SupportPlatformConsole — Console do agente SaaS (fila, métricas, wiki manager)
 */
export const SUPPORT_MODULE_LAYERS = {
  TENANT: 'support:tenant_app',
  PLATFORM: 'support:platform_console',
} as const;

export const SUPPORT_MODULE_EVENTS = {
  // Ticket lifecycle
  TICKET_CREATED: `module:${SUPPORT_MODULE_ID}:ticket_created`,
  TICKET_ASSIGNED: `module:${SUPPORT_MODULE_ID}:ticket_assigned`,
  TICKET_STATUS_CHANGED: `module:${SUPPORT_MODULE_ID}:ticket_status_changed`,
  TICKET_RESOLVED: `module:${SUPPORT_MODULE_ID}:ticket_resolved`,
  TICKET_CLOSED: `module:${SUPPORT_MODULE_ID}:ticket_closed`,
  // Chat / Live Support Engine
  CHAT_SESSION_STARTED: `module:${SUPPORT_MODULE_ID}:chat_session_started`,
  CHAT_MESSAGE_SENT: `module:${SUPPORT_MODULE_ID}:chat_message_sent`,
  CHAT_SESSION_CLOSED: `module:${SUPPORT_MODULE_ID}:chat_session_closed`,
  CHAT_TRANSCRIPT_ARCHIVED: `module:${SUPPORT_MODULE_ID}:chat_transcript_archived`,
  // Wiki / Knowledge Base
  WIKI_PUBLISHED: `module:${SUPPORT_MODULE_ID}:wiki_published`,
  WIKI_VIEWED: `module:${SUPPORT_MODULE_ID}:wiki_viewed`,
  // Evaluation
  AGENT_EVALUATED: `module:${SUPPORT_MODULE_ID}:agent_evaluated`,
  SYSTEM_RATED: `module:${SUPPORT_MODULE_ID}:system_rated`,
} as const;

/**
 * Arquitetura interna do módulo:
 *
 * SupportModule
 *  ├── SupportTenantApp        — Portal do tenant (tickets, wiki, chat)
 *  ├── SupportPlatformConsole  — Console SaaS (fila, métricas, wiki manager)
 *  ├── LiveSupportEngine       — Motor de chat em tempo real
 *  ├── TicketService           — CRUD e lifecycle de tickets
 *  ├── SupportWikiService      — Base de conhecimento
 *  ├── SupportEvaluationEngine — Avaliações de agentes e sistema
 *  └── ConversationAnalytics   — Métricas de atendimento
 */

import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function initSupportModule(sandbox: SandboxContext): void {
  sandbox.state.set('initialized', true);
  sandbox.state.set('layers', Object.values(SUPPORT_MODULE_LAYERS));
  sandbox.emit('initialized', { module: SUPPORT_MODULE_ID, layers: SUPPORT_MODULE_LAYERS });
}
