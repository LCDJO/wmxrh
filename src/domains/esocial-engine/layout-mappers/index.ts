/**
 * Layout Mapper Registry
 *
 * Centralizes all event type → mapper associations.
 * Adding a new layout version = adding a new mapper file + registering here.
 */

import type { LayoutMapper } from '../types';
import { s2200Mapper } from './s2200-admissao.mapper';
import { s2206Mapper } from './s2206-alt-contratual.mapper';
import { s2220Mapper } from './s2220-aso.mapper';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MAPPER_REGISTRY = new Map<string, LayoutMapper<any>>([
  ['S-2200', s2200Mapper],
  ['S-2206', s2206Mapper],
  ['S-2220', s2220Mapper],
]);

/** Get mapper for a specific event type */
export function getMapper(eventType: string): LayoutMapper | null {
  return MAPPER_REGISTRY.get(eventType) ?? null;
}

/** List all registered event types with mappers */
export function getRegisteredEventTypes(): string[] {
  return Array.from(MAPPER_REGISTRY.keys());
}

/** Check if a mapper exists for the event type */
export function hasMapper(eventType: string): boolean {
  return MAPPER_REGISTRY.has(eventType);
}

export { s2200Mapper, s2206Mapper, s2220Mapper };
