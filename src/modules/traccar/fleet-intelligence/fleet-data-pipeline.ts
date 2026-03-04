/**
 * ══════════════════════════════════════════════════════════
 * FleetDataPipeline — Orquestrador do fluxo de dados completo
 * ══════════════════════════════════════════════════════════
 *
 * Traccar → SaaS Integration → Event Queue → Tenant Processing
 *         → Behavioral Engine → Dashboards RH
 *
 * Capacidades:
 *  ├── Cálculo de velocidade média por trajeto
 *  ├── Histórico de trajeto
 *  ├── Detecção de passagem por radar
 *  ├── Ranking comportamental de motoristas
 *  ├── Heatmap de risco
 *  └── Geração de advertências automáticas
 */
import { supabase } from '@/integrations/supabase/client';

// SaaS Integration Core
import { triggerTraccarSync, getCachedDevices } from '../saas-core';
import { publishBatchTraccarEvents, type TraccarEventPublishPayload } from '../saas-core/event-publisher.service';

// Tenant Fleet Intelligence
import { analyzeTrips, type TripAnalysisResult } from './trip-analysis.service';
import { getTenantBehavioralParams, toBehaviorConfig } from './behavioral-params.service';
import { listActiveRadarPoints } from './radar-point.service';
import { generateInfractions, evaluateEmployeeEscalation, type GenerateInfractionsResult } from './infraction-alert.service';

// BTIE Engines
import { computeBatchDriverScores, type ScoreInput } from '../engines/driver-risk-score-engine';
import { analyzeHotspots } from '../engines/traffic-hotspot-analyzer';
import { detectRadarViolations } from '../engines/radar-point-engine';
import { radarViolationsToBehavior } from '../engines/behavior-engine';
import type { DriverRiskScore, HotspotGrid, PositionPoint, RadarPoint, BehaviorEvent } from '../engines/types';

// ── Pipeline Result ──

export interface PipelineExecutionResult {
  /** Fase 1: Sync com Traccar */
  sync: { devices: number; positions: number; events_created: number };
  /** Fase 2: Análise de viagens */
  tripAnalysis: TripAnalysisResult;
  /** Fase 3: Detecção de radar */
  radarViolations: number;
  /** Fase 4: Comportamento e ranking */
  driverScores: DriverRiskScore[];
  /** Fase 5: Heatmap de risco */
  hotspotGrid: HotspotGrid;
  /** Fase 6: Infrações e advertências */
  infractions: GenerateInfractionsResult;
  /** Fase 7: Eventos publicados na fila */
  eventsPublished: number;
  /** Metadados */
  executedAt: string;
  durationMs: number;
}

export interface PipelineOptions {
  tenantId: string;
  /** Período de análise */
  from: string;
  to: string;
  /** Se deve executar sync com Traccar (default: true) */
  syncFirst?: boolean;
  /** Limite de velocidade para sync (km/h) */
  speedLimitKmh?: number;
  /** Se deve gerar advertências automaticamente */
  autoGenerateWarnings?: boolean;
}

/**
 * Executa o pipeline completo de dados da frota.
 *
 * Fluxo:
 * 1. Sync: Puxa dados do Traccar via Edge Function
 * 2. Análise: Constrói viagens, calcula velocidade média, detecta radares
 * 3. Comportamento: Gera eventos comportamentais
 * 4. Ranking: Calcula scores de risco por motorista
 * 5. Heatmap: Agrega violações em grid espacial
 * 6. Infrações: Gera incidentes de compliance
 * 7. Publicação: Emite eventos na fila para consumidores
 */
