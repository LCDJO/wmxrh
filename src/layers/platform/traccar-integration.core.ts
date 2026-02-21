/**
 * ══════════════════════════════════════════════════════════
 * PLATFORM LAYER — Traccar Integration Core
 * ══════════════════════════════════════════════════════════
 *
 * Global adapter that normalizes Traccar events into a
 * canonical format, computes integrity hashes, and forwards
 * to the Tenant Layer. The Platform Layer:
 *
 *  ✅ Receives raw webhooks from Traccar instances
 *  ✅ Normalizes heterogeneous payloads into TraccarCanonicalEvent
 *  ✅ Computes SHA-256 integrity hashes for immutability
 *  ✅ Dispatches normalized events to tenant-scoped storage
 *
 *  ❌ Does NOT store operational data
 *  ❌ Does NOT know tenant business rules
 *  ❌ Does NOT evaluate behavior (that's Tenant Layer)
 */

// ══════════════════════════════════════════════════════════
// CANONICAL EVENT (output of normalization)
// ══════════════════════════════════════════════════════════

export interface TraccarCanonicalEvent {
  /** Unique event fingerprint (SHA-256 of device_id + timestamp + lat + lon + speed) */
  integrity_hash: string;
  /** Raw Traccar device identifier */
  device_id: string;
  /** WGS-84 coordinates */
  latitude: number;
  longitude: number;
  /** km/h */
  speed: number;
  /** Engine ignition state (null if sensor unavailable) */
  ignition: boolean | null;
  /** ISO-8601 UTC timestamp from device */
  event_timestamp: string;
  /** Heading / course in degrees (0-360) */
  course: number | null;
  /** Altitude in meters */
  altitude: number | null;
  /** Satellite count at moment of fix */
  satellites: number | null;
  /** Battery level 0-100 (for portable trackers) */
  battery_level: number | null;
  /** Additional Traccar attributes (alarms, io, etc.) */
  attributes: Record<string, unknown>;
  /** Original unmodified payload for forensic purposes */
  raw_payload: Record<string, unknown>;
  /** ISO-8601 UTC timestamp of ingestion */
  ingested_at: string;
}

// ══════════════════════════════════════════════════════════
// RAW TRACCAR PAYLOADS (known variants)
// ══════════════════════════════════════════════════════════

/** Traccar OsmAnd protocol payload */
export interface TraccarOsmAndPayload {
  id?: string;
  deviceId?: string | number;
  lat?: number;
  latitude?: number;
  lon?: number;
  lng?: number;
  longitude?: number;
  speed?: number;
  bearing?: number;
  altitude?: number;
  timestamp?: string | number;
  deviceTime?: string;
  serverTime?: string;
  ignition?: boolean;
  battery?: number;
  batteryLevel?: number;
  satellites?: number;
  sat?: number;
  [key: string]: unknown;
}

/** Traccar webhook / API position payload */
export interface TraccarWebhookPayload {
  device?: { id?: number; uniqueId?: string; name?: string };
  position?: {
    deviceId?: number;
    latitude?: number;
    longitude?: number;
    speed?: number;
    course?: number;
    altitude?: number;
    deviceTime?: string;
    serverTime?: string;
    attributes?: Record<string, unknown>;
  };
  event?: {
    type?: string;
    deviceId?: number;
    attributes?: Record<string, unknown>;
  };
  [key: string]: unknown;
}

// ══════════════════════════════════════════════════════════
// EVENT NORMALIZER
// ══════════════════════════════════════════════════════════

/**
 * Normalizes any known Traccar payload variant into a
 * TraccarCanonicalEvent. Pure function, no side effects.
 */
