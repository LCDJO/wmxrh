/**
 * Insight Generator Engine
 *
 * Synthesizes outputs from cost projection, salary analysis, and risk detection
 * into prioritized strategic insights for HR and Finance audiences.
 * Pure function — no I/O.
 */

import type {
  CostProjectionOutput,
  SalaryAnalysisOutput,
  RiskDetectionOutput,
  InsightGenerationOutput,
  StrategicInsight,
  InsightCategory,
} from './types';

interface InsightInput {
  costProjection: CostProjectionOutput;
  salaryAnalysis: SalaryAnalysisOutput;
  riskDetection: RiskDetectionOutput;
}

export function generateInsights(input: InsightInput): InsightGenerationOutput {
  const insights: StrategicInsight[] = [];
  let idCounter = 0;
  const iid = () => `WII-${String(++idCounter).padStart(3, '0')}`;

  const { costProjection, salaryAnalysis, riskDetection } = input;

  // ── Cost insights ──

  if (costProjection.monthly_projections.length > 0) {
    const last = costProjection.monthly_projections[costProjection.monthly_projections.length - 1];

    if (last.delta_pct > 10) {
      insights.push({
        insight_id: iid(), category: 'cost_optimization', priority: 'high',
        title: 'Projeção de aumento significativo nos custos',
        summary: `Custo da folha pode aumentar ${last.delta_pct.toFixed(1)}% em ${costProjection.horizon_months} meses.`,
        detail: `A projeção indica que o custo total empregador passará de R$ ${fmt(costProjection.baseline_monthly_cost)} para R$ ${fmt(last.custo_total_empregador)}/mês. Principais drivers: ${costProjection.cost_drivers.map(d => d.driver).join(', ') || 'reajustes acumulados'}.`,
        impact_estimate: last.delta_vs_current * 12,
        recommended_actions: [
          'Revisar política de reajustes salariais',
          'Avaliar otimização de benefícios',
          'Considerar automação para reduzir headcount incremental',
        ],
        data_points: { baseline: costProjection.baseline_monthly_cost, projected: last.custo_total_empregador, delta_pct: last.delta_pct },
        audience: ['finance', 'executive'],
      });
    }

    if (costProjection.cost_drivers.some(d => d.category === 'headcount' && d.impact_monthly > 0)) {
      const hcDriver = costProjection.cost_drivers.find(d => d.category === 'headcount')!;
      insights.push({
        insight_id: iid(), category: 'workforce_trend', priority: 'medium',
        title: 'Impacto de crescimento do headcount',
        summary: `Cada nova contratação adiciona ~R$ ${fmt(Math.abs(hcDriver.impact_monthly))}/mês ao custo total.`,
        detail: `O crescimento planejado do headcount representa um impacto de ${hcDriver.impact_pct.toFixed(1)}% sobre a base atual de custos. Considere o custo total (incluindo encargos e provisões) ao aprovar novas vagas.`,
        impact_estimate: Math.abs(hcDriver.impact_monthly) * 12,
        recommended_actions: [
          'Incluir custo total empregador (não apenas salário) no budget de novas vagas',
          'Avaliar terceirização para funções não-core',
        ],
        data_points: { monthly_impact: hcDriver.impact_monthly, pct_impact: hcDriver.impact_pct },
        audience: ['hr', 'finance'],
      });
    }
  }

  // ── Salary insights ──

  if (salaryAnalysis.equity_alerts.length > 0) {
    const criticalAlerts = salaryAnalysis.equity_alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      insights.push({
        insight_id: iid(), category: 'salary_action', priority: 'urgent',
        title: 'Disparidades salariais críticas detectadas',
        summary: `${criticalAlerts.length} grupo(s) com disparidade salarial acima de 3x.`,
        detail: `Grupos afetados: ${criticalAlerts.map(a => a.group).join(', ')}. Disparidades extremas aumentam risco de reclamações trabalhistas por equiparação salarial (CLT Art. 461).`,
        recommended_actions: [
          'Realizar estudo de equiparação salarial',
          'Documentar critérios objetivos de diferenciação',
          'Consultar jurídico trabalhista',
        ],
        data_points: { critical_groups: criticalAlerts.length, total_alerts: salaryAnalysis.equity_alerts.length },
        audience: ['hr', 'legal'],
      });
    }

    const compressionAlerts = salaryAnalysis.equity_alerts.filter(a => a.alert_type === 'compression');
    if (compressionAlerts.length > 0) {
      insights.push({
        insight_id: iid(), category: 'salary_action', priority: 'medium',
        title: 'Compressão salarial detectada',
        summary: `${compressionAlerts.length} grupo(s) com salários comprimidos (<1.15x spread).`,
        detail: `Compressão salarial dificulta retenção de talentos seniores e reduz incentivo à progressão de carreira. Considere estruturar faixas salariais por nível.`,
        recommended_actions: [
          'Implementar tabela salarial com faixas por cargo/nível',
          'Avaliar promoções pendentes',
        ],
        data_points: { compressed_groups: compressionAlerts.length },
        audience: ['hr'],
      });
    }
  }

  if (salaryAnalysis.distribution_skew === 'right') {
    insights.push({
      insight_id: iid(), category: 'workforce_trend', priority: 'low',
      title: 'Distribuição salarial concentrada na base',
      summary: 'A maioria dos salários está abaixo da média, indicando poucos salários altos puxando a média para cima.',
      detail: `Média: R$ ${fmt(salaryAnalysis.overall.avg_salary)}, Mediana: R$ ${fmt(salaryAnalysis.overall.median_salary)}. Isso é comum em organizações com poucos cargos de liderança. Monitore a relação para evitar desmotivação da base.`,
      recommended_actions: ['Revisar política de progressão salarial'],
      data_points: { avg: salaryAnalysis.overall.avg_salary, median: salaryAnalysis.overall.median_salary },
      audience: ['hr', 'executive'],
    });
  }

  // ── Risk insights ──

  if (riskDetection.risk_score > 50) {
    insights.push({
      insight_id: iid(), category: 'compliance_alert', priority: 'urgent',
      title: 'Score de risco trabalhista elevado',
      summary: `Score de risco: ${riskDetection.risk_score}/100 — exposição financeira estimada de R$ ${fmt(riskDetection.total_financial_exposure)}.`,
      detail: `Foram detectados ${riskDetection.critical_count} riscos críticos e ${riskDetection.high_count} riscos altos. A exposição financeira total estimada é de R$ ${fmt(riskDetection.total_financial_exposure)} considerando multas e passivos trabalhistas.`,
      impact_estimate: riskDetection.total_financial_exposure,
      recommended_actions: [
        'Priorizar resolução dos riscos críticos',
        'Agendar reunião com jurídico trabalhista',
        'Criar plano de ação com prazos definidos',
      ],
      data_points: { score: riskDetection.risk_score, critical: riskDetection.critical_count, exposure: riskDetection.total_financial_exposure },
      audience: ['hr', 'legal', 'executive'],
    });
  }

  if (riskDetection.risks.some(r => r.category === 'health_safety')) {
    const healthRisks = riskDetection.risks.filter(r => r.category === 'health_safety');
    const totalAffected = healthRisks.reduce((s, r) => s + r.affected_count, 0);
    insights.push({
      insight_id: iid(), category: 'compliance_alert', priority: 'high',
      title: 'Gaps em saúde e segurança do trabalho',
      summary: `${totalAffected} colaborador(es) com pendências de SST (PCMSO/PGR).`,
      detail: `Pendências incluem: ${healthRisks.map(r => r.title).join('; ')}. O não cumprimento das normas regulamentadoras pode resultar em interdição, multas e ações judiciais.`,
      recommended_actions: healthRisks.map(r => r.recommended_action),
      data_points: { affected: totalAffected, risk_count: healthRisks.length },
      audience: ['hr', 'legal'],
    });
  }

  // ── Benefit insights ──

  if (riskDetection.risks.some(r => r.category === 'benefit_gap')) {
    const gap = riskDetection.risks.find(r => r.category === 'benefit_gap')!;
    insights.push({
      insight_id: iid(), category: 'benefit_recommendation', priority: 'medium',
      title: 'Oportunidade de melhoria em benefícios',
      summary: `${gap.affected_count} colaboradores ativos sem benefícios — potencial impacto em retenção.`,
      detail: 'Colaboradores sem benefícios têm maior probabilidade de turnover. Incluí-los em planos básicos (VR/VA) pode melhorar retenção com custo marginal controlado.',
      recommended_actions: [
        'Mapear colaboradores sem benefícios por departamento',
        'Avaliar custo de inclusão em planos básicos',
        'Priorizar áreas com maior turnover',
      ],
      data_points: { without_benefits: gap.affected_count },
      audience: ['hr', 'finance'],
    });
  }

  // ── Occupational compliance insights ──

  if (riskDetection.risks.some(r => r.category === 'occupational_training')) {
    const trainingRisk = riskDetection.risks.find(r => r.category === 'occupational_training')!;
    insights.push({
      insight_id: iid(), category: 'compliance_alert', priority: 'high',
      title: 'Treinamentos NR obrigatórios em atraso',
      summary: `${trainingRisk.affected_count} colaborador(es) em empresas com treinamentos NR pendentes.`,
      detail: `A não realização de treinamentos NR obrigatórios expõe a organização a multas do MTE e riscos de acidentes. ${trainingRisk.description}`,
      impact_estimate: trainingRisk.financial_exposure,
      recommended_actions: [
        'Levantar treinamentos pendentes por NR e empresa',
        'Contratar prestadores de treinamento NR credenciados',
        'Definir cronograma de regularização em até 30 dias',
      ],
      data_points: { affected: trainingRisk.affected_count, exposure: trainingRisk.financial_exposure },
      audience: ['hr', 'legal'],
    });
  }

  if (riskDetection.risks.some(r => r.category === 'cbo_gap')) {
    const cboRisk = riskDetection.risks.find(r => r.category === 'cbo_gap')!;
    insights.push({
      insight_id: iid(), category: 'compliance_alert', priority: 'medium',
      title: 'Cargos sem classificação CBO',
      summary: `${cboRisk.affected_count} colaborador(es) sem CBO definido — impacto em eSocial e compliance.`,
      detail: 'A ausência de CBO impede a correta transmissão de eventos eSocial (S-2200) e dificulta a gestão ocupacional. Regularize para evitar rejeições no eSocial.',
      recommended_actions: [
        'Mapear todos os cargos sem CBO',
        'Consultar tabela CBO do MTE para classificação correta',
        'Atualizar cadastro de cargos e reenviar eventos eSocial',
      ],
      data_points: { without_cbo: cboRisk.affected_count },
      audience: ['hr'],
    });
  }

  // ── Executive summary ──
  const urgentCount = insights.filter(i => i.priority === 'urgent').length;
  const summaryParts: string[] = [];

  if (urgentCount > 0) summaryParts.push(`${urgentCount} insight(s) urgente(s) requerem ação imediata.`);
  if (riskDetection.total_financial_exposure > 0) summaryParts.push(`Exposição financeira total: R$ ${fmt(riskDetection.total_financial_exposure)}.`);
  if (costProjection.monthly_projections.length > 0) {
    const delta = costProjection.monthly_projections[costProjection.monthly_projections.length - 1].delta_pct;
    if (Math.abs(delta) > 1) summaryParts.push(`Projeção de custos: ${delta > 0 ? '+' : ''}${delta.toFixed(1)}% em ${costProjection.horizon_months} meses.`);
  }
  summaryParts.push(`${salaryAnalysis.overall.headcount} colaboradores analisados em ${salaryAnalysis.groups.length} grupo(s).`);

  return {
    generated_at: new Date().toISOString(),
    total_insights: insights.length,
    urgent_count: urgentCount,
    insights: insights.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority)),
    executive_summary: summaryParts.join(' '),
  };
}

function priorityOrder(p: string): number {
  return { urgent: 0, high: 1, medium: 2, low: 3 }[p] ?? 4;
}

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
