/**
 * GovernanceCoreEngine — Disciplinary Service
 *
 * High-level service that orchestrates disciplinary actions through
 * the event-sourced EmployeeLegalTimelineAggregate.
 *
 * Flow: Load aggregate → Execute command → Persist events → Dispatch
 */

import { GovernanceEventStore } from '../repositories/governance-event-store';
import { EmployeeLegalTimelineAggregate } from '../entities/employee-legal-timeline-aggregate';
import type { GovernanceEventMetadata } from '../events/governance-domain-event';
import type {
  AdvertenciaPayload,
  SuspensaoPayload,
  AfastamentoPayload,
  DesligamentoPayload,
  RiskAssessmentPayload,
  AdministrativeDecisionPayload,
} from '../events/disciplinary-events';

export class DisciplinaryService {
  private eventStore = new GovernanceEventStore();

  /** Load or create the aggregate for an employee. */
  private async loadAggregate(tenantId: string, employeeId: string): Promise<EmployeeLegalTimelineAggregate> {
    const aggregate = new EmployeeLegalTimelineAggregate(employeeId);
    const history = await this.eventStore.loadStream(tenantId, 'employee_legal_timeline', employeeId);
    aggregate.rehydrate(history);
    return aggregate;
  }

  /** Persist uncommitted events from aggregate. */
  private async save(aggregate: EmployeeLegalTimelineAggregate): Promise<void> {
    const events = aggregate.getUncommittedEvents();
    if (events.length > 0) {
      await this.eventStore.append(events);
      aggregate.clearUncommittedEvents();
    }
  }

  // ── Public API ──

  async aplicarAdvertencia(tenantId: string, payload: AdvertenciaPayload, meta?: Partial<GovernanceEventMetadata>) {
    const agg = await this.loadAggregate(tenantId, payload.employee_id);
    agg.aplicarAdvertencia(payload, { tenant_id: tenantId, actor_type: 'user', source_module: 'DisciplinaryService', ...meta });
    await this.save(agg);
    return { aggregate: agg, events: agg.getUncommittedEvents() };
  }

  async aplicarSuspensao(tenantId: string, payload: SuspensaoPayload, meta?: Partial<GovernanceEventMetadata>) {
    const agg = await this.loadAggregate(tenantId, payload.employee_id);
    agg.aplicarSuspensao(payload, { tenant_id: tenantId, actor_type: 'user', source_module: 'DisciplinaryService', ...meta });
    await this.save(agg);
    return { aggregate: agg };
  }

  async iniciarAfastamento(tenantId: string, payload: AfastamentoPayload, meta?: Partial<GovernanceEventMetadata>) {
    const agg = await this.loadAggregate(tenantId, payload.employee_id);
    agg.iniciarAfastamento(payload, { tenant_id: tenantId, actor_type: 'user', source_module: 'DisciplinaryService', ...meta });
    await this.save(agg);
    return { aggregate: agg };
  }

  async encerrarAfastamento(tenantId: string, employeeId: string, meta?: Partial<GovernanceEventMetadata>) {
    const agg = await this.loadAggregate(tenantId, employeeId);
    agg.encerrarAfastamento({ tenant_id: tenantId, actor_type: 'user', source_module: 'DisciplinaryService', ...meta });
    await this.save(agg);
    return { aggregate: agg };
  }

  async executarDesligamento(tenantId: string, payload: DesligamentoPayload, meta?: Partial<GovernanceEventMetadata>) {
    const agg = await this.loadAggregate(tenantId, payload.employee_id);
    agg.executarDesligamento(payload, { tenant_id: tenantId, actor_type: 'user', source_module: 'DisciplinaryService', ...meta });
    await this.save(agg);
    return { aggregate: agg };
  }

  async registrarRiskAssessment(tenantId: string, payload: RiskAssessmentPayload, meta?: Partial<GovernanceEventMetadata>) {
    const agg = await this.loadAggregate(tenantId, payload.employee_id);
    agg.registrarRiskAssessment(payload, { tenant_id: tenantId, actor_type: 'system', source_module: 'DisciplinaryService', ...meta });
    await this.save(agg);
    return { aggregate: agg };
  }

  async criarDecisaoAdministrativa(tenantId: string, payload: AdministrativeDecisionPayload, meta?: Partial<GovernanceEventMetadata>) {
    const agg = await this.loadAggregate(tenantId, payload.employee_id);
    agg.criarDecisaoAdministrativa(payload, { tenant_id: tenantId, actor_type: 'user', source_module: 'DisciplinaryService', ...meta });
    await this.save(agg);
    return { aggregate: agg };
  }

  /** Get the full timeline for an employee (read-only projection from events). */
  async getTimeline(tenantId: string, employeeId: string) {
    const agg = await this.loadAggregate(tenantId, employeeId);
    return {
      employee_id: employeeId,
      tenant_id: tenantId,
      status: agg.employeeStatus,
      risk_level: agg.riskLevel,
      total_advertencias: agg.totalAdvertencias,
      total_suspensoes: agg.totalSuspensoes,
      is_afastado: agg.isAfastado,
      sanctions: agg.sanctions,
      timeline: agg.timeline,
      version: agg.version,
    };
  }
}
