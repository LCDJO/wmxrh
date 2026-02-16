/**
 * IAM Users Tab — List, invite, assign roles with scope
 */
import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { identityGateway } from '@/domains/iam/identity.gateway';
import { type CustomRole, type UserCustomRole, type TenantUser } from '@/domains/iam/iam.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Mail, UserPlus, Building2, Network } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = { owner: 'Proprietário', admin: 'Admin', manager: 'Gestor', viewer: 'Visualizador' };
const STATUS_LABELS: Record<string, string> = { active: 'Ativo', invited: 'Convidado', inactive: 'Inativo' };
const SCOPE_LABELS: Record<string, string> = { tenant: 'Tenant', company_group: 'Grupo', company: 'Empresa' };

interface Props {
  members: TenantUser[];
  assignments: UserCustomRole[];
  roles: CustomRole[];
  tenantId: string;
  userId?: string;
  isTenantAdmin: boolean;
  onInvalidate: () => void;
}

export function UsersTab({ members, assignments, roles, tenantId, userId, isTenantAdmin, onInvalidate }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  // Invite form
  const [invEmail, setInvEmail] = useState('');
  const [invName, setInvName] = useState('');

  // Assign form
  const [selUser, setSelUser] = useState('');
  const [selRole, setSelRole] = useState('');
  const [selScopeType, setSelScopeType] = useState<'tenant' | 'company_group' | 'company'>('tenant');
  const [selScopeId, setSelScopeId] = useState('');

  // Scope options
  const { data: scopeData } = useQuery({
    queryKey: ['iam_scope_options', tenantId],
    queryFn: () => identityGateway.getScopeOptions({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });
  const companies = scopeData?.companies || [];
  const groups = scopeData?.companyGroups || [];

  const inviteMutation = useMutation({
    mutationFn: () => identityGateway.createTenantUser({ tenant_id: tenantId, email: invEmail, name: invName || undefined, invited_by: userId }),
    onSuccess: () => {
      toast({ title: 'Convite enviado!' });
      setInviteOpen(false);
      setInvEmail('');
      setInvName('');
      qc.invalidateQueries({ queryKey: ['iam_members'] });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const assignMutation = useMutation({
    mutationFn: () => identityGateway.assignRoleToUser({
      user_id: selUser,
      role_id: selRole,
      tenant_id: tenantId,
      scope_type: selScopeType,
      scope_id: selScopeType === 'tenant' ? null : selScopeId || null,
      assigned_by: userId,
    }),
    onSuccess: () => {
      toast({ title: 'Cargo atribuído!' });
      setAssignOpen(false);
      setSelUser('');
      setSelRole('');
      setSelScopeType('tenant');
      setSelScopeId('');
      onInvalidate();
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => identityGateway.removeRoleFromUser({ assignment_id: id }),
    onSuccess: () => { toast({ title: 'Atribuição removida!' }); onInvalidate(); },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const userAssignments = useMemo(() => {
    const map = new Map<string, UserCustomRole[]>();
    assignments.forEach(a => {
      const list = map.get(a.user_id) || [];
      list.push(a);
      map.set(a.user_id, list);
    });
    return map;
  }, [assignments]);

  const scopeOptions = selScopeType === 'company' ? companies : selScopeType === 'company_group' ? groups : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-foreground">Usuários</h2>
        {isTenantAdmin && (
          <div className="flex gap-2">
            {/* Invite Dialog */}
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5"><Mail className="h-4 w-4" />Convidar</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" />Convidar Usuário</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>E-mail *</Label>
                    <Input type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)} placeholder="usuario@empresa.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={invName} onChange={e => setInvName(e.target.value)} placeholder="Nome completo" />
                  </div>
                  <Button className="w-full" disabled={!invEmail || inviteMutation.isPending} onClick={() => inviteMutation.mutate()}>
                    {inviteMutation.isPending ? 'Enviando...' : 'Enviar Convite'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Assign Role Dialog */}
            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Atribuir Cargo</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Atribuir Cargo + Escopo</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Usuário</Label>
                    <Select value={selUser} onValueChange={setSelUser}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {members.map(m => (
                          <SelectItem key={m.user_id} value={m.user_id}>
                            {m.name || m.email || m.user_id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cargo</Label>
                    <Select value={selRole} onValueChange={setSelRole}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {roles.filter(r => r.is_active).map(r => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Escopo</Label>
                    <Select value={selScopeType} onValueChange={v => { setSelScopeType(v as any); setSelScopeId(''); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tenant">Tenant (global)</SelectItem>
                        <SelectItem value="company_group">Grupo de Empresas</SelectItem>
                        <SelectItem value="company">Empresa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {selScopeType !== 'tenant' && (
                    <div className="space-y-2">
                      <Label>{selScopeType === 'company' ? 'Empresa' : 'Grupo'}</Label>
                      <Select value={selScopeId} onValueChange={setSelScopeId}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {scopeOptions.map(o => (
                            <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button
                    className="w-full"
                    disabled={!selUser || !selRole || (selScopeType !== 'tenant' && !selScopeId) || assignMutation.isPending}
                    onClick={() => assignMutation.mutate()}
                  >
                    {assignMutation.isPending ? 'Atribuindo...' : 'Atribuir'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Membership</TableHead>
              <TableHead>Cargos + Escopo</TableHead>
              {isTenantAdmin && <TableHead className="w-[60px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map(m => {
              const userRoles = userAssignments.get(m.user_id) || [];
              return (
                <TableRow key={m.user_id}>
                  <TableCell className="font-medium">{m.name || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.email || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={m.status === 'active' ? 'default' : m.status === 'invited' ? 'outline' : 'secondary'} className="text-[10px]">
                      {STATUS_LABELS[m.status] || m.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{ROLE_LABELS[m.role] || m.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {userRoles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : userRoles.map(ur => (
                        <div key={ur.id} className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-xs gap-1">
                            {ur.custom_roles?.name || ur.role_id.slice(0, 8)}
                            <span className="text-muted-foreground">
                              {ur.scope_type === 'tenant' ? '' : ` · ${SCOPE_LABELS[ur.scope_type] || ur.scope_type}`}
                            </span>
                          </Badge>
                          {isTenantAdmin && (
                            <button onClick={() => removeMutation.mutate(ur.id)} className="text-destructive hover:text-destructive/80">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  {isTenantAdmin && <TableCell />}
                </TableRow>
              );
            })}
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum membro encontrado.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
