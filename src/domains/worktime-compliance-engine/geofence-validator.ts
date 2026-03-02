/**
 * WorkTime Compliance Engine — GeoFenceValidator
 * Validates clock events against configured geofence zones.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  WorkTimeGeofence, CreateGeofenceDTO, GeofenceValidationResult,
  GeoFenceValidatorAPI, WorkTimeEventType,
} from './types';

export class GeoFenceValidator implements GeoFenceValidatorAPI {

  async validate(tenantId: string, lat: number, lng: number, eventType: WorkTimeEventType): Promise<GeofenceValidationResult> {
    const zones = await this.listZones(tenantId);
    const activeZones = zones.filter(z => z.is_active);

    if (activeZones.length === 0) {
      return { is_valid: true, matched_geofence: null, distance_meters: null, allowed: true, reason: 'No geofences configured' };
    }

    let closestZone: WorkTimeGeofence | null = null;
    let closestDistance = Infinity;

    for (const zone of activeZones) {
      const dist = this.haversineDistance(lat, lng, zone.latitude, zone.longitude);
      if (dist < closestDistance) {
        closestDistance = dist;
        closestZone = zone;
      }
    }

    if (!closestZone) {
      return { is_valid: false, matched_geofence: null, distance_meters: null, allowed: false, reason: 'No zones found' };
    }

    const isInside = closestDistance <= closestZone.radius_meters;
    const isAllowed = isInside && closestZone.allowed_clock_types.includes(eventType);

    return {
      is_valid: isInside,
      matched_geofence: isInside ? closestZone : null,
      distance_meters: Math.round(closestDistance),
      allowed: isAllowed,
      reason: !isInside
        ? `Fora da zona mais próxima (${closestZone.name}) por ${Math.round(closestDistance - closestZone.radius_meters)}m`
        : !isAllowed
          ? `Tipo de evento '${eventType}' não permitido na zona '${closestZone.name}'`
          : undefined,
    };
  }

  async listZones(tenantId: string): Promise<WorkTimeGeofence[]> {
    const { data, error } = await supabase
      .from('worktime_geofences' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name');
    if (error) throw error;
    return (data ?? []) as unknown as WorkTimeGeofence[];
  }

  async createZone(tenantId: string, dto: CreateGeofenceDTO): Promise<WorkTimeGeofence> {
    const { data, error } = await supabase
      .from('worktime_geofences' as any)
      .insert({
        tenant_id: tenantId,
        name: dto.name,
        description: dto.description ?? null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        radius_meters: dto.radius_meters,
        geofence_type: dto.geofence_type ?? 'work_site',
        allowed_clock_types: dto.allowed_clock_types ?? ['clock_in', 'clock_out', 'break_start', 'break_end'],
      })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as WorkTimeGeofence;
  }

  async updateZone(id: string, updates: Partial<CreateGeofenceDTO>): Promise<WorkTimeGeofence> {
    const { data, error } = await supabase
      .from('worktime_geofences' as any)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as WorkTimeGeofence;
  }

  async deleteZone(id: string): Promise<void> {
    const { error } = await supabase.from('worktime_geofences' as any).delete().eq('id', id);
    if (error) throw error;
  }

  /** Haversine distance in meters */
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