export async function executePipeline(opts: PipelineOptions): Promise<PipelineExecutionResult> {
  const start = Date.now();
  const { tenantId, from, to, syncFirst = true, speedLimitKmh = 80, autoGenerateWarnings = true } = opts;

  // ─── FASE 1: Sync com Traccar ───
  let syncResult = { devices: 0, positions: 0, events_created: 0 };
  if (syncFirst) {
    try {
      const result = await triggerTraccarSync(tenantId, speedLimitKmh);
      syncResult = {
        devices: result.devices,
        positions: result.positions,
        events_created: result.events_created,
      };
    } catch (err) {
      console.warn('[Pipeline] Sync falhou, continuando com dados em cache:', err);
    }
  }

  // ─── FASE 2: Carregar parâmetros do tenant ───
  const [behavioralParams, radarPoints] = await Promise.all([
    getTenantBehavioralParams(tenantId),
    listActiveRadarPoints(tenantId),
  ]);
  const behaviorConfig = toBehaviorConfig(behavioralParams);

  // ─── FASE 3: Análise de viagens (inclui velocidade média, radar, comportamento) ───
  const tripAnalysis = await analyzeTrips({
    tenantId,
    from,
    to,
    behaviorConfig,
    includeRadarCheck: true,
  });

  // ─── FASE 4: Ranking comportamental de motoristas ───
  const driverScores = await computeDriverRanking(tenantId, tripAnalysis, from, to);

  // ─── FASE 5: Heatmap de risco ───
  const hotspotGrid = analyzeHotspots(tripAnalysis.behaviorEvents);

  // ─── FASE 6: Geração de infrações e advertências ───
  let infractions: GenerateInfractionsResult = { infractions_created: 0, alerts_created: 0, escalations: [] };
  if (autoGenerateWarnings && tripAnalysis.behaviorEvents.length > 0) {
    infractions = await generateInfractions(tenantId, tripAnalysis.behaviorEvents);

    // Avaliar escalonamento disciplinar para cada motorista afetado
    const employeeIds = [...new Set(
      tripAnalysis.behaviorEvents
        .filter(e => e.employee_id)
        .map(e => e.employee_id!)
    )];

    for (const empId of employeeIds) {
      try {
        const escalation = await evaluateEmployeeEscalation(tenantId, empId);
        if (escalation.shouldEscalate && escalation.action) {
          infractions.escalations.push({
            employee_id: empId,
            action: escalation.action,
            infraction_count: escalation.infractionCount,
          });
        }
      } catch (err) {
        console.warn(`[Pipeline] Escalonamento falhou para ${empId}:`, err);
      }
    }
  }

  // ─── FASE 7: Publicação de eventos na fila ───
  const eventPayloads: TraccarEventPublishPayload[] = tripAnalysis.behaviorEvents.map(e => ({
    tenantId,
    deviceId: e.device_id,
    eventType: e.event_type === 'overspeed' || e.event_type === 'radar_violation'
      ? 'speed_violation' as const
      : e.event_type === 'geofence_violation'
        ? 'geofence_breach' as const
        : 'device_event' as const,
    data: e.details,
    timestamp: e.event_timestamp,
  }));

  const published = publishBatchTraccarEvents(eventPayloads);

  return {
    sync: syncResult,
    tripAnalysis,
    radarViolations: tripAnalysis.trips.reduce((s, t) => s + t.violation_count, 0),
    driverScores,
    hotspotGrid,
    infractions,
    eventsPublished: published.length,
    executedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}

/**
 * Computa ranking comportamental de motoristas agregando dados de viagens.
 */
async function computeDriverRanking(
  tenantId: string,
  tripAnalysis: TripAnalysisResult,
  periodStart: string,
  periodEnd: string
): Promise<DriverRiskScore[]> {
  // Agrupa eventos por motorista
  const byEmployee = new Map<string, BehaviorEvent[]>();
  for (const evt of tripAnalysis.behaviorEvents) {
    const empId = evt.employee_id ?? 'unknown';
    if (!byEmployee.has(empId)) byEmployee.set(empId, []);
    byEmployee.get(empId)!.push(evt);
  }

  // Agrupa viagens por motorista
  const tripsByEmployee = new Map<string, typeof tripAnalysis.trips>();
  for (const trip of tripAnalysis.trips) {
    const empId = trip.employee_id ?? 'unknown';
    if (!tripsByEmployee.has(empId)) tripsByEmployee.set(empId, []);
    tripsByEmployee.get(empId)!.push(trip);
  }

  // Busca advertências ativas e termos pendentes
  const db = supabase as any;
  const [warningsRes, agreementsRes] = await Promise.all([
    db.from('employee_warnings').select('employee_id').eq('tenant_id', tenantId).eq('status', 'active'),
    db.from('employee_agreements').select('employee_id').eq('tenant_id', tenantId).eq('status', 'pending'),
  ]);

  const warningCounts: Record<string, number> = {};
  for (const w of (warningsRes.data || [])) {
    const eid = (w as any).employee_id;
    if (eid) warningCounts[eid] = (warningCounts[eid] || 0) + 1;
  }

  const agreementCounts: Record<string, number> = {};
  for (const a of (agreementsRes.data || [])) {
    const eid = (a as any).employee_id;
    if (eid) agreementCounts[eid] = (agreementCounts[eid] || 0) + 1;
  }

  // Monta inputs para o engine de score
  const inputs: ScoreInput[] = [];
  for (const [empId, events] of byEmployee.entries()) {
    if (empId === 'unknown') continue;
    const empTrips = tripsByEmployee.get(empId) || [];
    const totalDistanceKm = empTrips.reduce((s, t) => s + t.distance_km, 0);

    // Calcula dias desde último incidente
    const latestEvent = events.sort((a, b) =>
      new Date(b.event_timestamp).getTime() - new Date(a.event_timestamp).getTime()
    )[0];
    const daysSinceLastIncident = latestEvent
      ? Math.floor((Date.now() - new Date(latestEvent.event_timestamp).getTime()) / 86_400_000)
      : 90;

    inputs.push({
      employeeId: empId,
      behaviorEvents: events,
      activeWarnings: warningCounts[empId] || 0,
      pendingAgreements: agreementCounts[empId] || 0,
      daysSinceLastIncident,
      totalTrips: empTrips.length,
      totalDistanceKm,
      periodStart,
      periodEnd,
    });
  }

  return computeBatchDriverScores(inputs);
}

/**
 * Executa pipeline simplificado (sem sync, só análise).
 * Ideal para dashboards que só precisam reprocessar dados existentes.
 */
export async function executeLightPipeline(
  tenantId: string,
  from: string,
  to: string
): Promise<PipelineExecutionResult> {
  return executePipeline({
    tenantId,
    from,
    to,
    syncFirst: false,
    autoGenerateWarnings: false,
  });
}
