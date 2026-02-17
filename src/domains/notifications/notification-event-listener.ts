/**
 * NotificationEventListener
 *
 * Wires domain event buses → PolicyResolver → NotificationHub.
 * Call `registerNotificationListeners()` once at app boot.
 *
 * For multi-recipient events, uses NotificationPolicyResolver
 * to determine WHO receives the notification based on roles + scopes.
 */

import { notificationDispatcher, type CreateNotificationDTO } from './notification-hub';
import {
  notificationPolicyResolver,
  type NotificationScope,
  type NotificationEventType,
} from './notification-policy-resolver';
import { onIAMEvent } from '@/domains/iam/iam.events';
import { onIBLEvent } from '@/domains/security/kernel/ibl/domain-events';
import { onSecurityEvent } from '@/domains/security/security-events';
import { onPlatformEvent } from '@/domains/platform/platform-events';

// ── Helpers ──

/** Fire a single notification (for personal / single-user events). */
function fireSingle(dto: CreateNotificationDTO) {
  notificationDispatcher.create(dto).catch((err) => {
    console.warn('[NotificationEventListener] dispatch failed:', err);
  });
}

/**
 * Resolve recipients via PolicyResolver, then fire one notification per recipient.
 * Excludes the actor (triggering user) when `excludeActorId` is provided.
 */
async function fireToPolicy(
  eventType: NotificationEventType,
  scope: NotificationScope,
  notification: Omit<CreateNotificationDTO, 'tenant_id' | 'user_id'>,
  opts?: { actorId?: string; additionalUserIds?: string[] },
) {
  try {
    const policy = notificationPolicyResolver.buildPolicy(eventType, scope, {
      excludeUserIds: opts?.actorId ? [opts.actorId] : undefined,
      additionalUserIds: opts?.additionalUserIds,
    });

    const recipients = await notificationPolicyResolver.resolve(policy);

    await Promise.allSettled(
      recipients.map(r =>
        notificationDispatcher.create({
          ...notification,
          tenant_id: scope.tenantId,
          user_id: r.userId,
        }),
      ),
    );
  } catch (err) {
    console.warn('[NotificationEventListener] policy dispatch failed:', err);
  }
}

// ── Listener Registration ──

const teardowns: (() => void)[] = [];

export function registerNotificationListeners() {
  if (teardowns.length > 0) return;

  // ── IAM Events ──
  teardowns.push(
    onIAMEvent((event) => {
      switch (event.type) {
        case 'UserInvited': {
          const e = event as Extract<typeof event, { type: 'UserInvited' }>;
          fireToPolicy(
            'UserInvited',
            { type: 'tenant', tenantId: e.tenant_id },
            {
              title: 'Novo membro convidado',
              description: `O usuário ${e.email} foi convidado para a organização.`,
              type: 'info',
              source_module: 'iam',
              action_url: '/settings/users',
            },
            { actorId: e.invited_by },
          );
          break;
        }
        case 'RolePermissionsUpdated': {
          const e = event as Extract<typeof event, { type: 'RolePermissionsUpdated' }>;
          fireToPolicy(
            'RolePermissionsUpdated',
            { type: 'tenant', tenantId: e.tenant_id },
            {
              title: 'Permissões de papel alteradas',
              description: `O papel teve ${e.permission_count} permissão(ões) atualizada(s).`,
              type: 'warning',
              source_module: 'iam',
              action_url: '/settings/roles',
            },
            { actorId: e.granted_by ?? undefined },
          );
          break;
        }
      }
    }),
  );

  // ── IBL / Identity Boundary Events (personal) ──
  teardowns.push(
    onIBLEvent((event) => {
      if (event.type === 'ContextSwitched') {
        const e = event as Extract<typeof event, { type: 'ContextSwitched' }>;
        fireSingle({
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
        fireToPolicy(
          'UnauthorizedAccessAttempt',
          { type: 'tenant', tenantId: event.tenantId ?? '' },
          {
            title: 'Tentativa de acesso não autorizado',
            description: `Bloqueado: ${event.reason} no recurso ${event.resource}.`,
            type: 'critical',
            source_module: 'security',
            action_url: '/audit',
          },
        );
      }
    }),
  );

  // ── Platform Events ──
  teardowns.push(
    onPlatformEvent((event) => {
      const meta = event.metadata as Record<string, any> | undefined;
      switch (event.type) {
        case 'TenantCreated':
          fireSingle({
            tenant_id: event.targetId,
            user_id: event.actorId,
            title: 'Nova organização criada',
            description: `Tenant "${meta?.tenantName ?? event.targetId}" provisionado.`,
            type: 'success',
            source_module: 'platform',
          });
          break;

        case 'PlatformPermissionChanged':
          fireToPolicy(
            'FeatureFlagChanged',
            { type: 'tenant', tenantId: event.targetId || '' },
            {
              title: 'Permissão de plataforma alterada',
              description: `Ação "${meta?.action}" aplicada ao usuário ${event.targetId}.`,
              type: 'warning',
              source_module: 'platform',
              action_url: '/platform/users',
            },
            { actorId: event.actorId },
          );
          break;

        case 'PermissionRiskDetected':
          fireToPolicy(
            'PolicyViolationDetected',
            { type: 'tenant', tenantId: '' },
            {
              title: 'Risco de permissão detectado',
              description: `${meta?.riskType}: ${meta?.details ?? 'Verifique as permissões.'}`,
              type: 'critical',
              source_module: 'cognitive',
              action_url: '/iam',
            },
          );
          break;

        case 'PlanUpgraded':
          fireToPolicy(
            'ModuleEnabled',
            { type: 'tenant', tenantId: event.targetId },
            {
              title: 'Plano atualizado',
              description: `Upgrade de ${meta?.fromPlan} para ${meta?.toPlan} realizado.`,
              type: 'success',
              source_module: 'billing',
            },
          );
          break;

        case 'PlanDowngraded':
          fireToPolicy(
            'ModuleEnabled',
            { type: 'tenant', tenantId: event.targetId },
            {
              title: 'Plano reduzido',
              description: `Downgrade de ${meta?.fromPlan} para ${meta?.toPlan}. Verifique módulos.`,
              type: 'warning',
              source_module: 'billing',
              action_url: '/platform/plans',
            },
          );
          break;
      }
    }),
  );
}

export function unregisterNotificationListeners() {
  teardowns.forEach((fn) => fn());
  teardowns.length = 0;
}
