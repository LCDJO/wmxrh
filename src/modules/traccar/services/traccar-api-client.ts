/**
 * TraccarApiClient — Typed client-side service for all Traccar API endpoints.
 * All calls go through the traccar-proxy edge function.
 */
import { supabase } from '@/integrations/supabase/client';

// ── Types ──

export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
  disabled: boolean;
  lastUpdate: string | null;
  positionId: number | null;
  groupId: number | null;
  phone: string | null;
  model: string | null;
  contact: string | null;
  category: string | null;
  attributes: Record<string, unknown>;
}

export interface TraccarPosition {
  id: number;
  deviceId: number;
  protocol: string;
  deviceTime: string;
  fixTime: string;
  serverTime: string;
  valid: boolean;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  course: number;
  address: string | null;
  accuracy: number;
  network: Record<string, unknown>;
  geofenceIds: number[];
  attributes: Record<string, unknown>;
}

export interface TraccarEvent {
  id: number;
  type: string;
  eventTime: string;
  deviceId: number;
  positionId: number;
  geofenceId: number;
  maintenanceId: number;
  attributes: Record<string, unknown>;
}

export interface TraccarGeofence {
  id: number;
  name: string;
  description: string | null;
  area: string;
  calendarId: number;
  attributes: Record<string, unknown>;
}

export interface TraccarNotification {
  id: number;
  type: string;
  description: string | null;
  always: boolean;
  commandId: number;
  notificators: string;
  calendarId: number;
  attributes: Record<string, unknown>;
}

export interface TraccarNotificationType {
  type: string;
}

export interface TraccarGroup {
  id: number;
  name: string;
  groupId: number;
  attributes: Record<string, unknown>;
}

export interface TraccarDriver {
  id: number;
  name: string;
  uniqueId: string;
  attributes: Record<string, unknown>;
}

export interface TraccarMaintenance {
  id: number;
  name: string;
  type: string;
  start: number;
  period: number;
  attributes: Record<string, unknown>;
}

export interface TraccarCommand {
  id: number;
  deviceId: number;
  description: string;
  type: string;
  attributes: Record<string, unknown>;
}

export interface TraccarReportSummary {
  deviceId: number;
  deviceName: string;
  maxSpeed: number;
  averageSpeed: number;
  distance: number;
  spentFuel: number;
  engineHours: number;
}

export interface TraccarReportTrip {
  deviceId: number;
  deviceName: string;
  maxSpeed: number;
  averageSpeed: number;
  distance: number;
  spentFuel: number;
  duration: number;
  startTime: string;
  startAddress: string;
  startLat: number;
  startLon: number;
  endTime: string;
  endAddress: string;
  endLat: number;
  endLon: number;
  driverUniqueId: string;
  driverName: string;
}

export interface TraccarReportStop {
  deviceId: number;
  deviceName: string;
  duration: number;
  startTime: string;
  address: string;
  lat: number;
  lon: number;
  endTime: string;
  spentFuel: number;
  engineHours: number;
}

export interface TraccarServerInfo {
  id: number;
  version: string;
  registration: boolean;
  readonly: boolean;
  attributes: Record<string, unknown>;
}

export interface TraccarStatistics {
  captureTime: string;
  activeUsers: number;
  activeDevices: number;
  requests: number;
  messagesReceived: number;
  messagesStored: number;
}

// ── API Response ──

interface ProxyResponse<T = unknown> {
  success: boolean;
  action: string;
  data: T;
  error?: string;
  details?: unknown;
}

// ── Client ──

async function invoke<T>(tenantId: string, action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('traccar-proxy', {
    body: { action, tenantId, ...params },
  });

  if (error) throw new Error(error.message || 'Falha na comunicação com o Traccar');

  const resp = data as ProxyResponse<T>;
  if (!resp.success) throw new Error(resp.error || 'Erro desconhecido do Traccar');

  return resp.data;
}

/**
 * Complete Traccar API client.
 * All methods require a tenantId to resolve credentials.
 */
