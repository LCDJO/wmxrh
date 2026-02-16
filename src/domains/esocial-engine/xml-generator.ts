/**
 * eSocial XML Generator
 *
 * Converts ESocialEnvelope payloads into eSocial-compliant XML strings
 * following the official government schema structure.
 *
 * Output structure (eSocialEventXML):
 *   - id_evento: unique event identifier (ID + UUID without dashes)
 *   - tipo_evento: event type code (e.g. S-2200)
 *   - xml_payload: full XML string conforming to eSocial XSD
 *   - versao_layout: layout version (e.g. S-1.2)
 *
 * Handles namespaces per layout version, proper element ordering,
 * batch lote generation, and structural validation.
 *
 * Pure logic — no I/O.
 */

import type { ESocialEnvelope, LayoutVersion } from './types';
import { EVENT_TYPE_REGISTRY } from './types';

// ════════════════════════════════════
// NAMESPACE CONFIG PER LAYOUT VERSION
// ════════════════════════════════════

interface NamespaceConfig {
  /** Base namespace for the eSocial schema version */
  base: string;
  /** XSD instance namespace */
  xsi: string;
  /** Schema location hint */
  schemaLocation: string;
}

function getNamespaceForEvent(schemaId: string, version: LayoutVersion): NamespaceConfig {
  const versionSlug: Record<LayoutVersion, string> = {
    'S-1.0': 'v_S_01_00_00',
    'S-1.1': 'v_S_01_01_00',
    'S-1.2': 'v_S_01_02_00',
  };
  const slug = versionSlug[version];
  return {
    base: `http://www.esocial.gov.br/schema/evt/${schemaId}/${slug}`,
    xsi: 'http://www.w3.org/2001/XMLSchema-instance',
    schemaLocation: `http://www.esocial.gov.br/schema/evt/${schemaId}/${slug} ${schemaId}-${slug}.xsd`,
  };
}

/** Namespace for the lote (batch submission envelope) */
function getLoteNamespace(version: LayoutVersion): NamespaceConfig {
  const versionSlug: Record<LayoutVersion, string> = {
    'S-1.0': 'v1_1_1',
    'S-1.1': 'v1_1_1',
    'S-1.2': 'v1_1_1',
  };
  return {
    base: `http://www.esocial.gov.br/schema/lote/eventos/envio/${versionSlug[version]}`,
    xsi: 'http://www.w3.org/2001/XMLSchema-instance',
    schemaLocation: '',
  };
}

// ════════════════════════════════════
// XML ESCAPING & FORMATTING
// ════════════════════════════════════

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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
// EVENT ID GENERATION
// ════════════════════════════════════

/**
 * Build the official eSocial event ID.
 * Format: ID{tpInsc}{nrInsc}{yyyy}{seq}
 * Example: ID1123456780001012024000000001
 */
function buildEventId(envelope: ESocialEnvelope): string {
  const tpInsc = '1'; // CNPJ
  const nrInsc = (envelope.company_id || '').replace(/\D/g, '').padEnd(14, '0');
  const year = new Date(envelope.created_at).getFullYear();
  const seq = envelope.id.replace(/-/g, '').substring(0, 20);
  return `ID${tpInsc}${nrInsc}${year}${seq}`;
}

// ════════════════════════════════════
// STRUCTURED OUTPUT
// ════════════════════════════════════

/**
 * Structured XML output conforming to eSocial specification.
 */
export interface ESocialEventXML {
  /** Unique event identifier (ID + formatted UUID) */
  id_evento: string;
  /** Event type code (e.g. 'S-2200', 'S-1000') */
  tipo_evento: string;
  /** Full XML string conforming to eSocial XSD */
  xml_payload: string;
  /** Layout version (e.g. 'S-1.2') */
  versao_layout: LayoutVersion;
  /** Schema identifier (e.g. 'evtAdmissao') */
  schema_id: string;
  /** Size of xml_payload in bytes (UTF-8) */
  size_bytes: number;
  /** Source envelope ID */
  envelope_id: string;
  /** Timestamp of generation */
  generated_at: string;
}

