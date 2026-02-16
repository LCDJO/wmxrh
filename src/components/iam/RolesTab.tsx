/**
 * IAM Roles Tab — Create, edit permissions (matrix), clone roles.
 * Integrates RoleSuggestionPanel for AI-powered permission hints on create.
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { identityGateway } from '@/domains/iam/identity.gateway';
import { type CustomRole, type PermissionDefinition } from '@/domains/iam/iam.service';
import { PermissionMatrix } from '@/components/iam/PermissionMatrix';
import { RoleSuggestionPanel } from '@/components/iam/RoleSuggestionPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Shield, Key, Trash2, Lock, Copy } from 'lucide-react';

interface Props {
  roles: CustomRole[];
  permissions: PermissionDefinition[];
  tenantId: string;
  userId?: string;
  isTenantAdmin: boolean;
  onInvalidate: () => void;
  securityContext?: import('@/domains/security/kernel/identity.service').SecurityContext | null;
}

export function RolesTab({ roles, permissions, tenantId, userId, isTenantAdmin, onInvalidate, securityContext }: Props) {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [cloneOpen, setCloneOpen] = useState<CustomRole | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cloneName, setCloneName] = useState('');
  const [suggestedCodes, setSuggestedCodes] = useState<string[]>([]);

  const createRoleMut = useMutation({
    mutationFn: (dto: { tenant_id: string; name: string; description?: string; created_by?: string }) =>
      identityGateway.createRole({ ...dto, is_tenant_admin: isTenantAdmin, ctx: securityContext }),
    onSuccess: () => {
      toast({ title: 'Cargo criado!' });
      setCreateOpen(false); setName(''); setDescription(''); setSuggestedCodes([]);
      onInvalidate();
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const cloneRoleMut = useMutation({
    mutationFn: ({ sourceId, newName }: { sourceId: string; newName: string }) =>
      identityGateway.cloneRole({ source_role_id: sourceId, tenant_id: tenantId, new_name: newName, created_by: userId, is_tenant_admin: isTenantAdmin, ctx: securityContext }),
    onSuccess: () => {
      toast({ title: 'Cargo clonado com sucesso!' });
      setCloneOpen(null);
      setCloneName('');
      onInvalidate();
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const deleteRoleMut = useMutation({
    mutationFn: (id: string) => identityGateway.deleteRole({ role_id: id, tenant_id: tenantId, is_tenant_admin: isTenantAdmin, ctx: securityContext }),
    onSuccess: () => { toast({ title: 'Cargo removido!' }); onInvalidate(); },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const handleCreate = () => {
    createRoleMut.mutate({ tenant_id: tenantId, name, description: description || undefined, created_by: userId });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Cargos</h2>
        {isTenantAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Novo Cargo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Criar Cargo</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Analista RH" />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição do cargo" />
                </div>

                {/* AI Suggestion Panel */}
                <RoleSuggestionPanel
                  roleName={name}
                  onApplySuggestions={(codes) => setSuggestedCodes(prev => [...new Set([...prev, ...codes])])}
                />

                {suggestedCodes.length > 0 && (
                  <div className="rounded-md bg-muted/50 p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Permissões pré-selecionadas ({suggestedCodes.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {suggestedCodes.map(c => (
                        <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                          {c}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      Serão aplicadas após criar o cargo.
                    </p>
                  </div>
                )}

                <Button className="w-full" disabled={!name || createRoleMut.isPending} onClick={handleCreate}>
                  {createRoleMut.isPending ? 'Criando...' : 'Criar Cargo'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map(role => (
          <Card key={role.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {role.is_system ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Shield className="h-4 w-4 text-primary" />}
                  <CardTitle className="text-base">{role.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  {role.is_system && <Badge variant="secondary" className="text-[10px]">Sistema</Badge>}
                  {!role.is_active && <Badge variant="destructive" className="text-[10px]">Inativo</Badge>}
                </div>
              </div>
              {role.description && <CardDescription className="text-xs">{role.description}</CardDescription>}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setEditingRole(role)}>
                  <Key className="h-3 w-3" />Permissões
                </Button>
                {isTenantAdmin && (
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => { setCloneOpen(role); setCloneName(`${role.name} (cópia)`); }}>
                    <Copy className="h-3 w-3" />Clonar
                  </Button>
                )}
                {isTenantAdmin && !role.is_system && (
                  <Button variant="ghost" size="sm" className="gap-1 text-xs text-destructive" onClick={() => deleteRoleMut.mutate(role.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Permission Matrix */}
      {editingRole && (
        <PermissionMatrix
          role={editingRole}
          permissions={permissions}
          userId={userId}
          isTenantAdmin={isTenantAdmin}
          onClose={() => setEditingRole(null)}
          onSaved={onInvalidate}
          securityContext={securityContext}
        />
      )}

      {/* Clone Dialog */}
      {cloneOpen && (
        <Dialog open onOpenChange={() => setCloneOpen(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Copy className="h-5 w-5 text-primary" />Clonar Cargo: {cloneOpen.name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do novo cargo *</Label>
                <Input value={cloneName} onChange={e => setCloneName(e.target.value)} placeholder="Nome do cargo clonado" />
              </div>
              <p className="text-xs text-muted-foreground">Todas as permissões serão copiadas para o novo cargo.</p>
              <Button className="w-full" disabled={!cloneName || cloneRoleMut.isPending} onClick={() => cloneRoleMut.mutate({ sourceId: cloneOpen.id, newName: cloneName })}>
                {cloneRoleMut.isPending ? 'Clonando...' : 'Clonar Cargo'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
