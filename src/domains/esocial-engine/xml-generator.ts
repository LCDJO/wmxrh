/**
 * eSocial XML Generator
 *
 * Converts ESocialEnvelope payloads into eSocial-compliant XML strings.
 * Handles namespaces, schema references, and proper element ordering
 * per government specification.
 *
 * Pure logic — no I/O. Produces XML strings from envelope data.
 */

import type { ESocialEnvelope, LayoutVersion } from './types';
import { EVENT_TYPE_REGISTRY } from './types';

// ════════════════════════════════════
// NAMESPACE CONFIG PER LAYOUT VERSION
// ════════════════════════════════════

const NAMESPACE_MAP: Record<LayoutVersion, { ns: string; xsd: string }> = {
  'S-1.0': {
    ns: 'http://www.esocial.gov.br/schema/evt/evtMonit/v_S_01_00_00',
    xsd: 'http://www.w3.org/2001/XMLSchema-instance',
  },
  'S-1.1': {
    ns: 'http://www.esocial.gov.br/schema/evt/evtMonit/v_S_01_01_00',
    xsd: 'http://www.w3.org/2001/XMLSchema-instance',
  },
  'S-1.2': {
    ns: 'http://www.esocial.gov.br/schema/evt/evtMonit/v_S_01_02_00',
    xsd: 'http://www.w3.org/2001/XMLSchema-instance',
  },
};

// ════════════════════════════════════
// XML ESCAPING
// ════════════════════════════════════

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ════════════════════════════════════
// JSON → XML CONVERSION
// ════════════════════════════════════

function jsonToXmlElements(obj: Record<string, unknown>, indent: number = 2): string {
  const pad = ' '.repeat(indent);
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;

    if (typeof value === 'object' && !Array.isArray(value)) {
      lines.push(`${pad}<${key}>`);
      lines.push(jsonToXmlElements(value as Record<string, unknown>, indent + 2));
      lines.push(`${pad}</${key}>`);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          lines.push(`${pad}<${key}>`);
          lines.push(jsonToXmlElements(item as Record<string, unknown>, indent + 2));
          lines.push(`${pad}</${key}>`);
        } else {
          lines.push(`${pad}<${key}>${escapeXml(String(item))}</${key}>`);
        }
      }
    } else {
      lines.push(`${pad}<${key}>${escapeXml(String(value))}</${key}>`);
    }
  }

  return lines.join('\n');
}

// ════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════

export interface XMLGenerationResult {
  xml: string;
  envelope_id: string;
  event_type: string;
  schema_id: string;
  /** Size in bytes (UTF-8) */
  size_bytes: number;
}

/**
 * Generate eSocial XML from an envelope.
 */
export function generateXML(envelope: ESocialEnvelope): XMLGenerationResult {
  const registry = EVENT_TYPE_REGISTRY[envelope.event_type];
  const schemaId = registry?.schema_id ?? 'evtGenerico';
  const nsConfig = NAMESPACE_MAP[envelope.layout_version];

  const payloadXml = jsonToXmlElements(envelope.payload, 6);

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<eSocial xmlns="${nsConfig.ns}" xmlns:xsi="${nsConfig.xsd}">`,
    `  <envioLoteEventos>`,
    `    <ideEmpregador>`,
    `      <tpInsc>1</tpInsc>`,
    `      <nrInsc>${escapeXml(envelope.company_id || '')}</nrInsc>`,
    `    </ideEmpregador>`,
    `    <ideTransmissor>`,
    `      <tpInsc>1</tpInsc>`,
    `      <nrInsc>${escapeXml(envelope.company_id || '')}</nrInsc>`,
    `    </ideTransmissor>`,
    `    <eventos>`,
    `      <evento Id="ID${envelope.id.replace(/-/g, '')}">`,
    `        <${schemaId}>`,
    `          <ideEvento>`,
    `            <indRetif>1</indRetif>`,
    `            <tpAmb>2</tpAmb>`,
    `            <procEmi>1</procEmi>`,
    `            <verProc>${envelope.layout_version}</verProc>`,
    `          </ideEvento>`,
    payloadXml,
    `        </${schemaId}>`,
    `      </evento>`,
    `    </eventos>`,
    `  </envioLoteEventos>`,
    `</eSocial>`,
  ].join('\n');

  return {
    xml,
    envelope_id: envelope.id,
    event_type: envelope.event_type,
    schema_id: schemaId,
    size_bytes: new TextEncoder().encode(xml).length,
  };
}

/**
 * Generate XML for a batch of envelopes.
 */
export function generateBatchXML(envelopes: ESocialEnvelope[]): XMLGenerationResult[] {
  return envelopes.map(generateXML);
}

/**
 * Validate that generated XML meets minimum structural requirements.
 */
export function validateXMLStructure(xml: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!xml.startsWith('<?xml')) {
    errors.push('Missing XML declaration');
  }
  if (!xml.includes('<eSocial')) {
    errors.push('Missing root <eSocial> element');
  }
  if (!xml.includes('<ideEmpregador>')) {
    errors.push('Missing <ideEmpregador> element');
  }
  if (!xml.includes('<eventos>')) {
    errors.push('Missing <eventos> element');
  }

  // Check matching tags (basic)
  const openTags = (xml.match(/<[a-zA-Z][^/]*?>/g) || []).length;
  const closeTags = (xml.match(/<\/[a-zA-Z]+>/g) || []).length;
  const selfClosing = (xml.match(/<[^?][^>]*\/>/g) || []).length;
  if (openTags !== closeTags + selfClosing) {
    errors.push(`Mismatched tags: ${openTags} open vs ${closeTags} close + ${selfClosing} self-closing`);
  }

  return { valid: errors.length === 0, errors };
}