/** @deprecated Use ESocialEventXML instead */
export interface XMLGenerationResult {
  xml: string;
  envelope_id: string;
  event_type: string;
  schema_id: string;
  size_bytes: number;
}

// ════════════════════════════════════
// SINGLE EVENT XML GENERATION
// ════════════════════════════════════

/**
 * Generate eSocial-compliant XML for a single envelope.
 * Returns the structured ESocialEventXML with id_evento, tipo_evento,
 * xml_payload, and versao_layout.
 */
export function generateEventXML(envelope: ESocialEnvelope): ESocialEventXML {
  const registry = EVENT_TYPE_REGISTRY[envelope.event_type];
  const schemaId = registry?.schema_id ?? 'evtGenerico';
  const eventId = buildEventId(envelope);
  const nsConfig = getNamespaceForEvent(schemaId, envelope.layout_version);

  // Build the inner event payload XML from the mapped data
  // The payload already contains the full eSocial structure from the mapper
  const innerPayload = envelope.payload as Record<string, unknown>;
  const eSocialContent = (innerPayload.eSocial as Record<string, unknown>) || innerPayload;
  const eventContent = eSocialContent[schemaId] as Record<string, unknown> || eSocialContent;

  const eventContentXml = jsonToXmlElements(eventContent, 6);

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<eSocial xmlns="${nsConfig.base}" xmlns:xsi="${nsConfig.xsi}">`,
    `  <${schemaId} Id="${eventId}">`,
    eventContentXml,
    `  </${schemaId}>`,
    `</eSocial>`,
  ].join('\n');

  const encoded = new TextEncoder().encode(xml);

  return {
    id_evento: eventId,
    tipo_evento: envelope.event_type,
    xml_payload: xml,
    versao_layout: envelope.layout_version,
    schema_id: schemaId,
    size_bytes: encoded.length,
    envelope_id: envelope.id,
    generated_at: new Date().toISOString(),
  };
}

// ════════════════════════════════════
// BATCH LOTE XML GENERATION
// ════════════════════════════════════

/**
 * Structured batch output.
 */
export interface ESocialLoteXML {
  /** Batch identifier */
  id_lote: string;
  /** Full lote XML containing all events */
  xml_lote: string;
  /** Individual event XMLs included in this batch */
  eventos: ESocialEventXML[];
  /** Total size of the lote in bytes */
  size_bytes: number;
  /** Layout version */
  versao_layout: LayoutVersion;
  /** eSocial group: 1=Empregador, 2=Tabelas, 3=Não-periódicos, 4=Periódicos, 5=SST */
  grupo: number;
  generated_at: string;
}

/**
 * Map eSocial category to official transmission group number.
 */
function categoryToGroup(category: string): number {
  const map: Record<string, number> = {
    tabelas: 2,
    nao_periodicos: 3,
    periodicos: 4,
    sst: 5,
    gfip_fgts: 4,
  };
  return map[category] || 3;
}

/**
 * Generate a batch lote XML for submission to the government.
 * Groups events by category and builds the envioLoteEventos structure.
 */
export function generateLoteXML(
  envelopes: ESocialEnvelope[],
  transmitterDocument: string,
): ESocialLoteXML {
  if (envelopes.length === 0) {
    throw new Error('Lote vazio — ao menos um evento é necessário');
  }

  const version = envelopes[0].layout_version;
  const loteNs = getLoteNamespace(version);
  const loteId = `LOTE_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const grupo = categoryToGroup(envelopes[0].category);
  const cnpjTransmissor = transmitterDocument.replace(/\D/g, '');

  // Generate individual event XMLs
  const eventXmls = envelopes.map(generateEventXML);

  // Build the eventos block with each event wrapped in <evento>
  const eventosBlock = eventXmls.map((evtXml, idx) => {
    // Extract the inner XML (without the <?xml?> declaration and outer <eSocial> tags)
    const innerXml = evtXml.xml_payload
      .replace('<?xml version="1.0" encoding="UTF-8"?>\n', '')
      .replace(/<eSocial[^>]*>\n/, '')
      .replace(/\n<\/eSocial>$/, '');

    return [
      `      <evento Id="${evtXml.id_evento}">`,
      innerXml,
      `      </evento>`,
    ].join('\n');
  }).join('\n');

  const loteXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<eSocial xmlns="${loteNs.base}" xmlns:xsi="${loteNs.xsi}">`,
    `  <envioLoteEventos grupo="${grupo}">`,
    `    <ideEmpregador>`,
    `      <tpInsc>1</tpInsc>`,
    `      <nrInsc>${escapeXml(cnpjTransmissor.substring(0, 8))}</nrInsc>`,
    `    </ideEmpregador>`,
    `    <ideTransmissor>`,
    `      <tpInsc>1</tpInsc>`,
    `      <nrInsc>${escapeXml(cnpjTransmissor.substring(0, 8))}</nrInsc>`,
    `    </ideTransmissor>`,
    `    <eventos>`,
    eventosBlock,
    `    </eventos>`,
    `  </envioLoteEventos>`,
    `</eSocial>`,
  ].join('\n');

  return {
    id_lote: loteId,
    xml_lote: loteXml,
    eventos: eventXmls,
    size_bytes: new TextEncoder().encode(loteXml).length,
    versao_layout: version,
    grupo,
    generated_at: new Date().toISOString(),
  };
}

// ════════════════════════════════════
// VALIDATION
// ════════════════════════════════════

export interface XMLValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate that generated XML meets eSocial structural requirements.
 */
export function validateXMLStructure(xml: string): XMLValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!xml.startsWith('<?xml')) {
    errors.push('Declaração XML ausente (<?xml version="1.0"?>)');
  }
  if (!xml.includes('encoding="UTF-8"')) {
    warnings.push('Encoding UTF-8 não declarado explicitamente');
  }
  if (!xml.includes('<eSocial')) {
    errors.push('Elemento raiz <eSocial> ausente');
  }
  if (!xml.includes('xmlns=')) {
    errors.push('Namespace xmlns obrigatório ausente');
  }

  // Validate ID attribute format
  const idMatch = xml.match(/Id="(ID[^"]+)"/);
  if (!idMatch) {
    errors.push('Atributo Id do evento ausente (formato: ID{tpInsc}{nrInsc}{ano}{seq})');
  } else {
    const id = idMatch[1];
    if (!id.startsWith('ID')) {
      errors.push('Id do evento deve iniciar com "ID"');
    }
    if (id.length < 20) {
      warnings.push(`Id do evento curto (${id.length} chars) — recomendado mínimo 20`);
    }
  }

  // Tag matching
  const openTags = (xml.match(/<[a-zA-Z][^/!?]*?>/g) || []).length;
  const closeTags = (xml.match(/<\/[a-zA-Z]+>/g) || []).length;
  const selfClosing = (xml.match(/<[^?!][^>]*\/>/g) || []).length;
  if (openTags !== closeTags + selfClosing) {
    errors.push(`Tags desbalanceadas: ${openTags} abertas vs ${closeTags} fechadas + ${selfClosing} auto-fechadas`);
  }

  // Size check (eSocial limit is ~500KB per event)
  const sizeBytes = new TextEncoder().encode(xml).length;
  if (sizeBytes > 500_000) {
    errors.push(`XML excede limite de 500KB (${Math.round(sizeBytes / 1024)}KB)`);
  } else if (sizeBytes > 400_000) {
    warnings.push(`XML próximo do limite de 500KB (${Math.round(sizeBytes / 1024)}KB)`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ════════════════════════════════════
// BACKWARD COMPAT (delegates to new API)
// ════════════════════════════════════

/** @deprecated Use generateEventXML instead */
export function generateXML(envelope: ESocialEnvelope): XMLGenerationResult {
  const result = generateEventXML(envelope);
  return {
    xml: result.xml_payload,
    envelope_id: result.envelope_id,
    event_type: result.tipo_evento,
    schema_id: result.schema_id,
    size_bytes: result.size_bytes,
  };
}

/** @deprecated Use generateLoteXML or map generateEventXML instead */
export function generateBatchXML(envelopes: ESocialEnvelope[]): XMLGenerationResult[] {
  return envelopes.map(generateXML);
}
