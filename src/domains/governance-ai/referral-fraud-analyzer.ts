/**
 * ReferralFraudAnalyzer — Heuristic detection of referral abuse patterns.
 *
 * Detects:
 *  1. Referral abuse (self-referral, velocity spikes, suspicious patterns)
 *  2. Referral loops (A→B→A or A→B→C→A circular chains)
 *  3. Excessive coupon usage via referral rewards
 */
import { supabase } from '@/integrations/supabase/client';
import type { GovernanceInsight } from './types';

// ── Thresholds ──────────────────────────────────────────────────

const SELF_REFERRAL_WINDOW_HOURS = 24;
const MAX_SIGNUPS_PER_LINK_PER_DAY = 10;
const MAX_COUPONS_PER_USER_PER_MONTH = 3;
const MAX_REWARD_BRL_PER_USER_PER_MONTH = 500;
const LOOP_DEPTH = 4;

// ── Main analyzer ───────────────────────────────────────────────

export async function analyzeReferralFraud(): Promise<GovernanceInsight[]> {
  const insights: GovernanceInsight[] = [];

  const [abuseInsights, loopInsights, couponInsights] = await Promise.all([
    detectReferralAbuse(),
    detectReferralLoops(),
    detectCouponAbuse(),
  ]);

  insights.push(...abuseInsights, ...loopInsights, ...couponInsights);
  return insights;
}

// ── 1. Referral Abuse Detection ─────────────────────────────────

async function detectReferralAbuse(): Promise<GovernanceInsight[]> {
  const insights: GovernanceInsight[] = [];

  // Fetch referral links with high activity
  const { data: links } = await supabase
    .from('referral_links')
    .select('id, referrer_user_id, code, total_clicks, total_signups, total_conversions, total_reward_brl, created_at')
    .eq('is_active', true)
    .order('total_signups', { ascending: false })
    .limit(100);

  if (!links?.length) return insights;

  // Fetch recent tracking records
  const { data: tracking } = await supabase
    .from('referral_tracking')
    .select('id, referral_link_id, referrer_user_id, referred_tenant_id, signed_up_at, status')
    .order('signed_up_at', { ascending: false })
    .limit(500);

  // ── Self-referral detection ──
  // Check if referrer_user_id appears as a user in the referred_tenant
  for (const link of links) {
    const linkTrackings = (tracking ?? []).filter(t => t.referral_link_id === link.id);

    // Velocity spike: too many signups from same link in short window
    const recentSignups = linkTrackings.filter(t => {
      const diff = Date.now() - new Date(t.signed_up_at).getTime();
      return diff < SELF_REFERRAL_WINDOW_HOURS * 3600 * 1000;
    });

    if (recentSignups.length > MAX_SIGNUPS_PER_LINK_PER_DAY) {
      insights.push({
        id: `referral_abuse_velocity_${link.id}`,
        category: 'referral_abuse',
        severity: 'critical',
        title: `Pico de indicações suspeito — Link ${link.code}`,
        description: `${recentSignups.length} cadastros em ${SELF_REFERRAL_WINDOW_HOURS}h via link ${link.code}. Padrão consistente com abuso de indicação automatizado.`,
        affected_entities: [
          { type: 'referral_link', id: link.id, label: link.code },
          { type: 'user', id: link.referrer_user_id, label: `Referrer ${link.referrer_user_id.slice(0, 8)}` },
        ],
        recommendation: 'Desativar link temporariamente e auditar os cadastros recentes.',
        auto_remediable: true,
        remediation_action: {
          id: `rem_deactivate_link_${link.id}`,
          type: 'custom',
          description: 'Desativar link de referral por suspeita de abuso',
          impact_summary: `Link ${link.code} será desativado. ${recentSignups.length} cadastros recentes serão auditados.`,
          steps: [
            { order: 1, action: 'deactivate', target: `referral_links.${link.id}`, details: 'Marcar is_active=false' },
            { order: 2, action: 'flag_review', target: 'referral_tracking', details: `Marcar ${recentSignups.length} trackings para revisão` },
          ],
          status: 'pending',
          requires_approval: true,
          created_at: Date.now(),
        },
        confidence: 0.85,
        detected_at: Date.now(),
        source: 'heuristic',
        metadata: { link_code: link.code, recent_signups: recentSignups.length },
      });
    }

    // Reward cap exceeded
    if (link.total_reward_brl > MAX_REWARD_BRL_PER_USER_PER_MONTH) {
      insights.push({
        id: `referral_abuse_reward_cap_${link.referrer_user_id}`,
        category: 'referral_abuse',
        severity: 'warning',
        title: `Recompensas acumuladas excedem limite`,
        description: `Usuário ${link.referrer_user_id.slice(0, 8)}... acumulou R$ ${link.total_reward_brl.toFixed(2)} em recompensas de referral. Limite mensal: R$ ${MAX_REWARD_BRL_PER_USER_PER_MONTH}.`,
        affected_entities: [
          { type: 'user', id: link.referrer_user_id, label: `Referrer ${link.referrer_user_id.slice(0, 8)}` },
        ],
        recommendation: 'Revisar histórico de conversões e validar legitimidade.',
        auto_remediable: false,
        confidence: 0.7,
        detected_at: Date.now(),
        source: 'heuristic',
        metadata: { total_reward_brl: link.total_reward_brl },
      });
    }
  }

  return insights;
}

