/**
 * Fleet → Workforce Intelligence Integration Engine
 *
 * Synthesizes fleet compliance data into StrategicInsight[]
 * consumable by the Workforce Intelligence insight pipeline.
 *
 * Generates insights for:
 *  1. Colaboradores com alto risco operacional (repeat offenders)
 *  2. Padrão recorrente de infração (pattern detection)
 *  3. Risco jurídico por empresa (legal exposure scoring)
 *
 * Pure function — no I/O.
 */

import type { StrategicInsight, InsightCategory } from '../workforce-intelligence/types';
import type {
  FleetBehaviorEvent,
  FleetComplianceIncident,
  FleetWarning,
  FleetDevice,
  BehaviorSeverity,
} from './types';

// ── Input ──

export interface FleetWiIntegrationInput {
  behaviorEvents: FleetBehaviorEvent[];
  incidents: FleetComplianceIncident[];
  warnings: FleetWarning[];
  devices: FleetDevice[];
  /** Lookups */
  employeeNames?: Record<string, string>;
  companyNames?: Record<string, string>;
}

// ── Severity weights ──

const SEVERITY_WEIGHT: Record<BehaviorSeverity, number> = {
  low: 1,
  medium: 3,
  high: 7,
  critical: 15,
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  overspeed: 'Excesso de Velocidade',
  geofence_violation: 'Violação de Geofence',
  route_deviation: 'Desvio de Rota',
  after_hours_use: 'Uso Fora do Horário',
};

// ── Engine ──

export function generateFleetInsights(input: FleetWiIntegrationInput): StrategicInsight[] {
  const insights: StrategicInsight[] = [];
  let idCounter = 0;
  const iid = () => `FL-${String(++idCounter).padStart(3, '0')}`;

  const { behaviorEvents, incidents, warnings, devices, employeeNames = {}, companyNames = {} } = input;

  // ── 1. Colaboradores com alto risco operacional ──
  const employeeRisk = buildEmployeeRiskMap(behaviorEvents, warnings);
  const highRiskEmployees = Object.entries(employeeRisk)
    .filter(([, r]) => r.score >= 20)
    .sort((a, b) => b[1].score - a[1].score);

  if (highRiskEmployees.length > 0) {
    insights.push({
      insight_id: iid(),
      category: 'compliance_alert' as InsightCategory,
      priority: highRiskEmployees.some(([, r]) => r.score >= 50) ? 'urgent' : 'high',
      title: 'Colaboradores com alto risco operacional de frota',
      summary: `${highRiskEmployees.length} colaborador(es) com score de risco elevado baseado em infrações e advertências.`,
      detail: highRiskEmployees
        .slice(0, 5)
        .map(([eid, r]) => {
          const name = employeeNames[eid] || eid.slice(0, 8);
          return `• ${name}: score ${r.score} (${r.totalEvents} infrações, ${r.warnings} advertências, ${r.critical} críticas)`;
        })
        .join('\n'),
      recommended_actions: [
        'Avaliar colaboradores de alto risco para treinamento obrigatório',
        'Considerar suspensão de uso de veículo para scores acima de 50',
        'Revisar histórico disciplinar completo antes de ações',
      ],
      data_points: {
        high_risk_employees: highRiskEmployees.length,
        max_score: highRiskEmployees[0]?.[1].score || 0,
        total_critical_events: highRiskEmployees.reduce((s, [, r]) => s + r.critical, 0),
      },
      audience: ['hr', 'legal'],
    });
  }

  // ── 2. Padrão recorrente de infração ──
  const patterns = detectRecurringPatterns(behaviorEvents);

  if (patterns.length > 0) {
    insights.push({
      insight_id: iid(),
      category: 'workforce_trend' as InsightCategory,
      priority: patterns.some(p => p.count >= 10) ? 'high' : 'medium',
      title: 'Padrões recorrentes de infração de frota',
      summary: `${patterns.length} padrão(ões) de infração detectado(s) nos últimos 30 dias.`,
      detail: patterns
        .slice(0, 5)
        .map(p => `• ${EVENT_TYPE_LABELS[p.eventType] || p.eventType}: ${p.count} ocorrências, ${p.uniqueEmployees} colaboradores`)
        .join('\n'),
      recommended_actions: [
        'Analisar causas raiz dos padrões mais frequentes',
        'Implementar treinamentos direcionados por tipo de infração',
        'Revisar regras de condução se padrão for generalizado',
      ],
      data_points: {
        patterns_detected: patterns.length,
        most_common_count: patterns[0]?.count || 0,
        unique_employees_affected: patterns.reduce((s, p) => s + p.uniqueEmployees, 0),
      },
      audience: ['hr', 'executive'],
    });
  }

  // ── 3. Risco jurídico por empresa ──
  const companyRisks = buildCompanyLegalRisk(behaviorEvents, incidents, warnings, devices, companyNames);
  const riskyCompanies = companyRisks.filter(c => c.riskScore >= 15);

  if (riskyCompanies.length > 0) {
    insights.push({
      insight_id: iid(),
      category: 'compliance_alert' as InsightCategory,
      priority: riskyCompanies.some(c => c.riskScore >= 40) ? 'urgent' : 'high',
      title: 'Risco jurídico de frota por empresa',
      summary: `${riskyCompanies.length} empresa(s) com exposição jurídica elevada por infrações de frota.`,
      detail: riskyCompanies
        .slice(0, 5)
        .map(c => `• ${c.companyName}: score ${c.riskScore} (${c.incidents} incidentes, ${c.pendingIncidents} pendentes, ${c.warnings} advertências)`)
        .join('\n'),
      recommended_actions: [
        'Priorizar resolução de incidentes pendentes nas empresas de alto risco',
        'Avaliar adequação das regras de condução por empresa',
        'Documentar ações corretivas para proteção jurídica',
      ],
      data_points: {
        risky_companies: riskyCompanies.length,
        total_pending_incidents: riskyCompanies.reduce((s, c) => s + c.pendingIncidents, 0),
        max_risk_score: riskyCompanies[0]?.riskScore || 0,
      },
      audience: ['hr', 'legal', 'executive'],
    });
  }

  return insights;
}

