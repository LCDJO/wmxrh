/**
 * ScimClientsTab — CRUD for SCIM clients (IdP integrations).
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Copy, Key, Trash2 } from 'lucide-react';

export function ScimClientsTab() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [direction, setDirection] = useState('inbound');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const { data: clients, isLoading } = useQuery({
    queryKey: ['scim_clients', currentTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scim_clients')
        .select('*')
        .eq('tenant_id', currentTenant!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      // Generate a bearer token
      const token = crypto.randomUUID() + '-' + crypto.randomUUID();
      // Hash it
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { error } = await supabase.from('scim_clients').insert({
        tenant_id: currentTenant!.id,
        name,
        description: description || null,
        bearer_token_hash: tokenHash,
        sync_direction: direction,
      });
      if (error) throw error;
      return token;
    },
    onSuccess: (token) => {
      setGeneratedToken(token);
      queryClient.invalidateQueries({ queryKey: ['scim_clients'] });
      toast.success('Cliente SCIM criado');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('scim_clients')
        .update({ is_active: active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scim_clients'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('scim_clients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scim_clients'] });
      toast.success('Cliente removido');
    },
  });

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error('Nome obrigatório');
      return;
    }
    createMutation.mutate();
  };

  const copyToken = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
      toast.success('Token copiado');
    }
  };

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scim-provisioning`;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Registre clientes SCIM para provisionamento automático de usuários.
        </p>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setGeneratedToken(null); setName(''); setDescription(''); } }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Cliente SCIM</DialogTitle>
            </DialogHeader>
            {generatedToken ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Token gerado com sucesso. <strong>Copie agora</strong> — ele não será exibido novamente.
                </p>
                <div className="flex items-center gap-2">
                  <Input readOnly value={generatedToken} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={copyToken}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Base URL do endpoint SCIM:</Label>
                  <Input readOnly value={baseUrl} className="font-mono text-xs" />
                </div>
                <Button className="w-full" onClick={() => { setOpen(false); setGeneratedToken(null); setName(''); }}>
                  Fechar
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  <Input placeholder="Azure AD SCIM" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input placeholder="Opcional" value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div>
                  <Label>Direção de Sync</Label>
                  <Select value={direction} onValueChange={setDirection}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbound">Inbound (IdP → App)</SelectItem>
                      <SelectItem value="outbound">Outbound (App → IdP)</SelectItem>
                      <SelectItem value="bidirectional">Bidirecional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={createMutation.isPending}>
                  <Key className="h-4 w-4 mr-1" /> Gerar Token e Criar
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      <div className="grid gap-3">
        {clients?.map(c => (
          <Card key={c.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{c.name}</span>
                  <Badge variant={c.is_active ? 'default' : 'secondary'}>
                    {c.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{c.sync_direction}</Badge>
                </div>
                {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                <p className="text-[10px] text-muted-foreground">
                  Último sync: {c.last_sync_at ? new Date(c.last_sync_at).toLocaleString('pt-BR') : 'Nunca'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={c.is_active}
                  onCheckedChange={(active) => toggleMutation.mutate({ id: c.id, active })}
                />
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(c.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {clients?.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Nenhum cliente SCIM configurado.</p>
        )}
      </div>
    </div>
  );
}
