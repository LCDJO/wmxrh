/**
 * SupportProtocolManager
 *
 * Generates and validates protocol numbers in the format: PROTO-YYYY-XXXXX
 * Example: PROTO-2026-00045
 *
 * The authoritative generation happens via the database default
 * (public.generate_support_protocol). This module provides client-side
 * utilities for formatting, parsing and validating protocol strings.
 */

export interface ParsedProtocol {
  prefix: string;   // "PROTO"
  year: number;      // 2026
  sequence: number;  // 45
  raw: string;       // "PROTO-2026-00045"
}

const PROTOCOL_REGEX = /^PROTO-(\d{4})-(\d{5})$/;

export const SupportProtocolManager = {
  /** Validate a protocol string */
  isValid(protocol: string): boolean {
    return PROTOCOL_REGEX.test(protocol);
  },

  /** Parse a protocol string into its components */
  parse(protocol: string): ParsedProtocol | null {
    const match = protocol.match(PROTOCOL_REGEX);
    if (!match) return null;
    return {
      prefix: 'PROTO',
      year: parseInt(match[1], 10),
      sequence: parseInt(match[2], 10),
      raw: protocol,
    };
  },

  /** Format a sequence number into a protocol string for a given year */
  format(year: number, sequence: number): string {
    return `PROTO-${year}-${String(sequence).padStart(5, '0')}`;
  },

  /** Display-friendly short label */
  shortLabel(protocol: string): string {
    const parsed = this.parse(protocol);
    if (!parsed) return protocol;
    return `#${parsed.sequence}`;
  },
};