export const traccarApi = {
  // ── Server ──
  testConnection: (tenantId: string) => invoke<TraccarServerInfo>(tenantId, 'test-connection'),
  getServerInfo: (tenantId: string) => invoke<TraccarServerInfo>(tenantId, 'server-info'),
  reverseGeocode: (tenantId: string, latitude: number, longitude: number) =>
    invoke<string>(tenantId, 'server-geocode', { latitude, longitude }),

  // ── Devices ──
  getDevices: (tenantId: string) => invoke<TraccarDevice[]>(tenantId, 'devices'),
  getDevice: (tenantId: string, deviceId: number) => invoke<TraccarDevice[]>(tenantId, 'device-detail', { deviceId }),
  createDevice: (tenantId: string, payload: Partial<TraccarDevice>) =>
    invoke<TraccarDevice>(tenantId, 'device-create', { payload }),
  updateDevice: (tenantId: string, payload: TraccarDevice) =>
    invoke<TraccarDevice>(tenantId, 'device-update', { payload }),
  deleteDevice: (tenantId: string, deviceId: number) =>
    invoke<null>(tenantId, 'device-delete', { deviceId }),

  // ── Groups ──
  getGroups: (tenantId: string) => invoke<TraccarGroup[]>(tenantId, 'groups'),
  createGroup: (tenantId: string, payload: Partial<TraccarGroup>) =>
    invoke<TraccarGroup>(tenantId, 'group-create', { payload }),
  updateGroup: (tenantId: string, payload: TraccarGroup) =>
    invoke<TraccarGroup>(tenantId, 'group-update', { payload }),
  deleteGroup: (tenantId: string, groupId: number) =>
    invoke<null>(tenantId, 'group-delete', { groupId }),

  // ── Positions ──
  getPositions: (tenantId: string, opts?: { deviceId?: number; from?: string; to?: string }) =>
    invoke<TraccarPosition[]>(tenantId, 'positions', opts || {}),

  // ── Events ──
  getEvent: (tenantId: string, eventId: number) => invoke<TraccarEvent>(tenantId, 'event-detail', { eventId }),

  // ── Reports ──
  getReportEvents: (tenantId: string, opts: { deviceId?: string | string[]; groupId?: string | string[]; eventType?: string | string[]; from: string; to: string }) =>
    invoke<TraccarEvent[]>(tenantId, 'reports-events', opts),
  getReportRoute: (tenantId: string, opts: { deviceId?: string | string[]; groupId?: string | string[]; from: string; to: string }) =>
    invoke<TraccarPosition[]>(tenantId, 'reports-route', opts),
  getReportSummary: (tenantId: string, opts: { deviceId?: string | string[]; groupId?: string | string[]; from: string; to: string }) =>
    invoke<TraccarReportSummary[]>(tenantId, 'reports-summary', opts),
  getReportTrips: (tenantId: string, opts: { deviceId?: string | string[]; groupId?: string | string[]; from: string; to: string }) =>
    invoke<TraccarReportTrip[]>(tenantId, 'reports-trips', opts),
  getReportStops: (tenantId: string, opts: { deviceId?: string | string[]; groupId?: string | string[]; from: string; to: string }) =>
    invoke<TraccarReportStop[]>(tenantId, 'reports-stops', opts),

  // ── Notifications ──
  getNotifications: (tenantId: string) => invoke<TraccarNotification[]>(tenantId, 'notifications'),
  getNotificationTypes: (tenantId: string) => invoke<TraccarNotificationType[]>(tenantId, 'notification-types'),
  createNotification: (tenantId: string, payload: Partial<TraccarNotification>) =>
    invoke<TraccarNotification>(tenantId, 'notification-create', { payload }),
  updateNotification: (tenantId: string, notificationId: number, payload: TraccarNotification) =>
    invoke<TraccarNotification>(tenantId, 'notification-update', { notificationId, payload }),
  deleteNotification: (tenantId: string, notificationId: number) =>
    invoke<null>(tenantId, 'notification-delete', { notificationId }),
  testNotification: (tenantId: string) => invoke<null>(tenantId, 'notification-test'),

  // ── Geofences ──
  getGeofences: (tenantId: string) => invoke<TraccarGeofence[]>(tenantId, 'geofences'),
  createGeofence: (tenantId: string, payload: Partial<TraccarGeofence>) =>
    invoke<TraccarGeofence>(tenantId, 'geofence-create', { payload }),
  updateGeofence: (tenantId: string, payload: TraccarGeofence) =>
    invoke<TraccarGeofence>(tenantId, 'geofence-update', { payload }),
  deleteGeofence: (tenantId: string, geofenceId: number) =>
    invoke<null>(tenantId, 'geofence-delete', { geofenceId }),

  // ── Commands ──
  getCommands: (tenantId: string) => invoke<TraccarCommand[]>(tenantId, 'commands'),
  sendCommand: (tenantId: string, payload: Partial<TraccarCommand>) =>
    invoke<TraccarCommand>(tenantId, 'commands-send', { payload }),
  getCommandTypes: (tenantId: string, deviceId?: number) =>
    invoke<{ type: string }[]>(tenantId, 'commands-types', { deviceId }),

  // ── Drivers ──
  getDrivers: (tenantId: string) => invoke<TraccarDriver[]>(tenantId, 'drivers'),
  createDriver: (tenantId: string, payload: Partial<TraccarDriver>) =>
    invoke<TraccarDriver>(tenantId, 'driver-create', { payload }),
  updateDriver: (tenantId: string, payload: TraccarDriver) =>
    invoke<TraccarDriver>(tenantId, 'driver-update', { payload }),
  deleteDriver: (tenantId: string, driverId: number) =>
    invoke<null>(tenantId, 'driver-delete', { driverId }),

  // ── Maintenance ──
  getMaintenance: (tenantId: string) => invoke<TraccarMaintenance[]>(tenantId, 'maintenance'),
  createMaintenance: (tenantId: string, payload: Partial<TraccarMaintenance>) =>
    invoke<TraccarMaintenance>(tenantId, 'maintenance-create', { payload }),
  updateMaintenance: (tenantId: string, payload: TraccarMaintenance) =>
    invoke<TraccarMaintenance>(tenantId, 'maintenance-update', { payload }),
  deleteMaintenance: (tenantId: string, maintenanceId: number) =>
    invoke<null>(tenantId, 'maintenance-delete', { maintenanceId }),

  // ── Permissions ──
  linkPermission: (tenantId: string, payload: Record<string, unknown>) =>
    invoke<null>(tenantId, 'permission-link', { payload }),
  unlinkPermission: (tenantId: string, payload: Record<string, unknown>) =>
    invoke<null>(tenantId, 'permission-unlink', { payload }),

  // ── Statistics & Health ──
  getStatistics: (tenantId: string, from: string, to: string) =>
    invoke<TraccarStatistics[]>(tenantId, 'statistics', { from, to }),
  getHealth: (tenantId: string) => invoke<string>(tenantId, 'health'),

  // ── Calendars ──
  getCalendars: (tenantId: string) => invoke<unknown[]>(tenantId, 'calendars'),
};
