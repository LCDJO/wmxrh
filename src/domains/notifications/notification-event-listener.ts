/**
 * NotificationEventListener
 *
 * Wires domain event buses → NotificationHub.
 * Each handler maps a domain event to a CreateNotificationDTO and dispatches it.
 *
 * Call `registerNotificationListeners()` once at app boot.
 */

import { notificationDispatcher, type CreateNotificationDTO } from './notification-hub';
import { onIAMEvent } from '@/domains/iam/iam.events';
import { onIBLEvent } from '@/domains/security/kernel/ibl/domain-events';
import { onSecurityEvent } from '@/domains/security/security-events';
import { onPlatformEvent } from '@/domains/platform/platform-events';

// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

function fire(dto: CreateNotificationDTO) {
  notificationDispatcher.create(dto).catch((err) => {
    console.warn('[NotificationEventListener] Failed to dispatch:', err);
  });
}

// ══════════════════════════════════════════════════════════════
// Listener registration
// ══════════════════════════════════════════════════════════════

const teardowns: (() => void)[] = [];

export function registerNotificationListeners() {
  // Prevent double-registration
  if (teardowns.length > 0) return;

  // ── IAM Events ──
  teardowns.push(
    onIAMEvent((event) => {
      switch (event.type) {
        case 'UserInvited': {
          const e = event as Extract<typeof event, { type: 'UserInvited' }>;
          fire({
            tenant_id: e.tenant_id,
            user_id: e.invited_by ?? e.user_id,
            category: 'hr',
            priority: 'medium',
            title: 'Novo membro convidado',
            message: `O usuário ${e.email} foi convidado para a organização.`,
            icon: 'UserPlus',
            source_module: 'iam',
            source_event: 'UserInvited',
            action_route: '/settings/users',
            action_label: 'Ver equipe',
          });
          break;
        }
        case 'RolePermissionsUpdated': {
          const e = event as Extract<typeof event, { type: 'RolePermissionsUpdated' }>;
          fire({
            tenant_id: e.tenant_id,
            user_id: e.granted_by ?? e.role_id,
            category: 'security',
            priority: 'high',
            title: 'Permissões de papel alteradas',
            message: `O papel teve ${e.permission_count} permissão(ões) atualizada(s).`,
            icon: 'ShieldAlert',
            source_module: 'iam',
            source_event: 'RolePermissionsUpdated',
            action_route: '/settings/roles',
            action_label: 'Ver papéis',
          });
          break;
        }
      }
    }),
  );

  // ── IBL / Identity Boundary Events ──
  teardowns.push(
    onIBLEvent((event) => {
      switch (event.type) {
        case 'ContextSwitched': {
          const e = event as Extract<typeof event, { type: 'ContextSwitched' }>;
          fire({
            tenant_id: e.current.tenantId,
            user_id: e.userId,
            category: 'system',
            priority: 'low',
            title: 'Contexto alterado',
            message: `Troca de ${e.switchType} realizada para ${e.current.tenantName}.`,
            icon: 'Settings',
            source_module: 'ibl',
            source_event: 'ContextSwitched',
          });
          break;
        }
      }
    }),
  );

  // ── Security Events ──
  teardowns.push(
    onSecurityEvent((event) => {
      switch (event.type) {
        case 'UnauthorizedAccessAttempt': {
          fire({
            tenant_id: event.tenantId ?? '',
            user_id: event.userId ?? '',
            category: 'security',
            priority: 'critical',
            title: 'Tentativa de acesso não autorizado',
            message: `Bloqueado: ${event.reason} no recurso ${event.resource}.`,
            icon: 'ShieldAlert',
            source_module: 'security',
            source_event: 'UnauthorizedAccessAttempt',
            action_route: '/audit',
            action_label: 'Ver auditoria',
          });
          break;
        }
      }
    }),
  );

  // ── Platform Events ──
  teardowns.push(
    onPlatformEvent((event) => {
      switch (event.type) {
        // ── HR Core ──
        case 'TenantCreated': {
          fire({
            tenant_id: event.targetId,
            user_id: event.actorId,
            category: 'hr',
            priority: 'medium',
            title: 'Nova organização criada',
            message: `Tenant "${(event.metadata as any)?.tenantName ?? event.targetId}" provisionado.`,
            icon: 'Rocket',
            source_module: 'platform',
            source_event: 'TenantCreated',
          });
          break;
        }

        // ── Permission / Security ──
        case 'PlatformPermissionChanged': {
          fire({
            tenant_id: '',
            user_id: event.actorId,
            category: 'security',
            priority: 'high',
            title: 'Permissão de plataforma alterada',
            message: `Ação "${(event.metadata as any)?.action}" aplicada ao usuário ${event.targetId}.`,
            icon: 'ShieldAlert',
            source_module: 'platform',
            source_event: 'PlatformPermissionChanged',
            action_route: '/platform/users',
            action_label: 'Ver usuários',
          });
          break;
        }

        // ── Cognitive / Risk ──
        case 'PermissionRiskDetected': {
          const meta = event.metadata as any;
          fire({
            tenant_id: '',
            user_id: event.actorId,
            category: 'compliance',
            priority: meta?.severity === 'high' ? 'critical' : 'high',
            title: 'Risco de permissão detectado',
            message: `${meta?.riskType}: ${meta?.details ?? 'Verifique as permissões.'}`,
            icon: 'AlertTriangle',
            source_module: 'cognitive',
            source_event: 'PermissionRiskDetected',
            action_route: '/iam',
            action_label: 'Revisar',
          });
          break;
        }

        // ── Billing ──
        case 'PlanUpgraded': {
          const meta = event.metadata as any;
          fire({
            tenant_id: event.targetId,
            user_id: event.actorId,
            category: 'system',
            priority: 'medium',
            title: 'Plano atualizado',
            message: `Upgrade de ${meta?.fromPlan} para ${meta?.toPlan} realizado.`,
            icon: 'Rocket',
            source_module: 'billing',
            source_event: 'PlanUpgraded',
          });
          break;
        }

        case 'PlanDowngraded': {
          const meta = event.metadata as any;
          fire({
            tenant_id: event.targetId,
            user_id: event.actorId,
            category: 'system',
            priority: 'high',
            title: 'Plano reduzido',
            message: `Downgrade de ${meta?.fromPlan} para ${meta?.toPlan}. Verifique módulos ativos.`,
            icon: 'AlertTriangle',
            source_module: 'billing',
            source_event: 'PlanDowngraded',
            action_route: '/platform/plans',
            action_label: 'Ver planos',
          });
          break;
        }
      }
    }),
  );
}

/** Unsubscribe all listeners (useful in tests). */
export function unregisterNotificationListeners() {
  teardowns.forEach((fn) => fn());
  teardowns.length = 0;
}