export function normalizeTraccarEvent(
  raw: Record<string, unknown>,
  overrideTimestamp?: string
): Omit<TraccarCanonicalEvent, 'integrity_hash' | 'ingested_at'> {
  // Detect webhook-style payload (nested position object)
  const pos = (raw.position ?? raw) as Record<string, unknown>;
  const device = (raw.device ?? {}) as Record<string, unknown>;

  const device_id = String(
    pos.deviceId ?? device.uniqueId ?? device.id ?? raw.deviceId ?? raw.device_id ?? raw.id ?? ''
  );

  const latitude = Number(pos.latitude ?? pos.lat ?? raw.latitude ?? raw.lat ?? 0);
  const longitude = Number(pos.longitude ?? pos.lon ?? pos.lng ?? raw.longitude ?? raw.lon ?? raw.lng ?? 0);
  const speed = Number(pos.speed ?? raw.speed ?? 0);
  const course = pos.course != null ? Number(pos.course) : (raw.bearing != null ? Number(raw.bearing) : null);
  const altitude = pos.altitude != null ? Number(pos.altitude) : (raw.altitude != null ? Number(raw.altitude) : null);

  const ignition = pos.ignition != null
    ? Boolean(pos.ignition)
    : (raw.ignition != null ? Boolean(raw.ignition) : null);

  const battery_level = pos.battery != null
    ? Number(pos.battery)
    : (raw.batteryLevel ?? raw.battery) != null
      ? Number(raw.batteryLevel ?? raw.battery)
      : null;

  const satellites = pos.satellites != null
    ? Number(pos.satellites)
    : (raw.sat ?? raw.satellites) != null
      ? Number(raw.sat ?? raw.satellites)
      : null;

  const event_timestamp = String(
    overrideTimestamp ??
    pos.deviceTime ?? raw.deviceTime ?? raw.event_timestamp ?? raw.timestamp ??
    new Date().toISOString()
  );

  const attributes = (pos.attributes ?? {}) as Record<string, unknown>;

  return {
    device_id,
    latitude,
    longitude,
    speed,
    ignition,
    event_timestamp,
    course,
    altitude,
    satellites,
    battery_level,
    attributes,
    raw_payload: raw,
  };
}

// ══════════════════════════════════════════════════════════
// INTEGRITY LAYER (SHA-256)
// ══════════════════════════════════════════════════════════

/**
 * Computes a SHA-256 integrity hash for a canonical event.
 * The hash covers the immutable fields that define event identity.
 *
 * In Edge Functions (Deno), use computeIntegrityHashAsync.
 * In browser, this is a sync fallback using a simple FNV-1a.
 */
export function computeIntegrityHashSync(
  event: Pick<TraccarCanonicalEvent, 'device_id' | 'event_timestamp' | 'latitude' | 'longitude' | 'speed'>
): string {
  const input = `${event.device_id}|${event.event_timestamp}|${event.latitude}|${event.longitude}|${event.speed}`;
  // FNV-1a 64-bit (browser fallback — real SHA-256 in Edge Function)
  let hash = 0xcbf29ce484222325n;
  const FNV_PRIME = 0x100000001b3n;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * FNV_PRIME) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
}

/**
 * Async SHA-256 using Web Crypto API (for Edge Functions / Deno).
 */
export async function computeIntegrityHashAsync(
  event: Pick<TraccarCanonicalEvent, 'device_id' | 'event_timestamp' | 'latitude' | 'longitude' | 'speed'>
): Promise<string> {
  const input = `${event.device_id}|${event.event_timestamp}|${event.latitude}|${event.longitude}|${event.speed}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);

  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback to FNV-1a
  return computeIntegrityHashSync(event);
}

// ══════════════════════════════════════════════════════════
// WEBHOOK RECEIVER TYPES
// ══════════════════════════════════════════════════════════

export interface TraccarWebhookValidation {
  isValid: boolean;
  tenantId: string | null;
  error?: string;
}

/**
 * Validates an incoming Traccar webhook request.
 * Platform-level validation only (auth, format).
 * Tenant-level rules are NOT evaluated here.
 */
export function validateWebhookRequest(
  webhookSecret: string | null,
  expectedSecret: string | null,
  tenantId: string | null
): TraccarWebhookValidation {
  if (expectedSecret && webhookSecret !== expectedSecret) {
    return { isValid: false, tenantId: null, error: 'Invalid webhook secret' };
  }
  if (!tenantId) {
    return { isValid: false, tenantId: null, error: 'tenant_id is required' };
  }
  return { isValid: true, tenantId };
}

// ══════════════════════════════════════════════════════════
// PLATFORM DISPATCH (event forwarding)
// ══════════════════════════════════════════════════════════

export interface TraccarDispatchResult {
  tenantId: string;
  eventsIngested: number;
  eventsRejected: number;
  integrityHashes: string[];
}

/**
 * Builds the dispatch manifest for a batch of normalized events.
 * The actual database insert happens in the Edge Function.
 */
export function buildDispatchManifest(
  tenantId: string,
  events: TraccarCanonicalEvent[]
): TraccarDispatchResult {
  const valid = events.filter(e => e.device_id !== '' && e.latitude !== 0 && e.longitude !== 0);
  return {
    tenantId,
    eventsIngested: valid.length,
    eventsRejected: events.length - valid.length,
    integrityHashes: valid.map(e => e.integrity_hash),
  };
}
