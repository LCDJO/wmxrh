/**
 * AnnouncementReactor — Maps platform domain events to automatic
 * TenantAnnouncement creation.
 *
 * Supported event triggers:
 *   PlanExpiring              → billing / warning / banner
 *   InvoiceGenerated          → billing / info    / none
 *   InvoiceOverdue            → billing / critical / restricted_access
 *   SubscriptionSuspended     → billing / critical / restricted_access
 *   FeatureDisabledByPlan     → system  / warning  / banner
 *   PlatformMaintenanceScheduled → system / info   / banner
 *
 * Usage:
 *   const reactor = createAnnouncementReactor();
 *   reactor.handle('InvoiceOverdue', { tenant_id, days_overdue: 15 });
 */

import {
  announcementDispatcher,
  type CreateAnnouncementInput,
  type AlertType,
  type Severity,
  type BlockingLevel,
} from './announcement-hub';

// ══════════════════════════════════════════════════════════════
// Event Types
// ══════════════════════════════════════════════════════════════

export type AnnouncementTriggerEvent =
  | 'PlanExpiring'
  | 'InvoiceGenerated'
  | 'InvoiceOverdue'
  | 'SubscriptionSuspended'
  | 'FeatureDisabledByPlan'
  | 'PlatformMaintenanceScheduled';

export interface AnnouncementTriggerPayload {
  tenant_id: string;
  /** Days until expiry / overdue */
  days?: number;
  /** Feature name that was disabled */
  feature_name?: string;
  /** Invoice amount */
  amount?: number;
  /** Maintenance window start */
  maintenance_start?: string;
  /** Maintenance window end */
  maintenance_end?: string;
  /** Custom action URL */
  action_url?: string;
}

// ══════════════════════════════════════════════════════════════
// Event → Announcement Template Map
// ══════════════════════════════════════════════════════════════

interface AnnouncementTemplate {
  alert_type: AlertType;
  severity: Severity;
  blocking_level: BlockingLevel;
  is_dismissible: boolean;
  title: (p: AnnouncementTriggerPayload) => string;
  message: (p: AnnouncementTriggerPayload) => string;
  action_url?: (p: AnnouncementTriggerPayload) => string | null;
}

const EVENT_TEMPLATES: Record<AnnouncementTriggerEvent, AnnouncementTemplate> = {
  PlanExpiring: {
    alert_type: 'billing',
    severity: 'warning',
    blocking_level: 'banner',
    is_dismissible: true,
    title: (p) => `Seu plano vence em ${p.days ?? 3} dias`,
    message: (p) =>
      `Renove agora para evitar a suspensão dos serviços. ${p.days && p.days <= 1 ? 'Último dia!' : ''}`.trim(),
    action_url: (p) => p.action_url ?? '/settings/billing',
  },

  InvoiceGenerated: {
    alert_type: 'billing',
    severity: 'info',
    blocking_level: 'none',
    is_dismissible: true,
    title: () => 'Nova fatura disponível',
    message: (p) =>
      p.amount
        ? `Uma fatura no valor de R$ ${p.amount.toFixed(2)} foi gerada.`
        : 'Uma nova fatura foi gerada para sua conta.',
    action_url: (p) => p.action_url ?? '/settings/billing',
  },

  InvoiceOverdue: {
    alert_type: 'billing',
    severity: 'critical',
    blocking_level: 'restricted_access',
    is_dismissible: false,
    title: (p) => `Fatura vencida há ${p.days ?? 0} dias`,
    message: () =>
      'O acesso a módulos pode ser restrito até a regularização do pagamento.',
    action_url: (p) => p.action_url ?? '/settings/billing',
  },

  SubscriptionSuspended: {
    alert_type: 'billing',
    severity: 'critical',
    blocking_level: 'restricted_access',
    is_dismissible: false,
    title: () => 'Assinatura suspensa',
    message: () =>
      'Sua assinatura foi suspensa por falta de pagamento. Entre em contato com o suporte ou regularize sua situação.',
    action_url: (p) => p.action_url ?? '/settings/billing',
  },

  FeatureDisabledByPlan: {
    alert_type: 'system',
    severity: 'warning',
    blocking_level: 'banner',
    is_dismissible: true,
    title: (p) => `Recurso desativado: ${p.feature_name ?? 'módulo'}`,
    message: (p) =>
      `O recurso "${p.feature_name ?? 'módulo'}" não está disponível no seu plano atual. Faça upgrade para desbloquear.`,
    action_url: (p) => p.action_url ?? '/settings/billing',
  },

  PlatformMaintenanceScheduled: {
    alert_type: 'system',
    severity: 'info',
    blocking_level: 'banner',
    is_dismissible: true,
    title: () => 'Manutenção programada',
    message: (p) => {
      if (p.maintenance_start && p.maintenance_end) {
        return `A plataforma estará em manutenção de ${p.maintenance_start} até ${p.maintenance_end}.`;
      }
      return 'Uma manutenção programada foi agendada. Alguns serviços podem ficar temporariamente indisponíveis.';
    },
  },
};

// ══════════════════════════════════════════════════════════════
// Reactor
// ══════════════════════════════════════════════════════════════

export function createAnnouncementReactor() {
  /**
   * Handle a platform event and create the corresponding announcement.
   */
  async function handle(
    event: AnnouncementTriggerEvent,
    payload: AnnouncementTriggerPayload,
  ) {
    const template = EVENT_TEMPLATES[event];
    if (!template) {
      console.warn(`[AnnouncementReactor] Unknown event: ${event}`);
      return null;
    }

    const input: CreateAnnouncementInput = {
      tenant_id: payload.tenant_id,
      title: template.title(payload),
      message: template.message(payload),
      alert_type: template.alert_type,
      severity: template.severity,
      blocking_level: template.blocking_level,
      is_dismissible: template.is_dismissible,
      action_url: template.action_url?.(payload) ?? null,
    };

    try {
      const announcement = await announcementDispatcher.create(input);
      console.info(`[AnnouncementReactor] Created announcement for ${event}:`, announcement.id);
      return announcement;
    } catch (err) {
      console.error(`[AnnouncementReactor] Failed to create announcement for ${event}:`, err);
      return null;
    }
  }

  /**
   * Get the template for an event (for preview/testing).
   */
  function preview(event: AnnouncementTriggerEvent, payload: AnnouncementTriggerPayload) {
    const template = EVENT_TEMPLATES[event];
    if (!template) return null;
    return {
      title: template.title(payload),
      message: template.message(payload),
      alert_type: template.alert_type,
      severity: template.severity,
      blocking_level: template.blocking_level,
    };
  }

  /** All supported trigger events */
  function supportedEvents(): AnnouncementTriggerEvent[] {
    return Object.keys(EVENT_TEMPLATES) as AnnouncementTriggerEvent[];
  }

  return { handle, preview, supportedEvents };
}

/** Singleton reactor instance */
export const announcementReactor = createAnnouncementReactor();
