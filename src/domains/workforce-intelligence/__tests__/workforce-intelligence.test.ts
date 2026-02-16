import { describe, it, expect } from 'vitest';
import {
  generateIntelligenceReport,
  projectCosts,
  analyzeSalaries,
  detectRisks,
  generateInsights,
  type WorkforceDataset,
} from '../index';

const DATASET: WorkforceDataset = {
  tenant_id: 't1',
  analysis_date: '2026-02-16',
  employees: [
    { id: 'e1', name: 'Ana', department: 'Eng', company_id: 'c1', status: 'active', base_salary: 12000, current_salary: 12000 },
    { id: 'e2', name: 'Carlos', department: 'Eng', company_id: 'c1', status: 'active', base_salary: 8500, current_salary: 8500 },
    { id: 'e3', name: 'Maria', department: 'Comercial', company_id: 'c1', status: 'active', base_salary: 15000, current_salary: 15000 },
    { id: 'e4', name: 'João', department: 'Comercial', company_id: 'c1', status: 'active', base_salary: 4500, current_salary: 4500 },
    { id: 'e5', name: 'Luísa', department: 'RH', company_id: 'c1', status: 'active', base_salary: 7200, current_salary: 7200 },
  ],
  simulations: [
    { employee_id: 'e1', salario_base: 12000, total_proventos: 13500, total_descontos: 2100, salario_liquido: 11400, custo_total_empregador: 22000, fator_custo: 1.83, encargos_total: 4500, inss_estimado: 900, irrf_estimado: 800, fgts_estimado: 960, provisoes_total: 3000, beneficios_total: 500, rubrics_count: 5 },
    { employee_id: 'e2', salario_base: 8500, total_proventos: 9200, total_descontos: 1400, salario_liquido: 7800, custo_total_empregador: 15000, fator_custo: 1.76, encargos_total: 3200, inss_estimado: 700, irrf_estimado: 400, fgts_estimado: 680, provisoes_total: 2100, beneficios_total: 500, rubrics_count: 3 },
    { employee_id: 'e3', salario_base: 15000, total_proventos: 15000, total_descontos: 3000, salario_liquido: 12000, custo_total_empregador: 27000, fator_custo: 1.80, encargos_total: 5500, inss_estimado: 1100, irrf_estimado: 1200, fgts_estimado: 1200, provisoes_total: 3500, beneficios_total: 500, rubrics_count: 2 },
    { employee_id: 'e4', salario_base: 4500, total_proventos: 5800, total_descontos: 600, salario_liquido: 5200, custo_total_empregador: 9500, fator_custo: 2.11, encargos_total: 1800, inss_estimado: 350, irrf_estimado: 0, fgts_estimado: 360, provisoes_total: 1200, beneficios_total: 500, rubrics_count: 6 },
    { employee_id: 'e5', salario_base: 7200, total_proventos: 7200, total_descontos: 1000, salario_liquido: 6200, custo_total_empregador: 12500, fator_custo: 1.74, encargos_total: 2700, inss_estimado: 580, irrf_estimado: 200, fgts_estimado: 576, provisoes_total: 1800, beneficios_total: 500, rubrics_count: 2 },
  ],
  compliance: [
    { employee_id: 'e1', has_active_exam: true, exam_overdue: false, has_risk_exposure: false, has_hazard_pay: false, open_violations: 0, violation_severities: [] },
    { employee_id: 'e2', has_active_exam: true, exam_overdue: false, has_risk_exposure: false, has_hazard_pay: false, open_violations: 0, violation_severities: [] },
    { employee_id: 'e3', has_active_exam: false, exam_overdue: true, has_risk_exposure: false, has_hazard_pay: false, open_violations: 0, violation_severities: [] },
    { employee_id: 'e4', has_active_exam: true, exam_overdue: false, has_risk_exposure: true, has_hazard_pay: false, open_violations: 1, violation_severities: ['critical'] },
    { employee_id: 'e5', has_active_exam: true, exam_overdue: false, has_risk_exposure: false, has_hazard_pay: false, open_violations: 0, violation_severities: [] },
  ],
  benefits: [
    { employee_id: 'e1', plan_name: 'VR', benefit_type: 'meal', monthly_value: 500, employer_cost: 500, is_active: true },
    { employee_id: 'e2', plan_name: 'VR', benefit_type: 'meal', monthly_value: 500, employer_cost: 500, is_active: true },
    { employee_id: 'e3', plan_name: 'VR', benefit_type: 'meal', monthly_value: 500, employer_cost: 500, is_active: true },
  ],
};

