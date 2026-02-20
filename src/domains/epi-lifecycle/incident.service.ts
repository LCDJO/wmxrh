/**
 * EPI Incident Service — Loss & Damage Registration
 *
 * Handles:
 *   1. Register EPI loss/damage incidents
 *   2. Auto-trigger Safety Automation Engine workflow
 *   3. Auto-generate replacement EpiRequirement
 *   4. Query/resolve incidents
 *
 * Integrates with:
 *   - Safety Automation Engine (createSignal → processSignal)
 *   - EPI Requirement Engine (auto-replacement)
 *   - EPI Audit Log (compliance trail)
 */

import { supabase } from '@/integrations/supabase/client';
import { createSignal } from '@/domains/safety-automation/signal-processor';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export type EpiIncidentType = 'lost' | 'damaged';
export type EpiIncidentStatus = 'aberto' | 'em_analise' | 'resolvido' | 'arquivado';

export interface EpiIncident {
  id: string;
  tenant_id: string;
  employee_id: string;
  epi_catalog_id: string;
  delivery_id: string | null;
  tipo: EpiIncidentType;
  data: string;
  justificativa: string;
  severity: string;
  status: EpiIncidentStatus;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  safety_signal_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EpiIncidentWithDetails extends EpiIncident {
  employee_name?: string;
  epi_nome?: string;
  ca_numero?: string;
}

export interface RegisterIncidentInput {
  tenantId: string;
  employeeId: string;
  epiCatalogId: string;
  deliveryId?: string;
  tipo: EpiIncidentType;
  data?: string;
  justificativa: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

// ═══════════════════════════════════════════════════════
// REGISTER INCIDENT
// ═══════════════════════════════════════════════════════

/**
 * Register an EPI loss/damage incident.
 *
 * Side effects:
 *   1. DB trigger marks delivery as 'extraviado' (for lost)
 *   2. DB trigger creates audit log entry
 *   3. This function creates a Safety Automation signal
 *   4. This function creates a replacement EpiRequirement
 */
export async function registerEpiIncident(
  input: RegisterIncidentInput,
): Promise<EpiIncident> {
  const severity = input.severity ?? (input.tipo === 'lost' ? 'high' : 'medium');

  // 1. Insert incident (triggers handle audit + delivery status update)
  const { data: incident, error } = await supabase
    .from('epi_incidents' as any)
    .insert({
      tenant_id: input.tenantId,
      employee_id: input.employeeId,
      epi_catalog_id: input.epiCatalogId,
      delivery_id: input.deliveryId ?? null,
      tipo: input.tipo,
      data: input.data ?? new Date().toISOString().split('T')[0],
      justificativa: input.justificativa,
      severity,
    })
    .select()
    .single();

  if (error) throw new Error(`Erro ao registrar incidente: ${error.message}`);
  const incidentData = incident as unknown as EpiIncident;

  // 2. Fetch EPI name for signal context
  const { data: epiInfo } = await supabase
    .from('epi_catalog' as any)
    .select('nome')
    .eq('id', input.epiCatalogId)
    .single();

  const epiNome = (epiInfo as any)?.nome ?? 'EPI';

  // 3. Create Safety Automation signal
  try {
    const signal = createSignal(
      input.tenantId,
      'incident_reported',
      severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : 'medium',
      'employee',
      input.employeeId,
      input.tipo === 'lost'
        ? `EPI "${epiNome}" extraviado`
        : `EPI "${epiNome}" danificado`,
      `Incidente registrado: ${input.justificativa}`,
      {
        incident_id: incidentData.id,
        tipo: input.tipo,
        epi_catalog_id: input.epiCatalogId,
        delivery_id: input.deliveryId,
        justificativa: input.justificativa,
      },
    );

    // Store signal ID on incident for traceability
    await supabase
      .from('epi_incidents' as any)
      .update({ safety_signal_id: signal.id } as any)
      .eq('id', incidentData.id);

    incidentData.safety_signal_id = signal.id;
  } catch (err) {
    console.warn('[EpiIncidentService] Safety signal creation failed:', err);
  }

  // 4. Auto-create replacement requirement
  try {
    const motivo = input.tipo === 'lost'
      ? `Substituição obrigatória — EPI "${epiNome}" extraviado em ${incidentData.data}`
      : `Substituição necessária — EPI "${epiNome}" danificado em ${incidentData.data}`;

    await supabase
      .from('epi_requirements' as any)
      .insert({
        tenant_id: input.tenantId,
        employee_id: input.employeeId,
        epi_catalog_id: input.epiCatalogId,
        risk_exposure_id: null,
        motivo,
        obrigatorio: true,
      });
  } catch (err) {
    console.warn('[EpiIncidentService] Replacement requirement creation failed:', err);
  }

  return incidentData;
}

// ═══════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════

/** Get all incidents for a tenant */
export async function getIncidents(
  tenantId: string,
  options?: { status?: EpiIncidentStatus; employeeId?: string },
): Promise<EpiIncidentWithDetails[]> {
  let query = supabase
    .from('epi_incidents' as any)
    .select(`
      *,
      employees:employee_id(name),
      epi_catalog:epi_catalog_id(nome, ca_numero)
    `)
    .eq('tenant_id', tenantId)
    .order('data', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }
  if (options?.employeeId) {
    query = query.eq('employee_id', options.employeeId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as any[]).map((r) => ({
    ...r,
    employee_name: r.employees?.name,
    epi_nome: r.epi_catalog?.nome,
    ca_numero: r.epi_catalog?.ca_numero,
  }));
}

/** Get incident by ID */
export async function getIncidentById(incidentId: string): Promise<EpiIncidentWithDetails | null> {
  const { data, error } = await supabase
    .from('epi_incidents' as any)
    .select(`
      *,
      employees:employee_id(name),
      epi_catalog:epi_catalog_id(nome, ca_numero)
    `)
    .eq('id', incidentId)
    .single();

  if (error || !data) return null;
  const r = data as any;
  return { ...r, employee_name: r.employees?.name, epi_nome: r.epi_catalog?.nome, ca_numero: r.epi_catalog?.ca_numero };
}

// ═══════════════════════════════════════════════════════
// RESOLUTION
// ═══════════════════════════════════════════════════════

/** Resolve an incident */
export async function resolveIncident(
  incidentId: string,
  notes: string,
): Promise<void> {
  const { error } = await supabase
    .from('epi_incidents' as any)
    .update({
      status: 'resolvido',
      resolution_notes: notes,
      resolved_at: new Date().toISOString(),
      resolved_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    } as any)
    .eq('id', incidentId);

  if (error) throw error;
}

/** Update incident status */
export async function updateIncidentStatus(
  incidentId: string,
  status: EpiIncidentStatus,
): Promise<void> {
  const { error } = await supabase
    .from('epi_incidents' as any)
    .update({ status } as any)
    .eq('id', incidentId);

  if (error) throw error;
}

// ═══════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════

/** Get incident counts by type/status for dashboard */
export async function getIncidentStats(tenantId: string): Promise<{
  total: number;
  open: number;
  lost: number;
  damaged: number;
}> {
  const { data } = await supabase
    .from('epi_incidents' as any)
    .select('tipo, status')
    .eq('tenant_id', tenantId);

  const rows = (data ?? []) as any[];
  return {
    total: rows.length,
    open: rows.filter(r => r.status === 'aberto' || r.status === 'em_analise').length,
    lost: rows.filter(r => r.tipo === 'lost').length,
    damaged: rows.filter(r => r.tipo === 'damaged').length,
  };
}