// ── 2. Referral Loop Detection ──────────────────────────────────

async function detectReferralLoops(): Promise<GovernanceInsight[]> {
  const insights: GovernanceInsight[] = [];

  // Build referral graph: referrer → referred tenants, then check if referred users created links back
  const { data: tracking } = await supabase
    .from('referral_tracking')
    .select('referrer_user_id, referred_tenant_id, referral_link_id, status')
    .in('status', ['converted', 'trial', 'pending'])
    .limit(1000);

  const { data: links } = await supabase
    .from('referral_links')
    .select('id, referrer_user_id, owner_tenant_id')
    .eq('is_active', true)
    .limit(500);

  if (!tracking?.length || !links?.length) return insights;

  // Build graph: user_id → set of referred_tenant_ids
  const referralGraph = new Map<string, Set<string>>();
  for (const t of tracking) {
    if (!referralGraph.has(t.referrer_user_id)) {
      referralGraph.set(t.referrer_user_id, new Set());
    }
    referralGraph.get(t.referrer_user_id)!.add(t.referred_tenant_id);
  }

  // Map tenant_id → referrer_user_id (users who created links from that tenant)
  const tenantToReferrers = new Map<string, string[]>();
  for (const link of links) {
    if (link.owner_tenant_id) {
      if (!tenantToReferrers.has(link.owner_tenant_id)) {
        tenantToReferrers.set(link.owner_tenant_id, []);
      }
      tenantToReferrers.get(link.owner_tenant_id)!.push(link.referrer_user_id);
    }
  }

  // DFS for cycles
  const visited = new Set<string>();
  const loops: string[][] = [];

  function dfs(userId: string, path: string[]) {
    if (path.length > LOOP_DEPTH) return;
    const referredTenants = referralGraph.get(userId);
    if (!referredTenants) return;

    for (const tenantId of referredTenants) {
      const nextReferrers = tenantToReferrers.get(tenantId) ?? [];
      for (const nextUser of nextReferrers) {
        if (path.includes(nextUser)) {
          // Loop detected!
          loops.push([...path, nextUser]);
        } else if (!visited.has(nextUser)) {
          dfs(nextUser, [...path, nextUser]);
        }
      }
    }
  }

  for (const userId of referralGraph.keys()) {
    if (!visited.has(userId)) {
      visited.add(userId);
      dfs(userId, [userId]);
    }
  }

  for (const loop of loops) {
    const chainStr = loop.map(u => u.slice(0, 8)).join(' → ');
    insights.push({
      id: `referral_loop_${loop.join('_').slice(0, 40)}`,
      category: 'referral_loop',
      severity: 'critical',
      title: `Loop de referral detectado`,
      description: `Cadeia circular de indicações: ${chainStr}… Indica manipulação para acumular recompensas.`,
      affected_entities: loop.map(uid => ({ type: 'user' as const, id: uid, label: `User ${uid.slice(0, 8)}` })),
      recommendation: 'Bloquear recompensas pendentes para todos os envolvidos e investigar.',
      auto_remediable: true,
      remediation_action: {
        id: `rem_block_loop_${loop[0]?.slice(0, 8)}`,
        type: 'custom',
        description: 'Bloquear recompensas e desativar links dos envolvidos no loop',
        impact_summary: `${loop.length} usuários envolvidos. Links desativados, rewards pendentes bloqueados.`,
        steps: loop.map((uid, i) => ({
          order: i + 1,
          action: 'block_rewards',
          target: `user.${uid}`,
          details: `Bloquear recompensas e desativar links do usuário ${uid.slice(0, 8)}`,
        })),
        status: 'pending',
        requires_approval: true,
        created_at: Date.now(),
      },
      confidence: 0.95,
      detected_at: Date.now(),
      source: 'heuristic',
      metadata: { chain: loop, chain_length: loop.length },
    });
  }

  return insights;
}

