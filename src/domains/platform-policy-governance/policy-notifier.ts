/**
 * PolicyNotifier — Sends in-app notifications to all affected tenants
 * when a policy version is published requiring re-acceptance.
 */

import { supabase } from '@/integrations/supabase/client';
import { notificationDispatcher } from '@/domains/notifications/notification-hub';
import type { PlatformPolicy, PolicyVersion } from './types';

export class PolicyNotifier {
  /**
   * Notify all active tenants about a policy update that requires re-acceptance.
   * Creates a warning notification for each tenant so they see it on next login.
   */
  async notifyPolicyUpdate(policy: PlatformPolicy, version: PolicyVersion): Promise<void> {
    // Fetch all active tenants
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id')
      .eq('status', 'active');

    if (!tenants?.length) return;

    // Create notifications in parallel batches
    const BATCH_SIZE = 20;
    for (let i = 0; i < tenants.length; i += BATCH_SIZE) {
      const batch = tenants.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(tenant =>
          notificationDispatcher.create({
            tenant_id: tenant.id,
            title: `Política atualizada: ${policy.name}`,
            description: `A versão ${version.version_number} da política "${policy.name}" foi publicada e requer seu aceite. O acesso ao sistema será bloqueado até a confirmação.`,
            type: 'warning',
            source_module: 'policy-governance',
            action_url: '/policies/pending',
          })
        )
      );
    }
  }
}
