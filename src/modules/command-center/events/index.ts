/**
 * Command Center cross-module event handlers.
 * Listens for Fleet, SST, and Compliance events to feed the live event stream.
 */
import { COMMAND_CENTER_EVENTS } from '../manifest';

export type CommandCenterEventType = typeof COMMAND_CENTER_EVENTS[keyof typeof COMMAND_CENTER_EVENTS];

export interface CommandCenterEvent {
  type: CommandCenterEventType;
  payload: Record<string, unknown>;
  timestamp: string;
}

const listeners: Array<(event: CommandCenterEvent) => void> = [];

export function onCommandCenterEvent(cb: (event: CommandCenterEvent) => void) {
  listeners.push(cb);
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function emitCommandCenterEvent(type: CommandCenterEventType, payload: Record<string, unknown>) {
  const event: CommandCenterEvent = { type, payload, timestamp: new Date().toISOString() };
  listeners.forEach(cb => cb(event));
}
