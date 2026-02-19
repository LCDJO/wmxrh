/**
 * AutomationSuggestionEngine — Generates actionable workflow-style automation suggestions from detected patterns.
 *
 * Produces human-readable suggestions like:
 *   "Sugerimos criar workflow: quando InvoiceGenerated → enviar notificação."
 *
 * Suggestions surface in the Control Plane dashboard.
 */

import type { BehaviorPattern, AutomationSuggestion, SuggestedAction, SuggestionPriority } from './types';

let _sugSeq = 0;

function priorityFromPattern(pattern: BehaviorPattern): SuggestionPriority {
  if (pattern.confidence >= 80 && (pattern.type === 'error_burst' || pattern.type === 'security_anomaly')) return 'critical';
  if (pattern.confidence >= 60) return 'high';
  if (pattern.confidence >= 40) return 'medium';
  return 'low';
}

// ══════════════════════════════════════════════
// Workflow-style suggestion templates
// ══════════════════════════════════════════════

interface SuggestionTemplate {
  title: string;
  description: string;
  estimated_impact: string;
  actions: SuggestedAction[];
}

function buildWorkflowSuggestions(pattern: BehaviorPattern): SuggestionTemplate[] {
  const templates: SuggestionTemplate[] = [];

  switch (pattern.type) {
    case 'error_burst': {
      const mod = pattern.affected_modules[0] || 'módulo afetado';
      templates.push({
        title: `Workflow: Quando ErrorBurst em "${mod}" → auto-heal + alerta`,
        description: `Sugerimos criar workflow: quando rajada de erros detectada em "${mod}" → reiniciar módulo automaticamente e notificar equipe de engenharia.`,
        estimated_impact: 'Redução de ~70% no tempo de recuperação de incidentes',
        actions: [
          { type: 'heal', target: mod, parameters: { action: 'restart_module', cooldown_min: 5 } },
          { type: 'alert', target: 'platform_ops', parameters: { channel: 'slack', message: `Auto-heal ativado para ${mod}: ${pattern.description}` } },
        ],
      });
      templates.push({
        title: `Workflow: Quando ErrorBurst → pausar deploys`,
        description: `Sugerimos criar workflow: quando taxa de erros > 15% → pausar pipeline de deploy e notificar DevOps.`,
        estimated_impact: 'Prevenção de deploy durante instabilidade',
        actions: [
          { type: 'throttle', target: 'deploy_pipeline', parameters: { action: 'pause', duration_min: 30 } },
          { type: 'notify', target: 'devops_team', parameters: { message: 'Deploy pausado automaticamente por instabilidade' } },
        ],
      });
      break;
    }

    case 'usage_spike': {
      const mod = pattern.affected_modules[0] || 'módulo';
      templates.push({
        title: `Workflow: Quando UsageSpike em "${mod}" → auto-scale`,
        description: `Sugerimos criar workflow: quando pico de uso detectado em "${mod}" → escalonar recursos automaticamente.`,
        estimated_impact: 'Manutenção de SLA durante picos de tráfego',
        actions: [
          { type: 'scale', target: mod, parameters: { direction: 'up', factor: 1.5 } },
          { type: 'notify', target: 'platform_ops', parameters: { message: `Auto-scale ativado: ${pattern.description}` } },
        ],
      });
      break;
    }

    case 'security_anomaly':
      templates.push({
        title: `Workflow: Quando SecurityAnomaly → throttle + alerta segurança`,
        description: `Sugerimos criar workflow: quando anomalia de segurança detectada → aplicar rate-limit estrito e alertar equipe de segurança.`,
        estimated_impact: 'Bloqueio proativo de atividades suspeitas',
        actions: [
          { type: 'throttle', target: 'identity', parameters: { rate_limit: 'strict', duration_min: 60 } },
          { type: 'alert', target: 'security_team', parameters: { severity: 'critical', message: pattern.description } },
        ],
      });
      break;

    case 'churn_risk':
      templates.push({
        title: `Workflow: Quando ChurnRisk → engajamento proativo`,
        description: `Sugerimos criar workflow: quando risco de churn detectado → disparar campanha de engajamento e notificar customer success.`,
        estimated_impact: 'Redução estimada de ~25% na taxa de churn',
        actions: [
          { type: 'recommend', target: 'customer_success', parameters: { action: 'engagement_campaign', type: 'retention' } },
          { type: 'notify', target: 'revenue_team', parameters: { message: pattern.description } },
        ],
      });
      templates.push({
        title: `Workflow: Quando ChurnRisk alto → oferta de retenção`,
        description: `Sugerimos criar workflow: quando confiança de churn ≥ 75% → gerar cupom de desconto automático e enviar por email.`,
        estimated_impact: 'Retenção proativa com incentivo financeiro',
        actions: [
          { type: 'recommend', target: 'billing_core', parameters: { action: 'generate_retention_coupon', discount_pct: 20 } },
          { type: 'notify', target: 'tenant_admin', parameters: { channel: 'email', template: 'retention_offer' } },
        ],
      });
      break;

    case 'latency_degradation': {
      const mods = pattern.affected_modules.join(', ') || 'plataforma';
      templates.push({
        title: `Workflow: Quando LatencyDegradation → otimizar + alertar`,
        description: `Sugerimos criar workflow: quando degradação de latência em "${mods}" → limpar cache e notificar SRE.`,
        estimated_impact: 'Recuperação de P95 latency dentro do SLA',
        actions: [
          { type: 'optimize', target: mods, parameters: { action: 'flush_cache', analyze_slow_queries: true } },
          { type: 'alert', target: 'sre_team', parameters: { message: `Latência degradada: ${pattern.description}` } },
        ],
      });
      break;
    }

    case 'usage_decline':
      templates.push({
        title: `Workflow: Quando ConversionDecline → notificar Growth`,
        description: `Sugerimos criar workflow: quando queda de conversão em landing pages → disparar análise AI e notificar time de growth.`,
        estimated_impact: 'Identificação rápida de regressões de conversão',
        actions: [
          { type: 'recommend', target: 'growth_team', parameters: { action: 'ai_conversion_analysis' } },
          { type: 'notify', target: 'growth_team', parameters: { message: pattern.description } },
        ],
      });
      break;

    case 'growth_opportunity':
      templates.push({
        title: `Workflow: Quando GrowthOpportunity → upsell campaign`,
        description: `Sugerimos criar workflow: quando oportunidade de crescimento detectada → sugerir upgrade de plano ao tenant.`,
        estimated_impact: 'Aumento potencial de MRR por upsell proativo',
        actions: [
          { type: 'recommend', target: 'revenue_team', parameters: { action: 'upsell_campaign' } },
        ],
      });
      break;

    default:
      templates.push({
        title: `Workflow: ${pattern.type.replace(/_/g, ' ')} → notificação`,
        description: `Sugerimos criar workflow: quando "${pattern.type}" detectado → enviar notificação para operações.`,
        estimated_impact: 'Visibilidade operacional aprimorada',
        actions: [
          { type: 'notify', target: 'platform_ops', parameters: { message: pattern.description } },
        ],
      });
  }

  return templates;
}

