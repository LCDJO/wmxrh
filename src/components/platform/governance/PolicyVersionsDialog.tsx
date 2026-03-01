/**
 * PolicyVersionsDialog — View version history for a policy
 */
import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getPlatformPolicyGovernanceEngine } from '@/domains/platform-policy-governance';
import type { PolicyVersion } from '@/domains/platform-policy-governance/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyId: string;
  policyName: string;
}

export function PolicyVersionsDialog({ open, onOpenChange, policyId, policyName }: Props) {
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !policyId) return;
    setLoading(true);
    const engine = getPlatformPolicyGovernanceEngine();
    engine.getVersions(policyId).then(setVersions).finally(() => setLoading(false));
  }, [open, policyId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Histórico de Versões — {policyName}</DialogTitle>
          <DialogDescription>Versões imutáveis publicadas para esta política.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[50vh]">
          {loading && <p className="text-sm text-muted-foreground p-4">Carregando...</p>}
          {!loading && versions.length === 0 && (
            <p className="text-sm text-muted-foreground p-4">Nenhuma versão publicada.</p>
          )}
          <div className="space-y-3">
            {versions.map(v => (
              <div key={v.id} className="border border-border rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-foreground">v{v.version_number} — {v.title}</span>
                  <div className="flex gap-1.5">
                    {v.is_current && <Badge className="bg-primary/15 text-primary text-[10px]">Atual</Badge>}
                    {v.requires_reacceptance && <Badge variant="destructive" className="text-[10px]">Re-aceite</Badge>}
                  </div>
                </div>
                {v.change_summary && <p className="text-xs text-muted-foreground">{v.change_summary}</p>}
                <p className="text-[10px] text-muted-foreground">
                  Publicado: {v.published_at ? new Date(v.published_at).toLocaleDateString('pt-BR') : '—'}
                  {' · '}Hash: {v.content_hash ?? '—'}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
