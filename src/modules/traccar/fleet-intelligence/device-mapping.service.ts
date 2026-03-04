/**
 * DeviceMappingService — Vinculação de dispositivos GPS a colaboradores e veículos.
 *
 * CRUD completo para o mapeamento tenant-scoped de dispositivos Traccar
 * para entidades internas (employees, vehicles).
 */
import { supabase } from '@/integrations/supabase/client';

export interface DeviceMapping {
  id: string;
  tenant_id: string;
  traccar_id: number;
  unique_id: string;
  device_name: string;
  employee_id: string | null;
  employee_name?: string | null;
  vehicle_id: string | null;
  vehicle_plate?: string | null;
  label: string | null;
  sim_number: string | null;
  is_active: boolean;
  mapped_at: string;
  updated_at: string;
}

export interface CreateDeviceMappingDTO {
  tenant_id: string;
  traccar_id: number;
  unique_id: string;
  device_name: string;
  employee_id?: string | null;
  vehicle_id?: string | null;
  label?: string | null;
  sim_number?: string | null;
}

export interface UpdateDeviceMappingDTO {
  employee_id?: string | null;
  vehicle_id?: string | null;
  label?: string | null;
  sim_number?: string | null;
  is_active?: boolean;
}

/**
 * Lista todos os mapeamentos de dispositivos do tenant.
 */
export async function listDeviceMappings(tenantId: string): Promise<DeviceMapping[]> {
  const { data, error } = await supabase
    .from('traccar_device_cache')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name');

  if (error) throw new Error(error.message);

  return (data || []).map((d: any) => ({
    id: d.id,
    tenant_id: d.tenant_id,
    traccar_id: d.traccar_id,
    unique_id: d.unique_id,
    device_name: d.name,
    employee_id: d.employee_id,
    vehicle_id: d.vehicle_id,
    label: d.name,
    sim_number: null,
    is_active: d.computed_status !== 'offline',
    mapped_at: d.synced_at,
    updated_at: d.synced_at,
  }));
}

/**
 * Vincula um dispositivo a um colaborador e/ou veículo.
 */
export async function linkDevice(
  tenantId: string,
  traccarId: number,
  data: { employeeId?: string | null; vehicleId?: string | null }
): Promise<void> {
  const { error } = await supabase
    .from('traccar_device_cache')
    .update({
      employee_id: data.employeeId ?? null,
      vehicle_id: data.vehicleId ?? null,
    })
    .eq('tenant_id', tenantId)
    .eq('traccar_id', traccarId);

  if (error) throw new Error(error.message);
}

/**
 * Desvincula um dispositivo (remove employee e vehicle).
 */
export async function unlinkDevice(tenantId: string, traccarId: number): Promise<void> {
  await linkDevice(tenantId, traccarId, { employeeId: null, vehicleId: null });
}

/**
 * Busca dispositivos não vinculados a nenhum colaborador.
 */
export async function getUnlinkedDevices(tenantId: string): Promise<DeviceMapping[]> {
  const all = await listDeviceMappings(tenantId);
  return all.filter(d => !d.employee_id);
}

/**
 * Busca o dispositivo vinculado a um colaborador específico.
 */
export async function getDeviceByEmployee(
  tenantId: string,
  employeeId: string
): Promise<DeviceMapping | null> {
  const { data, error } = await supabase
    .from('traccar_device_cache')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: (data as any).id,
    tenant_id: (data as any).tenant_id,
    traccar_id: (data as any).traccar_id,
    unique_id: (data as any).unique_id,
    device_name: (data as any).name,
    employee_id: (data as any).employee_id,
    vehicle_id: (data as any).vehicle_id,
    label: (data as any).name,
    sim_number: null,
    is_active: (data as any).computed_status !== 'offline',
    mapped_at: (data as any).synced_at,
    updated_at: (data as any).synced_at,
  };
}