// ══════════════════════════════════════════════
// Cross-domain workflow suggestions (event-driven)
// ══════════════════════════════════════════════

function generateCrossDomainSuggestions(): AutomationSuggestion[] {
  const crossDomain: AutomationSuggestion[] = [];
  const now = new Date().toISOString();

  // BillingCore → Notification
  crossDomain.push({
    id: `sug_${++_sugSeq}_${Date.now()}`,
    title: 'Workflow: InvoiceGenerated → enviar notificação',
    description: 'Sugerimos criar workflow: quando InvoiceGenerated → enviar notificação por email ao tenant com detalhes da fatura.',
    priority: 'medium',
    status: 'pending',
    trigger_pattern_id: 'cross_domain_billing',
    estimated_impact: 'Redução de tickets de suporte sobre cobrança em ~40%',
    actions: [
      { type: 'notify', target: 'tenant_admin', parameters: { channel: 'email', template: 'invoice_generated', trigger: 'billing:InvoiceGenerated' } },
    ],
    created_at: now,
  });

  // Plan Upgrade → Welcome workflow
  crossDomain.push({
    id: `sug_${++_sugSeq}_${Date.now()}`,
    title: 'Workflow: TenantPlanUpgraded → onboarding de recursos',
    description: 'Sugerimos criar workflow: quando TenantPlanUpgraded → enviar guia de novos recursos disponíveis no plano.',
    priority: 'low',
    status: 'pending',
    trigger_pattern_id: 'cross_domain_upgrade',
    estimated_impact: 'Aumento de adoção de features premium em ~30%',
    actions: [
      { type: 'notify', target: 'tenant_admin', parameters: { channel: 'email', template: 'plan_upgrade_guide', trigger: 'billing:TenantPlanUpgraded' } },
    ],
    created_at: now,
  });

  // Workflow Failed → retry + alert
  crossDomain.push({
    id: `sug_${++_sugSeq}_${Date.now()}`,
    title: 'Workflow: WorkflowFailed → retry automático + alerta',
    description: 'Sugerimos criar workflow: quando WorkflowFailed com retry_count < 3 → re-executar automaticamente com backoff.',
    priority: 'high',
    status: 'pending',
    trigger_pattern_id: 'cross_domain_automation',
    estimated_impact: 'Recuperação automática de ~60% das falhas transitórias',
    actions: [
      { type: 'heal', target: 'integration_automation', parameters: { action: 'retry_with_backoff', max_retries: 3, trigger: 'automation:WorkflowFailed' } },
      { type: 'alert', target: 'platform_ops', parameters: { condition: 'retry_exhausted', message: 'Workflow falhou após 3 tentativas' } },
    ],
    created_at: now,
  });

  // UsageOverage → notify tenant
  crossDomain.push({
    id: `sug_${++_sugSeq}_${Date.now()}`,
    title: 'Workflow: UsageOverage → notificar tenant',
    description: 'Sugerimos criar workflow: quando UsageOverageCalculated → alertar tenant sobre consumo excedente e sugerir upgrade.',
    priority: 'medium',
    status: 'pending',
    trigger_pattern_id: 'cross_domain_usage',
    estimated_impact: 'Transparência de cobrança e oportunidade de upsell',
    actions: [
      { type: 'notify', target: 'tenant_admin', parameters: { channel: 'in_app', template: 'usage_overage_alert', trigger: 'billing:UsageOverageCalculated' } },
      { type: 'recommend', target: 'revenue_team', parameters: { action: 'suggest_plan_upgrade' } },
    ],
    created_at: now,
  });

  return crossDomain;
}

// ══════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════

export const AutomationSuggestionEngine = {
  /** Generate suggestions from detected patterns */
  generate(patterns: BehaviorPattern[]): AutomationSuggestion[] {
    const patternSuggestions: AutomationSuggestion[] = [];

    for (const pattern of patterns) {
      const templates = buildWorkflowSuggestions(pattern);
      for (const tpl of templates) {
        patternSuggestions.push({
          id: `sug_${++_sugSeq}_${Date.now()}`,
          title: tpl.title,
          description: tpl.description,
          priority: priorityFromPattern(pattern),
          status: 'pending',
          trigger_pattern_id: pattern.id,
          estimated_impact: tpl.estimated_impact,
          actions: tpl.actions,
          created_at: new Date().toISOString(),
        });
      }
    }

    return patternSuggestions;
  },

  /** Generate cross-domain workflow suggestions (event-driven, independent of patterns) */
  generateCrossDomain(): AutomationSuggestion[] {
    return generateCrossDomainSuggestions();
  },

  /** Generate all suggestions: pattern-based + cross-domain */
  generateAll(patterns: BehaviorPattern[]): AutomationSuggestion[] {
    return [...this.generate(patterns), ...this.generateCrossDomain()];
  },
};
