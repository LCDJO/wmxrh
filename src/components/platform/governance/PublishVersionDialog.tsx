/**
 * PublishVersionDialog — Publish a new version for a policy
 */
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { getPlatformPolicyGovernanceEngine } from '@/domains/platform-policy-governance';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyId: string;
  policyName: string;
  onPublished: () => void;
}

export function PublishVersionDialog({ open, onOpenChange, policyId, policyName, onPublished }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [changeSummary, setChangeSummary] = useState('');
  const [requiresReacceptance, setRequiresReacceptance] = useState(false);

  const handlePublish = async () => {
    if (!title.trim() || !contentHtml.trim()) {
      toast({ title: 'Título e conteúdo são obrigatórios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const engine = getPlatformPolicyGovernanceEngine();
      await engine.publishVersion({
        policy_id: policyId,
        title,
        content_html: contentHtml,
        change_summary: changeSummary || undefined,
        requires_reacceptance: requiresReacceptance,
      });
      toast({ title: 'Versão publicada com sucesso' });
      onPublished();
      onOpenChange(false);
      setTitle(''); setContentHtml(''); setChangeSummary(''); setRequiresReacceptance(false);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publicar Versão — {policyName}</DialogTitle>
          <DialogDescription>
            Crie uma nova versão imutável para esta política.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título da Versão</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="ex: v2 — Atualização LGPD" />
          </div>

          <div className="space-y-1.5">
            <Label>Conteúdo HTML</Label>
            <Textarea value={contentHtml} onChange={e => setContentHtml(e.target.value)} rows={8} placeholder="<h2>Termos...</h2>" className="font-mono text-xs" />
          </div>

          <div className="space-y-1.5">
            <Label>Resumo das Alterações</Label>
            <Textarea value={changeSummary} onChange={e => setChangeSummary(e.target.value)} rows={2} placeholder="O que mudou nesta versão?" />
          </div>

          <div className="flex items-center justify-between">
            <Label>Exigir re-aceite dos tenants</Label>
            <Switch checked={requiresReacceptance} onCheckedChange={setRequiresReacceptance} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handlePublish} disabled={saving}>{saving ? 'Publicando...' : 'Publicar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
