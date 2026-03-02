/**
 * GovernanceCoreEngine — EmployeeLegalTimeline Aggregate
 *
 * Event-sourced aggregate that maintains the complete legal/disciplinary
 * timeline for a single employee. State is rebuilt from events.
 *
 * Handles: advertência, suspensão, afastamento, desligamento.
 */

import { GovernanceAggregate } from './governance-aggregate';
import { createGovernanceEvent, type GovernanceDomainEvent, type GovernanceEventMetadata } from '../events/governance-domain-event';
import { DISCIPLINARY_EVENTS, type AdvertenciaPayload, type SuspensaoPayload, type AfastamentoPayload, type DesligamentoPayload, type RiskAssessmentPayload, type AdministrativeDecisionPayload } from '../events/disciplinary-events';
import type { SanctionRecord, SanctionStatus, LegalEventSeverity, EmployeeLegalTimelineEntry } from './governance-entities';

export class EmployeeLegalTimelineAggregate extends GovernanceAggregate {
  private _sanctions: SanctionRecord[] = [];
  private _timeline: EmployeeLegalTimelineEntry[] = [];
  private _riskLevel: string = 'low';
  private _status: 'active' | 'suspended' | 'on_leave' | 'terminated' = 'active';
  private _totalAdvertencias = 0;
  private _totalSuspensoes = 0;
  private _afastamentoAtivo = false;

  constructor(employeeId: string) {
    super('employee_legal_timeline', employeeId);
  }

  // ── Getters ──

  get sanctions(): SanctionRecord[] { return [...this._sanctions]; }
  get timeline(): EmployeeLegalTimelineEntry[] { return [...this._timeline]; }
  get riskLevel(): string { return this._riskLevel; }
  get employeeStatus(): string { return this._status; }
  get totalAdvertencias(): number { return this._totalAdvertencias; }
  get totalSuspensoes(): number { return this._totalSuspensoes; }
  get isAfastado(): boolean { return this._afastamentoAtivo; }

  // ── Commands (produce events) ──

  aplicarAdvertencia(payload: AdvertenciaPayload, metadata: GovernanceEventMetadata): void {
    const eventType = payload.tipo === 'verbal'
      ? DISCIPLINARY_EVENTS.AdvertenciaVerbalAplicada
      : DISCIPLINARY_EVENTS.AdvertenciaEscritaAplicada;

    this.apply(createGovernanceEvent({
      aggregate_type: this.aggregate_type,
      aggregate_id: this.aggregate_id,
      event_type: eventType,
      payload: payload as unknown as Record<string, unknown>,
      metadata,
    }));
  }

  aplicarSuspensao(payload: SuspensaoPayload, metadata: GovernanceEventMetadata): void {
    this.apply(createGovernanceEvent({
      aggregate_type: this.aggregate_type,
      aggregate_id: this.aggregate_id,
      event_type: DISCIPLINARY_EVENTS.SuspensaoAplicada,
      payload: payload as unknown as Record<string, unknown>,
      metadata,
    }));
  }

  iniciarAfastamento(payload: AfastamentoPayload, metadata: GovernanceEventMetadata): void {
    this.apply(createGovernanceEvent({
      aggregate_type: this.aggregate_type,
      aggregate_id: this.aggregate_id,
      event_type: DISCIPLINARY_EVENTS.AfastamentoIniciado,
      payload: payload as unknown as Record<string, unknown>,
      metadata,
    }));
  }

  encerrarAfastamento(metadata: GovernanceEventMetadata): void {
    if (!this._afastamentoAtivo) return;
    this.apply(createGovernanceEvent({
      aggregate_type: this.aggregate_type,
      aggregate_id: this.aggregate_id,
      event_type: DISCIPLINARY_EVENTS.AfastamentoEncerrado,
      payload: { employee_id: this.aggregate_id, data_retorno: new Date().toISOString() },
      metadata,
    }));
  }

  executarDesligamento(payload: DesligamentoPayload, metadata: GovernanceEventMetadata): void {
    this.apply(createGovernanceEvent({
      aggregate_type: this.aggregate_type,
      aggregate_id: this.aggregate_id,
      event_type: DISCIPLINARY_EVENTS.DesligamentoExecutado,
      payload: payload as unknown as Record<string, unknown>,
      metadata,
    }));
  }

  registrarRiskAssessment(payload: RiskAssessmentPayload, metadata: GovernanceEventMetadata): void {
    this.apply(createGovernanceEvent({
      aggregate_type: this.aggregate_type,
      aggregate_id: this.aggregate_id,
      event_type: DISCIPLINARY_EVENTS.RiskAssessmentCreated,
      payload: payload as unknown as Record<string, unknown>,
      metadata,
    }));
  }

