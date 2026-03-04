/**
 * RadarPointService — Cadastro e gestão de pontos de radar/fiscalização.
 */
import { supabase } from '@/integrations/supabase/client';
import type { EnforcementType, EnforcementSource } from '@/layers/tenant/traccar-config.types';

// Cast helper — tabelas não tipadas no schema gerado
const db = supabase as any;

export interface RadarPointRow {
  id: string;
  tenant_id: string;
  company_id: string | null;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  speed_limit_kmh: number;
  enforcement_type: EnforcementType;
  direction_degrees: number | null;
  source: EnforcementSource;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRadarPointDTO {
  tenant_id: string;
  company_id?: string | null;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters?: number;
  speed_limit_kmh: number;
  enforcement_type?: EnforcementType;
  direction_degrees?: number | null;
  source?: EnforcementSource;
}

export interface UpdateRadarPointDTO {
  name?: string;
  latitude?: number;
  longitude?: number;
  radius_meters?: number;
  speed_limit_kmh?: number;
  enforcement_type?: EnforcementType;
  direction_degrees?: number | null;
  is_active?: boolean;
}

export async function listRadarPoints(tenantId: string): Promise<RadarPointRow[]> {
  const { data, error } = await db.from('tenant_enforcement_points').select('*').eq('tenant_id', tenantId).order('name');
  if (error) throw new Error(error.message);
  return (data || []) as RadarPointRow[];
}

export async function listActiveRadarPoints(tenantId: string): Promise<RadarPointRow[]> {
  const { data, error } = await db.from('tenant_enforcement_points').select('*').eq('tenant_id', tenantId).eq('is_active', true).order('name');
  if (error) throw new Error(error.message);
  return (data || []) as RadarPointRow[];
}

export async function createRadarPoint(dto: CreateRadarPointDTO): Promise<string> {
  const { data, error } = await db.from('tenant_enforcement_points').insert([{
    tenant_id: dto.tenant_id,
    company_id: dto.company_id ?? null,
    name: dto.name,
    latitude: dto.latitude,
    longitude: dto.longitude,
    radius_meters: dto.radius_meters ?? 50,
    speed_limit_kmh: dto.speed_limit_kmh,
    enforcement_type: dto.enforcement_type ?? 'speed_camera',
    direction_degrees: dto.direction_degrees ?? null,
    source: dto.source ?? 'manual',
    is_active: true,
  }]).select('id').single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function updateRadarPoint(tenantId: string, pointId: string, dto: UpdateRadarPointDTO): Promise<void> {
  const { error } = await db.from('tenant_enforcement_points').update({ ...dto, updated_at: new Date().toISOString() }).eq('id', pointId).eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
}

export async function deactivateRadarPoint(tenantId: string, pointId: string): Promise<void> {
  await updateRadarPoint(tenantId, pointId, { is_active: false });
}

export async function deleteRadarPoint(tenantId: string, pointId: string): Promise<void> {
  const { error } = await db.from('tenant_enforcement_points').delete().eq('id', pointId).eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
}

export async function importRadarPoints(tenantId: string, points: Omit<CreateRadarPointDTO, 'tenant_id'>[]): Promise<number> {
  const rows = points.map(p => ({
    tenant_id: tenantId,
    company_id: p.company_id ?? null,
    name: p.name,
    latitude: p.latitude,
    longitude: p.longitude,
    radius_meters: p.radius_meters ?? 50,
    speed_limit_kmh: p.speed_limit_kmh,
    enforcement_type: p.enforcement_type ?? 'speed_camera',
    direction_degrees: p.direction_degrees ?? null,
    source: (p.source ?? 'imported') as EnforcementSource,
    is_active: true,
  }));
  const { error } = await db.from('tenant_enforcement_points').insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}
