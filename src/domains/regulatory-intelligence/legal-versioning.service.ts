/**
 * Legal Document Versioning Manager
 *
 * Manages immutable legal document versions in the database.
 * Never overwrites — always appends new versions.
 * The DB trigger automatically marks previous versions as not current.
 */

import { supabase } from '@/integrations/supabase/client';
import { generateContentHash } from './legal-crawler.service';

// ── Types ──

export type LegalDocumentTipo =
  | 'lei' | 'decreto' | 'portaria' | 'instrucao_normativa'
  | 'nr' | 'clt' | 'convencao' | 'acordo_coletivo'
  | 'resolucao' | 'medida_provisoria' | 'outro';

export interface LegalDocumentRecord {
  id: string;
  tenant_id: string;
  tipo: LegalDocumentTipo;
  codigo: string;
  versao: number;
  titulo: string;
  ementa: string | null;
  conteudo_texto: string | null;
  data_publicacao: string;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  hash_conteudo: string;
  fonte: string | null;
  url_original: string | null;
  is_current: boolean;
  substituida_por: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateLegalDocumentDTO {
  tipo: LegalDocumentTipo;
  codigo: string;
  titulo: string;
  ementa?: string;
  conteudo_texto?: string;
  data_publicacao: string;
  vigencia_inicio: string;
  vigencia_fim?: string;
  fonte?: string;
  url_original?: string;
  metadata?: Record<string, unknown>;
}

export interface VersionComparisonResult {
  codigo: string;
  previous_version: number | null;
  current_version: number;
  hash_changed: boolean;
  previous_hash: string | null;
  current_hash: string;
}

// ── Service ──

export const legalVersioningService = {

  /**
   * Get the current (latest) version of a document by code.
   */
  async getCurrent(tenantId: string, codigo: string): Promise<LegalDocumentRecord | null> {
    const { data, error } = await supabase
      .from('legal_documents')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('codigo', codigo)
      .eq('is_current', true)
      .maybeSingle();
    if (error) throw error;
    return data as LegalDocumentRecord | null;
  },

  /**
   * List all versions of a document (newest first).
   */
  async listVersions(tenantId: string, codigo: string): Promise<LegalDocumentRecord[]> {
    const { data, error } = await supabase
      .from('legal_documents')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('codigo', codigo)
      .order('versao', { ascending: false });
    if (error) throw error;
    return (data ?? []) as LegalDocumentRecord[];
  },

  /**
   * List all current documents for a tenant.
   */
  async listCurrentDocuments(tenantId: string, tipo?: LegalDocumentTipo): Promise<LegalDocumentRecord[]> {
    let q = supabase
      .from('legal_documents')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_current', true)
      .order('codigo');
    if (tipo) q = q.eq('tipo', tipo);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as LegalDocumentRecord[];
  },

  /**
   * Publish a new version of a legal document.
   * Automatically computes hash and increments version.
   * DB trigger marks previous versions as not current.
   */
  async publishVersion(
    tenantId: string,
    dto: CreateLegalDocumentDTO
  ): Promise<VersionComparisonResult & { record: LegalDocumentRecord }> {
    // Get current version (if any)
    const current = await this.getCurrent(tenantId, dto.codigo);
    const nextVersion = current ? current.versao + 1 : 1;
    const contentForHash = dto.conteudo_texto ?? dto.titulo;
    const hash = generateContentHash(contentForHash);

    const result: VersionComparisonResult = {
      codigo: dto.codigo,
      previous_version: current?.versao ?? null,
      current_version: nextVersion,
      hash_changed: current ? current.hash_conteudo !== hash : true,
      previous_hash: current?.hash_conteudo ?? null,
      current_hash: hash,
    };

    // Skip if content hasn't changed
    if (!result.hash_changed && current) {
      return { ...result, record: current };
    }

    const { data, error } = await supabase
      .from('legal_documents')
      .insert({
        tenant_id: tenantId,
        tipo: dto.tipo,
        codigo: dto.codigo,
        versao: nextVersion,
        titulo: dto.titulo,
        ementa: dto.ementa ?? null,
        conteudo_texto: dto.conteudo_texto ?? null,
        data_publicacao: dto.data_publicacao,
        vigencia_inicio: dto.vigencia_inicio,
        vigencia_fim: dto.vigencia_fim ?? null,
        hash_conteudo: hash,
        fonte: dto.fonte ?? null,
        url_original: dto.url_original ?? null,
        is_current: true,
        metadata: dto.metadata ?? {},
      } as any)
      .select()
      .single();

    if (error) throw error;
    return { ...result, record: data as LegalDocumentRecord };
  },

  /**
   * Get a specific version of a document.
   */
  async getVersion(tenantId: string, codigo: string, versao: number): Promise<LegalDocumentRecord | null> {
    const { data, error } = await supabase
      .from('legal_documents')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('codigo', codigo)
      .eq('versao', versao)
      .maybeSingle();
    if (error) throw error;
    return data as LegalDocumentRecord | null;
  },

  /**
   * Compare two versions of the same document.
   */
  async compareVersions(
    tenantId: string,
    codigo: string,
    versionA: number,
    versionB: number
  ): Promise<{
    a: LegalDocumentRecord;
    b: LegalDocumentRecord;
    hash_changed: boolean;
    vigencia_changed: boolean;
  } | null> {
    const [a, b] = await Promise.all([
      this.getVersion(tenantId, codigo, versionA),
      this.getVersion(tenantId, codigo, versionB),
    ]);
    if (!a || !b) return null;
    return {
      a, b,
      hash_changed: a.hash_conteudo !== b.hash_conteudo,
      vigencia_changed: a.vigencia_inicio !== b.vigencia_inicio || a.vigencia_fim !== b.vigencia_fim,
    };
  },

  /**
   * Search documents by keyword in titulo or ementa.
   */
  async search(tenantId: string, keyword: string): Promise<LegalDocumentRecord[]> {
    const { data, error } = await supabase
      .from('legal_documents')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_current', true)
      .or(`titulo.ilike.%${keyword}%,ementa.ilike.%${keyword}%,codigo.ilike.%${keyword}%`)
      .order('codigo')
      .limit(50);
    if (error) throw error;
    return (data ?? []) as LegalDocumentRecord[];
  },
};
