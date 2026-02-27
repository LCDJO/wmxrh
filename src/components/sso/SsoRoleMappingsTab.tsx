/**
 * SsoRoleMappingsTab — Maps external IdP groups/claims to internal tenant roles.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowRight, KeyRound } from 'lucide-react';

const INTERNAL_ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'tenant_admin', label: 'Tenant Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'hr', label: 'RH' },
  { value: 'operator', label: 'Operador' },
  { value: 'viewer', label: 'Visualizador' },
];

export function SsoRoleMappingsTab() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: idps = [] } = useQuery({
    queryKey: ['sso-idps', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data } = await supabase
        .from('identity_provider_configs')
        .select('id, name, protocol')
        .eq('tenant_id', currentTenant.id);
      return data ?? [];
    },
    enabled: !!currentTenant?.id,
  });

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ['sso-role-mappings', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('federation_role_mappings')
        .select('*, identity_provider_configs(name)')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentTenant?.id,
  });

  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('federation_role_mappings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-role-mappings'] });
      toast.success('Mapeamento removido');
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Mapeamentos de Roles</h3>
          <p className="text-sm text-muted-foreground">Associe grupos do IdP a roles internos do sistema.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={idps.length === 0}>
              <Plus className="h-4 w-4" /> Novo Mapeamento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Mapeamento de Role</DialogTitle>
            </DialogHeader>
            <MappingForm
              tenantId={currentTenant?.id ?? ''}
              idps={idps}
              onSaved={() => {
                setDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ['sso-role-mappings'] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Carregando...</CardContent></Card>
      ) : mappings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <KeyRound className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">
              {idps.length === 0 ? 'Configure um provedor de identidade primeiro.' : 'Nenhum mapeamento configurado.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provedor</TableHead>
                <TableHead>Grupo/Claim Externo</TableHead>
                <TableHead></TableHead>
                <TableHead>Role Interno</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{(m as any).identity_provider_configs?.name ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">{m.external_group ?? m.external_role ?? '—'}</Badge>
                  </TableCell>
                  <TableCell><ArrowRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                  <TableCell>
                    <Badge>{m.internal_role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => deleteMapping.mutate(m.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function MappingForm({ tenantId, idps, onSaved }: { tenantId: string; idps: any[]; onSaved: () => void }) {
  const [idpId, setIdpId] = useState('');
  const [externalGroup, setExternalGroup] = useState('');
  const [internalRole, setInternalRole] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!idpId || !externalGroup.trim() || !internalRole) {
      toast.error('Preencha todos os campos');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('federation_role_mappings').insert({
        tenant_id: tenantId,
        idp_config_id: idpId,
        external_group: externalGroup.trim(),
        internal_role: internalRole,
      } as any);
      if (error) throw error;
      toast.success('Mapeamento criado');
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Provedor de Identidade</Label>
        <Select value={idpId} onValueChange={setIdpId}>
          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {idps.map((idp: any) => (
              <SelectItem key={idp.id} value={idp.id}>{idp.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Grupo/Claim Externo</Label>
        <Input value={externalGroup} onChange={e => setExternalGroup(e.target.value)} placeholder="Ex: Admins, HR-Team, engineering..." />
      </div>
      <div className="space-y-2">
        <Label>Role Interno</Label>
        <Select value={internalRole} onValueChange={setInternalRole}>
          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {INTERNAL_ROLES.map(r => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onSaved}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Criar'}</Button>
      </div>
    </div>
  );
}
