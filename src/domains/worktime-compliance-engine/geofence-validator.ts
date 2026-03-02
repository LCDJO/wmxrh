/**
 * WorkTime Compliance Engine — GeoFenceValidator
 * Validates clock events against configured geofence zones.
 * Supports tolerance_meters and enforcement_mode (block | flag).
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
      return {
        is_valid: true, matched_geofence: null, distance_meters: null,
        allowed: true, within_tolerance: true, enforcement: null,
        suggested_status: 'valid', reason: 'Nenhuma geofence configurada',
      };
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
      return {
        is_valid: false, matched_geofence: null, distance_meters: null,
        allowed: false, within_tolerance: false, enforcement: null,
        suggested_status: 'rejected', reason: 'Nenhuma zona encontrada',
      };
    }

    const radius = closestZone.radius_meters;
    const tolerance = closestZone.tolerance_meters ?? 50;
    const enforcement = closestZone.enforcement_mode ?? 'flag';

    const isInsideRadius = closestDistance <= radius;
    const isWithinTolerance = closestDistance <= (radius + tolerance);
    const isOutside = !isWithinTolerance;

    const eventAllowed = closestZone.allowed_clock_types.includes(eventType);

    // Determine suggested_status based on position and enforcement
    let suggestedStatus: 'valid' | 'rejected' | 'flagged' = 'valid';
    let reason: string | undefined;

    if (isOutside) {
      // Completely outside radius + tolerance
      const excessMeters = Math.round(closestDistance - radius - tolerance);
      reason = `Fora da zona '${closestZone.name}' por ${excessMeters}m além da tolerância (raio: ${radius}m + tolerância: ${tolerance}m)`;

      if (enforcement === 'block') {
        suggestedStatus = 'rejected';
      } else {
        suggestedStatus = 'flagged';
      }
    } else if (!isInsideRadius && isWithinTolerance) {
      // In tolerance band — always flag
      const excessMeters = Math.round(closestDistance - radius);
      reason = `Dentro da tolerância da zona '${closestZone.name}' (+${excessMeters}m além do raio de ${radius}m)`;
      suggestedStatus = 'flagged';
    } else if (!eventAllowed) {
      reason = `Tipo de evento '${eventType}' não permitido na zona '${closestZone.name}'`;
      suggestedStatus = 'flagged';
    }

    return {
      is_valid: isInsideRadius,
      matched_geofence: isWithinTolerance ? closestZone : null,
      distance_meters: Math.round(closestDistance),
      allowed: isWithinTolerance && eventAllowed,
      within_tolerance: isWithinTolerance,
      enforcement,
      suggested_status: suggestedStatus,
      reason,
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
        tolerance_meters: dto.tolerance_meters ?? 50,
        enforcement_mode: dto.enforcement_mode ?? 'flag',
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
