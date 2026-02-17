/**
 * RiskCommandCenter — Aggregates risk signals from GovernanceAI,
 * SelfHealing, Identity, and Observability into a unified risk view.
 */

import type { PlatformRuntimeAPI } from '@/domains/platform-os/types';
import type { RiskSummary, RiskItem } from './types';

export class RiskCommandCenter {
  constructor(private runtime: PlatformRuntimeAPI) {}

  getSummary(): RiskSummary {
    const identity = this.runtime.identity.snapshot();
    const modules = this.runtime.modules.list();
    const errorModules = modules.filter(m => m.status === 'error');

    const risks: RiskItem[] = [];
    let totalScore = 0;

    // Identity risks
    if (identity.is_impersonating) {
      risks.push({
        id: 'risk-impersonation',
        category: 'identity',
        title: 'Impersonation ativa',
        score: 40,
        description: `Usuário está impersonando tenant ${identity.impersonation?.target_tenant_id ?? 'desconhecido'}`,
        suggested_action: 'Monitorar atividade durante impersonation',
      });
    }

    if (identity.risk_score > 50) {
      risks.push({
        id: 'risk-identity-score',
        category: 'identity',
        title: 'Score de risco de identidade elevado',
        score: identity.risk_score,
        description: `Risk score atual: ${identity.risk_score}/100`,
        suggested_action: 'Revisar permissões e acessos do usuário',
      });
    }

    // Module risks
    for (const mod of errorModules) {
      risks.push({
        id: `risk-module-${mod.key}`,
        category: 'module',
        title: `Módulo em erro: ${mod.label}`,
        score: 60,
        description: mod.error ?? 'Módulo em estado de erro',
        suggested_action: `Reiniciar módulo '${mod.key}' ou verificar logs`,
      });
    }

    // Infrastructure risk from degraded state
    const status = this.runtime.status();
    if (status.health.overall !== 'healthy') {
      risks.push({
        id: 'risk-platform-health',
        category: 'infrastructure',
        title: `Plataforma ${status.health.overall}`,
        score: status.health.overall === 'unhealthy' ? 80 : 40,
        description: `${status.health.checks.filter(c => c.status === 'fail').length} subsistemas com falha`,
        suggested_action: 'Verificar health checks dos subsistemas',
      });
    }

    // Calculate overall
    totalScore = risks.length > 0
      ? Math.round(risks.reduce((sum, r) => sum + r.score, 0) / risks.length)
      : 0;

    const level = totalScore > 75 ? 'critical' : totalScore > 50 ? 'high' : totalScore > 25 ? 'medium' : 'low';

    return {
      overall_score: totalScore,
      level,
      top_risks: risks.sort((a, b) => b.score - a.score).slice(0, 10),
      trend: 'stable', // Could compare with historical snapshots
      last_assessed_at: Date.now(),
    };
  }
}
