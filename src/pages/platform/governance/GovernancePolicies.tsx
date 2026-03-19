/**
 * /platform/governance/policies — Policy Registry Management
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FileText, Shield, Globe, ShoppingBag, Code, Plus, MoreVertical, Pencil, Trash2, History, Upload } from 'lucide-react';
import { getPlatformPolicyGovernanceEngine } from '@/domains/platform-policy-governance';
import type { PlatformPolicy, PolicyScope } from '@/domains/platform-policy-governance/types';
import { useToast } from '@/hooks/core/use-toast';
import { PolicyFormDialog } from '@/components/platform/governance/PolicyFormDialog';
import { PublishVersionDialog } from '@/components/platform/governance/PublishVersionDialog';
import { PolicyVersionsDialog } from '@/components/platform/governance/PolicyVersionsDialog';

const scopeConfig: Record<PolicyScope, { label: string; icon: typeof Globe; color: string }> = {
  global: { label: 'Global (SaaS)', icon: Globe, color: 'bg-primary/10 text-primary' },
  marketplace: { label: 'Marketplace', icon: ShoppingBag, color: 'bg-accent/10 text-accent-foreground' },
  api: { label: 'API Usage', icon: Code, color: 'bg-muted text-muted-foreground' },
  billing: { label: 'Billing', icon: FileText, color: 'bg-destructive/10 text-destructive' },
  custom: { label: 'Custom', icon: Shield, color: 'bg-secondary text-secondary-foreground' },
};

export default function GovernancePolicies() {
  const [policies, setPolicies] = useState<PlatformPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState<PlatformPolicy | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlatformPolicy | null>(null);
  const [versionTarget, setVersionTarget] = useState<PlatformPolicy | null>(null);
  const [publishTarget, setPublishTarget] = useState<PlatformPolicy | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const engine = getPlatformPolicyGovernanceEngine();
    engine.listPolicies().then(setPolicies).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const engine = getPlatformPolicyGovernanceEngine();
      await engine.deletePolicy(deleteTarget.id);
      toast({ title: 'Política desativada com sucesso' });
      load();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const openEdit = (p: PlatformPolicy) => { setEditPolicy(p); setFormOpen(true); };
  const openCreate = () => { setEditPolicy(null); setFormOpen(true); };

  const byScope = (scope: PolicyScope) => policies.filter(p => p.scope === scope);

  const renderCard = (policy: PlatformPolicy) => {
    const sc = scopeConfig[policy.scope] ?? scopeConfig.custom;
    const ScopeIcon = sc.icon;
    return (
      <Card key={policy.id} className="border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium text-foreground">{policy.name}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={sc.color}>
                <ScopeIcon className="mr-1 h-3 w-3" />
                {sc.label}
              </Badge>
              {policy.is_mandatory && <Badge variant="destructive">Obrigatória</Badge>}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(policy)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPublishTarget(policy)}>
                    <Upload className="mr-2 h-3.5 w-3.5" /> Publicar Versão
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setVersionTarget(policy)}>
                    <History className="mr-2 h-3.5 w-3.5" /> Histórico de Versões
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDeleteTarget(policy)} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Desativar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <CardDescription>{policy.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Slug: {policy.slug}</span>
          <span>Categoria: {policy.category}</span>
          <span>Aplica-se a: {policy.applies_to}</span>
          <span>Grace: {policy.grace_period_days}d</span>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Políticas da Plataforma</h1>
          <p className="text-sm text-muted-foreground">Gerencie termos, privacidade e políticas de uso por escopo.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Política
        </Button>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Todas ({policies.length})</TabsTrigger>
          <TabsTrigger value="global">Global ({byScope('global').length})</TabsTrigger>
          <TabsTrigger value="marketplace">Marketplace ({byScope('marketplace').length})</TabsTrigger>
          <TabsTrigger value="api">API ({byScope('api').length})</TabsTrigger>
        </TabsList>

        {['all', 'global', 'marketplace', 'api'].map(tab => (
          <TabsContent key={tab} value={tab}>
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="grid gap-4">
                {(tab === 'all' ? policies : byScope(tab as PolicyScope)).map(renderCard)}
                {loading && <p className="text-sm text-muted-foreground p-4">Carregando...</p>}
                {!loading && policies.length === 0 && (
                  <p className="text-sm text-muted-foreground p-4">Nenhuma política cadastrada.</p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>

      {/* Create / Edit Dialog */}
      <PolicyFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        policy={editPolicy}
        onSaved={load}
      />

      {/* Publish Version Dialog */}
      {publishTarget && (
        <PublishVersionDialog
          open={!!publishTarget}
          onOpenChange={o => !o && setPublishTarget(null)}
          policyId={publishTarget.id}
          policyName={publishTarget.name}
          onPublished={load}
        />
      )}

      {/* Version History Dialog */}
      {versionTarget && (
        <PolicyVersionsDialog
          open={!!versionTarget}
          onOpenChange={o => !o && setVersionTarget(null)}
          policyId={versionTarget.id}
          policyName={versionTarget.name}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar política?</AlertDialogTitle>
            <AlertDialogDescription>
              A política "{deleteTarget?.name}" será desativada (soft delete). Versões e aceites históricos serão mantidos para auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