// ── Helpers ──

interface EmployeeRiskEntry {
  score: number;
  totalEvents: number;
  critical: number;
  warnings: number;
}

function buildEmployeeRiskMap(
  events: FleetBehaviorEvent[],
  warnings: FleetWarning[],
): Record<string, EmployeeRiskEntry> {
  const map: Record<string, EmployeeRiskEntry> = {};

  for (const e of events) {
    const eid = e.employee_id;
    if (!eid) continue;
    if (!map[eid]) map[eid] = { score: 0, totalEvents: 0, critical: 0, warnings: 0 };
    map[eid].score += SEVERITY_WEIGHT[e.severity] || 1;
    map[eid].totalEvents++;
    if (e.severity === 'critical') map[eid].critical++;
  }

  for (const w of warnings) {
    if (!map[w.employee_id]) map[w.employee_id] = { score: 0, totalEvents: 0, critical: 0, warnings: 0 };
    map[w.employee_id].warnings++;
    map[w.employee_id].score += w.warning_type === 'suspension' ? 20 : w.warning_type === 'written' ? 10 : 5;
  }

  return map;
}

interface RecurringPattern {
  eventType: string;
  count: number;
  uniqueEmployees: number;
}

function detectRecurringPatterns(events: FleetBehaviorEvent[]): RecurringPattern[] {
  const byType: Record<string, { count: number; employees: Set<string> }> = {};

  for (const e of events) {
    if (!byType[e.event_type]) byType[e.event_type] = { count: 0, employees: new Set() };
    byType[e.event_type].count++;
    if (e.employee_id) byType[e.event_type].employees.add(e.employee_id);
  }

  return Object.entries(byType)
    .map(([eventType, data]) => ({
      eventType,
      count: data.count,
      uniqueEmployees: data.employees.size,
    }))
    .filter(p => p.count >= 3)
    .sort((a, b) => b.count - a.count);
}

interface CompanyLegalRisk {
  companyId: string;
  companyName: string;
  riskScore: number;
  incidents: number;
  pendingIncidents: number;
  warnings: number;
}

function buildCompanyLegalRisk(
  events: FleetBehaviorEvent[],
  incidents: FleetComplianceIncident[],
  warnings: FleetWarning[],
  devices: FleetDevice[],
  companyNames: Record<string, string>,
): CompanyLegalRisk[] {
  const companyIds = new Set<string>();
  devices.forEach(d => companyIds.add(d.company_id));
  events.forEach(e => { if (e.company_id) companyIds.add(e.company_id); });

  const map: Record<string, CompanyLegalRisk> = {};

  for (const cid of companyIds) {
    map[cid] = {
      companyId: cid,
      companyName: companyNames[cid] || cid.slice(0, 8),
      riskScore: 0,
      incidents: 0,
      pendingIncidents: 0,
      warnings: 0,
    };
  }

  for (const i of incidents) {
    const cid = i.company_id;
    if (!cid || !map[cid]) continue;
    map[cid].incidents++;
    map[cid].riskScore += SEVERITY_WEIGHT[i.severity] || 1;
    if (i.status === 'pending') {
      map[cid].pendingIncidents++;
      map[cid].riskScore += 3; // pending = extra risk
    }
  }

  for (const w of warnings) {
    const cid = w.company_id;
    if (!cid || !map[cid]) continue;
    map[cid].warnings++;
    map[cid].riskScore += 5;
  }

  return Object.values(map)
    .sort((a, b) => b.riskScore - a.riskScore);
}