  criarDecisaoAdministrativa(payload: AdministrativeDecisionPayload, metadata: GovernanceEventMetadata): void {
    this.apply(createGovernanceEvent({
      aggregate_type: this.aggregate_type,
      aggregate_id: this.aggregate_id,
      event_type: DISCIPLINARY_EVENTS.AdministrativeDecisionCreated,
      payload: payload as unknown as Record<string, unknown>,
      metadata,
    }));
  }

  // ── Event handler (state mutation) ──

  protected when(event: GovernanceDomainEvent): void {
    const p = event.payload as Record<string, unknown>;
    const severity = this.inferSeverity(event.event_type);

    // Add to timeline
    this._timeline.push({
      id: event.id,
      entry_type: this.inferEntryType(event.event_type),
      category: event.event_type,
      severity,
      title: event.event_type,
      summary: (p.motivo as string) ?? (p.justification as string) ?? '',
      reference_id: event.id,
      occurred_at: event.occurred_at,
      actor_id: event.metadata.actor_id ?? null,
    });

    switch (event.event_type) {
      case DISCIPLINARY_EVENTS.AdvertenciaVerbalAplicada:
      case DISCIPLINARY_EVENTS.AdvertenciaEscritaAplicada:
        this._totalAdvertencias++;
        this._sanctions.push(this.buildSanction(event, event.event_type === DISCIPLINARY_EVENTS.AdvertenciaVerbalAplicada ? 'advertencia_verbal' : 'advertencia_escrita'));
        this.recalculateRisk();
        break;

      case DISCIPLINARY_EVENTS.SuspensaoAplicada:
        this._totalSuspensoes++;
        this._status = 'suspended';
        this._sanctions.push(this.buildSanction(event, 'suspensao'));
        this.recalculateRisk();
        break;

      case DISCIPLINARY_EVENTS.SuspensaoEncerrada:
        this._status = 'active';
        break;

      case DISCIPLINARY_EVENTS.AfastamentoIniciado:
        this._afastamentoAtivo = true;
        this._status = 'on_leave';
        break;

      case DISCIPLINARY_EVENTS.AfastamentoEncerrado:
        this._afastamentoAtivo = false;
        this._status = 'active';
        break;

      case DISCIPLINARY_EVENTS.DesligamentoExecutado:
        this._status = 'terminated';
        this.recalculateRisk();
        break;

      case DISCIPLINARY_EVENTS.RiskAssessmentCreated:
        this._riskLevel = (p.risk_level as string) ?? this._riskLevel;
        break;

      default:
        break;
    }
  }

  // ── Helpers ──

  private buildSanction(event: GovernanceDomainEvent, tipo: SanctionRecord['sanction_type']): SanctionRecord {
    const p = event.payload as Record<string, unknown>;
    return {
      id: event.id,
      tenant_id: event.metadata.tenant_id,
      employee_id: this.aggregate_id,
      sanction_type: tipo,
      status: 'applied' as SanctionStatus,
      reason: (p.motivo as string) ?? '',
      legal_basis: (p.base_legal as string) ?? null,
      severity: this.inferSeverity(event.event_type),
      applied_at: event.occurred_at,
      applied_by: event.metadata.actor_id ?? 'system',
      expiry_date: (p.data_fim as string) ?? null,
      duration_days: (p.duracao_dias as number) ?? null,
      witness_ids: (p.testemunhas as string[]) ?? [],
      related_legal_event_id: null,
      notes: (p.observacoes as string) ?? null,
      contested_at: null,
      contest_reason: null,
      revoked_at: null,
      revocation_reason: null,
    };
  }

  private inferSeverity(eventType: string): LegalEventSeverity {
    if (eventType.includes('Desligamento') || eventType.includes('justa_causa')) return 'critical';
    if (eventType.includes('Suspensao')) return 'high';
    if (eventType.includes('Afastamento')) return 'medium';
    return 'low';
  }

  private inferEntryType(eventType: string): EmployeeLegalTimelineEntry['entry_type'] {
    if (eventType.includes('Risk')) return 'risk_assessment';
    if (eventType.includes('Decision')) return 'decision';
    if (eventType.includes('Advertencia') || eventType.includes('Suspensao')) return 'sanction';
    return 'legal_event';
  }

  private recalculateRisk(): void {
    const score = (this._totalAdvertencias * 15) + (this._totalSuspensoes * 30) + (this._status === 'terminated' ? 100 : 0);
    if (score >= 80) this._riskLevel = 'critical';
    else if (score >= 50) this._riskLevel = 'high';
    else if (score >= 20) this._riskLevel = 'medium';
    else this._riskLevel = 'low';
  }
}
