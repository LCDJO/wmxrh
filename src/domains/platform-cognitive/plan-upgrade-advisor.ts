/**
 * PlanUpgradeAdvisor — Cognitive Advisor
 *
 * Analyses tenant usage patterns (module usage, user count, feature frequency)
 * and generates READ-ONLY suggestions when a higher plan tier would be beneficial.
 *
 * SECURITY: This advisor NEVER mutates data. It only builds prompts.
 */

import type { PlatformSnapshot, AdvisorPayload, BehaviorProfile } from './types';

export class PlanUpgradeAdvisor {
  /**
   * Build a plan-upgrade suggestion payload based on usage signals.
   */
  build(
    snapshot: PlatformSnapshot,
    callerRole: string,
    profile: BehaviorProfile,
    currentPlan?: { tier: string; plan_name: string },
  ): AdvisorPayload {
    const tier = currentPlan?.tier ?? 'free';
    const planName = currentPlan?.plan_name ?? tier;

    const usageSignals = this.collectUsageSignals(snapshot, profile);

    const system_prompt = [
      'Você é um consultor de planos SaaS para uma plataforma de RH/DP.',
      'Analise os sinais de uso abaixo e, se adequado, sugira um upgrade de plano.',
      'Seja direto e objetivo. Retorne JSON com { suggestions: [...] }.',
      'Cada suggestion: { id, type: "plan-upgrade", title, description, confidence (0-1), action_label, metadata }.',
      'Se o uso atual já é compatível com o plano, retorne suggestions vazio.',
      'NUNCA execute mudanças — apenas sugira.',
    ].join('\n');

    const user_prompt = [
      `Plano atual: ${planName} (tier: ${tier})`,
      `Papel do chamador: ${callerRole}`,
      '',
      '── Sinais de uso ──',
      `Módulos utilizados: ${usageSignals.modulesUsed.join(', ') || 'nenhum'}`,
      `Total de usuários: ${usageSignals.totalUsers}`,
      `Rotas mais acessadas: ${usageSignals.topRoutes.join(', ') || 'nenhuma'}`,
      `Features mais usadas: ${usageSignals.topFeatures.join(', ') || 'nenhuma'}`,
      `Sessões (período): ${usageSignals.sessionCount}`,
      `Tempo médio de sessão: ${usageSignals.avgSessionMin} min`,
      '',
      'Com base nesses dados, o plano atual é adequado ou há sinais de que um upgrade traria benefícios?',
    ].join('\n');

    return {
      intent: 'suggest-plan-upgrade',
      system_prompt,
      user_prompt,
      snapshot_summary: {
        current_tier: tier,
        ...usageSignals,
      },
    };
  }

  // ── Private ──────────────────────────────────────────────────────

  private collectUsageSignals(snapshot: PlatformSnapshot, profile: BehaviorProfile) {
    return {
      modulesUsed: snapshot.modules_available,
      totalUsers: snapshot.users.length,
      topRoutes: profile.top_routes.slice(0, 5).map(r => `${r.route} (${r.visits}x)`),
      topFeatures: profile.most_used_features.slice(0, 5),
      sessionCount: profile.session_count,
      avgSessionMin: profile.avg_session_minutes,
    };
  }
}