describe('Workforce Intelligence Engine', () => {
  describe('Cost Projection', () => {
    it('projects costs over 12 months', () => {
      const result = projectCosts({ dataset: DATASET, horizon_months: 12, salary_adjustment_rate: 0.05 });
      expect(result.is_projection).toBe(true);
      expect(result.monthly_projections).toHaveLength(12);
      expect(result.baseline_monthly_cost).toBeGreaterThan(0);
      expect(result.projected_monthly_avg).toBeGreaterThan(0);
    });

    it('handles empty dataset', () => {
      const empty = { ...DATASET, simulations: [] };
      const result = projectCosts({ dataset: empty, horizon_months: 6 });
      expect(result.baseline_monthly_cost).toBe(0);
    });
  });

  describe('Salary Analysis', () => {
    it('groups by department', () => {
      const result = analyzeSalaries({ dataset: DATASET, group_by: 'department' });
      expect(result.groups.length).toBeGreaterThanOrEqual(2);
      expect(result.overall.headcount).toBe(5);
      expect(result.overall.avg_salary).toBeGreaterThan(0);
    });

    it('detects high disparity in Comercial', () => {
      const result = analyzeSalaries({ dataset: DATASET, group_by: 'department' });
      const comercial = result.groups.find(g => g.group_key === 'Comercial');
      expect(comercial).toBeDefined();
      // 15000/4500 = 3.33x → should trigger disparity alert
      expect(result.equity_alerts.some(a => a.alert_type === 'role_disparity')).toBe(true);
    });
  });

  describe('Risk Detection', () => {
    it('detects overdue exams', () => {
      const result = detectRisks({ dataset: DATASET });
      expect(result.risks.some(r => r.category === 'health_safety' && r.title.includes('vencidos'))).toBe(true);
    });

    it('detects risk exposure without hazard pay', () => {
      const result = detectRisks({ dataset: DATASET });
      expect(result.risks.some(r => r.title.includes('sem adicional'))).toBe(true);
    });

    it('detects employees below CCT floor', () => {
      const result = detectRisks({ dataset: DATASET, piso_cct: 5000 });
      expect(result.risks.some(r => r.category === 'salary_compliance')).toBe(true);
    });

    it('calculates risk score', () => {
      const result = detectRisks({ dataset: DATASET });
      expect(result.risk_score).toBeGreaterThan(0);
      expect(result.risk_score).toBeLessThanOrEqual(100);
    });
  });

  describe('Insight Generator', () => {
    it('generates insights from all engines', () => {
      const costs = projectCosts({ dataset: DATASET, horizon_months: 12, salary_adjustment_rate: 0.1 });
      const salaries = analyzeSalaries({ dataset: DATASET, group_by: 'department' });
      const risks = detectRisks({ dataset: DATASET });
      const result = generateInsights({ costProjection: costs, salaryAnalysis: salaries, riskDetection: risks });

      expect(result.total_insights).toBeGreaterThan(0);
      expect(result.executive_summary.length).toBeGreaterThan(0);
    });
  });

  describe('Full Orchestrator', () => {
    it('produces a complete intelligence report', () => {
      const report = generateIntelligenceReport(DATASET, { piso_cct: 5000, salary_adjustment_rate: 0.08 });

      expect(report.is_intelligence_report).toBe(true);
      expect(report.tenant_id).toBe('t1');
      expect(report.cost_projection.is_projection).toBe(true);
      expect(report.salary_analysis.overall.headcount).toBe(5);
      expect(report.risk_detection.total_risks).toBeGreaterThan(0);
      expect(report.insights.total_insights).toBeGreaterThan(0);
    });
  });
});