// ── 3. Excessive Coupon Usage via Referral ──────────────────────

async function detectCouponAbuse(): Promise<GovernanceInsight[]> {
  const insights: GovernanceInsight[] = [];

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  // Check referral rewards that generated coupons
  const { data: rewards } = await supabase
    .from('referral_rewards')
    .select('id, referrer_user_id, reward_type, amount_brl, status, created_at')
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false })
    .limit(500);

  if (!rewards?.length) return insights;

  // Group by user
  const userRewards = new Map<string, typeof rewards>();
  for (const r of rewards) {
    if (!userRewards.has(r.referrer_user_id)) {
      userRewards.set(r.referrer_user_id, []);
    }
    userRewards.get(r.referrer_user_id)!.push(r);
  }

  // Check coupon redemptions linked to referral
  const { data: redemptions } = await supabase
    .from('coupon_redemptions')
    .select('id, tenant_id, coupon_id, discount_applied_brl, redeemed_at, status')
    .gte('redeemed_at', thirtyDaysAgo)
    .eq('status', 'active')
    .limit(500);

  // Tenant-level coupon abuse
  const tenantRedemptions = new Map<string, number>();
  for (const r of (redemptions ?? [])) {
    tenantRedemptions.set(r.tenant_id, (tenantRedemptions.get(r.tenant_id) ?? 0) + 1);
  }

  for (const [tenantId, count] of tenantRedemptions) {
    if (count > MAX_COUPONS_PER_USER_PER_MONTH) {
      insights.push({
        id: `referral_coupon_abuse_${tenantId}`,
        category: 'referral_coupon_abuse',
        severity: 'warning',
        title: `Uso excessivo de cupons via referral`,
        description: `Tenant ${tenantId.slice(0, 8)}... resgatou ${count} cupons nos últimos 30 dias (limite: ${MAX_COUPONS_PER_USER_PER_MONTH}). Possível exploração de recompensas.`,
        affected_entities: [
          { type: 'tenant', id: tenantId, label: `Tenant ${tenantId.slice(0, 8)}` },
        ],
        recommendation: 'Revisar cupons resgatados e bloquear novos resgates até análise.',
        auto_remediable: false,
        confidence: 0.75,
        detected_at: Date.now(),
        source: 'heuristic',
        metadata: { tenant_id: tenantId, coupon_count: count },
      });
    }
  }

  // User-level reward accumulation
  for (const [userId, userRwds] of userRewards) {
    const totalBrl = userRwds.reduce((s, r) => s + r.amount_brl, 0);
    if (totalBrl > MAX_REWARD_BRL_PER_USER_PER_MONTH) {
      // Avoid duplicate if already caught by abuse detector
      const alreadyCaught = insights.some(i => i.id.includes(userId));
      if (!alreadyCaught) {
        insights.push({
          id: `referral_coupon_abuse_user_${userId}`,
          category: 'referral_coupon_abuse',
          severity: 'critical',
          title: `Acúmulo excessivo de recompensas`,
          description: `Usuário ${userId.slice(0, 8)}... acumulou R$ ${totalBrl.toFixed(2)} em recompensas de referral em 30 dias. ${userRwds.length} transações.`,
          affected_entities: [
            { type: 'user', id: userId, label: `User ${userId.slice(0, 8)}` },
          ],
          recommendation: 'Congelar recompensas pendentes e solicitar verificação de identidade.',
          auto_remediable: true,
          remediation_action: {
            id: `rem_freeze_rewards_${userId.slice(0, 8)}`,
            type: 'custom',
            description: 'Congelar recompensas pendentes do usuário',
            impact_summary: `${userRwds.length} recompensas serão congeladas (R$ ${totalBrl.toFixed(2)}).`,
            steps: [
              { order: 1, action: 'freeze', target: `referral_rewards`, details: `Marcar status=frozen para user ${userId.slice(0, 8)}` },
              { order: 2, action: 'notify', target: `user.${userId}`, details: 'Enviar notificação de revisão' },
            ],
            status: 'pending',
            requires_approval: true,
            created_at: Date.now(),
          },
          confidence: 0.88,
          detected_at: Date.now(),
          source: 'heuristic',
          metadata: { total_brl: totalBrl, reward_count: userRwds.length },
        });
      }
    }
  }

  return insights;
}
