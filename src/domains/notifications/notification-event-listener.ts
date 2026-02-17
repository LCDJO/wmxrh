/**
 * NotificationEventListener
 *
 * Wires domain event buses → NotificationHub.
 * Call `registerNotificationListeners()` once at app boot.
 */

import { notificationDispatcher, type CreateNotificationDTO } from './notification-hub';
import { onIAMEvent } from '@/domains/iam/iam.events';
import { onIBLEvent } from '@/domains/security/kernel/ibl/domain-events';
import { onSecurityEvent } from '@/domains/security/security-events';
import { onPlatformEvent } from '@/domains/platform/platform-events';

function fire(dto: CreateNotificationDTO) {
  notificationDispatcher.create(dto).catch((err) => {
    console.warn('[NotificationEventListener] Failed to dispatch:', err);
  });
}

const teardowns: (() => void)[] = [];

export function registerNotificationListeners() {
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
            title: 'Novo membro convidado',
            description: `O usuário ${e.email} foi convidado para a organização.`,
            type: 'info',
            source_module: 'iam',
            action_url: '/settings/users',
          });
          break;
        }
        case 'RolePermissionsUpdated': {
          const e = event as Extract<typeof event, { type: 'RolePermissionsUpdated' }>;
          fire({
            tenant_id: e.tenant_id,
            user_id: e.granted_by ?? e.role_id,
            title: 'Permissões de papel alteradas',
            description: `O papel teve ${e.permission_count} permissão(ões) atualizada(s).`,
            type: 'warning',
            source_module: 'iam',
            action_url: '/settings/roles',
          });
          break;
        }
      }
    }),
  );

  // ── IBL / Identity Boundary Events ──
  teardowns.push(
    onIBLEvent((event) => {
      if (event.type === 'ContextSwitched') {
        const e = event as Extract<typeof event, { type: 'ContextSwitched' }>;
        fire({
          tenant_id: e.current.tenantId,
          user_id: e.userId,
          title: 'Contexto alterado',
          description: `Troca de ${e.switchType} para ${e.current.tenantName}.`,
          type: 'info',
          source_module: 'ibl',
        });
      }
    }),
  );

  // ── Security Events ──
  teardowns.push(
    onSecurityEvent((event) => {
      if (event.type === 'UnauthorizedAccessAttempt') {
        fire({
          tenant_id: event.tenantId ?? '',
          user_id: event.userId ?? '',
          title: 'Tentativa de acesso não autorizado',
          description: `Bloqueado: ${event.reason} no recurso ${event.resource}.`,
          type: 'critical',
          source_module: 'security',
          action_url: '/audit',
        });
      }
    }),
  );

  // ── Platform Events ──
  teardowns.push(
    onPlatformEvent((event) => {
      const meta = event.metadata as Record<string, any> | undefined;
      switch (event.type) {
        case 'TenantCreated':
          fire({
            tenant_id: event.targetId,
            user_id: event.actorId,
            title: 'Nova organização criada',
            description: `Tenant "${meta?.tenantName ?? event.targetId}" provisionado.`,
            type: 'success',
            source_module: 'platform',
          });
          break;

        case 'PlatformPermissionChanged':
          fire({
            tenant_id: '',
            user_id: event.actorId,
            title: 'Permissão de plataforma alterada',
            description: `Ação "${meta?.action}" aplicada ao usuário ${event.targetId}.`,
            type: 'warning',
            source_module: 'platform',
            action_url: '/platform/users',
          });
          break;

        case 'PermissionRiskDetected':
          fire({
            tenant_id: '',
            user_id: event.actorId,
            title: 'Risco de permissão detectado',
            description: `${meta?.riskType}: ${meta?.details ?? 'Verifique as permissões.'}`,
            type: 'critical',
            source_module: 'cognitive',
            action_url: '/iam',
          });
          break;

        case 'PlanUpgraded':
          fire({
            tenant_id: event.targetId,
            user_id: event.actorId,
            title: 'Plano atualizado',
            description: `Upgrade de ${meta?.fromPlan} para ${meta?.toPlan} realizado.`,
            type: 'success',
            source_module: 'billing',
          });
          break;

        case 'PlanDowngraded':
          fire({
            tenant_id: event.targetId,
            user_id: event.actorId,
            title: 'Plano reduzido',
            description: `Downgrade de ${meta?.fromPlan} para ${meta?.toPlan}. Verifique módulos.`,
            type: 'warning',
            source_module: 'billing',
            action_url: '/platform/plans',
          });
          break;
      }
    }),
  );
}

export function unregisterNotificationListeners() {
  teardowns.forEach((fn) => fn());
  teardowns.length = 0;
}
