/**
 * LandingVersionHistoryPanel — Shows version history for a landing page.
 *
 * Displays:
 *  - All versions (published, superseded, draft, etc.)
 *  - Who approved each version
 *  - Publication date
 *  - Version status badge
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  getVersionStatusLabel,
  getStatusVariant,
  type LandingVersionStatus,
} from '@/domains/platform-growth/landing-page-status-machine';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, History, User, Clock, CheckCircle2, Rocket, GitBranch,
} from 'lucide-react';

interface VersionRow {
  id: string;
  version_number: number;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface AuditEntry {
  action: string;
  user_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface Props {
  landingPageId: string;
  pageName?: string;
}

export default function LandingVersionHistoryPanel({ landingPageId, pageName }: Props) {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [auditMap, setAuditMap] = useState<Record<string, AuditEntry[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // Fetch versions
      const { data: vData } = await supabase
        .from('landing_page_versions')
        .select('id, version_number, status, created_by, created_at, updated_at')
        .eq('landing_page_id', landingPageId)
        .order('version_number', { ascending: false });

      const versionRows = (vData ?? []) as VersionRow[];
      setVersions(versionRows);

      // Fetch audit logs for these versions (approvals, publishes, superseded)
      if (versionRows.length > 0) {
        const versionIds = versionRows.map(v => v.id);
        const { data: auditData } = await supabase
          .from('audit_logs')
          .select('entity_id, action, user_id, created_at, metadata')
          .eq('entity_type', 'landing_page_version')
          .in('entity_id', versionIds)
          .in('action', ['VersionStatus_approved', 'VersionStatus_published', 'VersionSuperseded', 'VersionDraftCreated'])
          .order('created_at', { ascending: true });

        const map: Record<string, AuditEntry[]> = {};
        for (const entry of (auditData ?? []) as any[]) {
          const eid = entry.entity_id as string;
          if (!map[eid]) map[eid] = [];
          map[eid].push({
            action: entry.action,
            user_id: entry.user_id,
            created_at: entry.created_at,
            metadata: entry.metadata,
          });
        }
        setAuditMap(map);
      }

      setLoading(false);
    };

    load();
  }, [landingPageId]);

  const getApprover = (versionId: string): AuditEntry | undefined => {
    return auditMap[versionId]?.find(a => a.action === 'VersionStatus_approved');
  };

  const getPublisher = (versionId: string): AuditEntry | undefined => {
    return auditMap[versionId]?.find(a => a.action === 'VersionStatus_published');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Nenhuma versão encontrada.</p>
        <p className="text-xs mt-1">Versões são criadas ao editar páginas publicadas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pageName && (
        <div className="flex items-center gap-2 pb-1">
          <GitBranch className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{pageName}</span>
          <span className="text-xs text-muted-foreground">— {versions.length} versão(ões)</span>
        </div>
      )}

      <ScrollArea className="max-h-96">
        <div className="space-y-3 pr-2">
          {versions.map((v, idx) => {
            const status = v.status as LandingVersionStatus;
            const approver = getApprover(v.id);
            const publisher = getPublisher(v.id);
            const isActive = status === 'published';

            return (
              <div key={v.id} className="flex gap-3 items-start">
                {/* Timeline indicator */}
                <div className="flex flex-col items-center gap-1 pt-1">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    isActive
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                      : status === 'superseded'
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-secondary text-secondary-foreground'
                  }`}>
                    v{v.version_number}
                  </div>
                  {idx < versions.length - 1 && (
                    <div className="w-px h-8 bg-border/60" />
                  )}
                </div>

                {/* Version info */}
                <div className={`flex-1 min-w-0 rounded-lg border p-3 ${
                  isActive ? 'border-primary/30 bg-primary/5' : 'border-border/40 bg-muted/20'
                }`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={getStatusVariant(status)} className="text-[10px]">
                      {getVersionStatusLabel(status)}
                    </Badge>
                    {isActive && (
                      <span className="text-[10px] font-medium text-primary">● Ativa</span>
                    )}
                  </div>

                  <div className="mt-2 space-y-1">
                    {/* Created by */}
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <User className="h-3 w-3 shrink-0" />
                      Criada por: {v.created_by ? v.created_by.slice(0, 8) + '…' : 'Sistema'}
                    </p>

                    {/* Created at */}
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3 w-3 shrink-0" />
                      {new Date(v.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>

                    {/* Approved by */}
                    {approver && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-primary" />
                        Aprovada por: {
                          (approver.metadata as any)?.transitioned_by_role
                            ? (approver.metadata as any).transitioned_by_role
                            : approver.user_id?.slice(0, 8) + '…'
                        }
                        <span className="text-[10px]">
                          — {new Date(approver.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </p>
                    )}

                    {/* Published at */}
                    {publisher && (
                      <p className="text-xs text-foreground font-medium flex items-center gap-1.5">
                        <Rocket className="h-3 w-3 shrink-0 text-primary" />
                        Publicada em: {new Date(publisher.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
