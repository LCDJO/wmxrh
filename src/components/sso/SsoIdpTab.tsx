/**
 * SsoIdpTab — Identity Provider CRUD for the tenant.
 * Lists, creates, edits and toggles IdP configs from `identity_provider_configs`.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Shield, Edit2, Power, Trash2, ExternalLink, Copy, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface IdpConfig {
  id: string;
  name: string;
  protocol: 'saml' | 'oidc' | 'oauth2';
  entity_id: string | null;
  metadata_url: string | null;
  sso_url: string | null;
  slo_url: string | null;
  certificate: string | null;
  client_id: string | null;
  client_secret_encrypted: string | null;
  discovery_url: string | null;
  token_endpoint: string | null;
  authorization_endpoint: string | null;
  userinfo_endpoint: string | null;
  jwks_uri: string | null;
  scopes: string[];
  attribute_mapping: Record<string, string>;
  status: 'draft' | 'active' | 'suspended' | 'archived';
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  active: { label: 'Ativo', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
  draft: { label: 'Rascunho', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  suspended: { label: 'Suspenso', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
  archived: { label: 'Arquivado', variant: 'outline', icon: <XCircle className="h-3 w-3" /> },
};

const protocolLabels: Record<string, string> = {
  saml: 'SAML 2.0',
  oidc: 'OpenID Connect',
  oauth2: 'OAuth 2.0',
};

export function SsoIdpTab() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIdp, setEditingIdp] = useState<IdpConfig | null>(null);

  const { data: idps = [], isLoading } = useQuery({
    queryKey: ['sso-idps', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('identity_provider_configs')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as IdpConfig[];
    },
    enabled: !!currentTenant?.id,
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
      const { error } = await supabase
        .from('identity_provider_configs')
        .update({ status: newStatus, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-idps'] });
      toast.success('Status atualizado');
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  const deleteIdp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('identity_provider_configs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-idps'] });
      toast.success('Provedor removido');
    },
    onError: () => toast.error('Erro ao remover provedor'),
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência');
  };

  const openEdit = (idp: IdpConfig) => {
    setEditingIdp(idp);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingIdp(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Provedores de Identidade</h3>
          <p className="text-sm text-muted-foreground">Gerencie SAML, OIDC e OAuth2 para SSO.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Provedor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingIdp ? 'Editar Provedor' : 'Novo Provedor de Identidade'}</DialogTitle>
            </DialogHeader>
            <IdpForm
              tenantId={currentTenant?.id ?? ''}
              initial={editingIdp}
              onSaved={() => {
                setDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ['sso-idps'] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Carregando...</CardContent></Card>
      ) : idps.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">Nenhum provedor configurado.</p>
            <Button variant="outline" onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Configurar primeiro provedor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {idps.map((idp) => {
            const st = statusConfig[idp.status] ?? statusConfig.draft;
            return (
              <Card key={idp.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">{idp.name}</CardTitle>
                      <Badge variant="outline">{protocolLabels[idp.protocol]}</Badge>
                      <Badge variant={st.variant} className="gap-1">{st.icon} {st.label}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(idp)} title="Editar">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleStatus.mutate({ id: idp.id, currentStatus: idp.status })}
                        title={idp.status === 'active' ? 'Suspender' : 'Ativar'}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm('Remover este provedor de identidade?')) deleteIdp.mutate(idp.id);
                        }}
                        title="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="text-xs mt-1">
                    {idp.protocol === 'saml' && idp.entity_id && (
                      <span className="flex items-center gap-1">
                        Entity ID: <code className="bg-muted px-1 rounded text-xs">{idp.entity_id}</code>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(idp.entity_id!)}><Copy className="h-3 w-3" /></Button>
                      </span>
                    )}
                    {idp.protocol === 'oidc' && idp.discovery_url && (
                      <span className="flex items-center gap-1">
                        Discovery: <code className="bg-muted px-1 rounded text-xs truncate max-w-xs">{idp.discovery_url}</code>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => window.open(idp.discovery_url!, '_blank')}><ExternalLink className="h-3 w-3" /></Button>
                      </span>
                    )}
                    {idp.protocol === 'oauth2' && idp.client_id && (
                      <span>Client ID: <code className="bg-muted px-1 rounded text-xs">{idp.client_id}</code></span>
                    )}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── IdP Create/Edit Form ──

interface IdpFormProps {
  tenantId: string;
  initial: IdpConfig | null;
  onSaved: () => void;
}

function IdpForm({ tenantId, initial, onSaved }: IdpFormProps) {
  const [protocol, setProtocol] = useState<string>(initial?.protocol ?? 'saml');
  const [name, setName] = useState(initial?.name ?? '');
  const [entityId, setEntityId] = useState(initial?.entity_id ?? '');
  const [ssoUrl, setSsoUrl] = useState(initial?.sso_url ?? '');
  const [sloUrl, setSloUrl] = useState(initial?.slo_url ?? '');
  const [certificate, setCertificate] = useState(initial?.certificate ?? '');
  const [metadataUrl, setMetadataUrl] = useState(initial?.metadata_url ?? '');
  const [discoveryUrl, setDiscoveryUrl] = useState(initial?.discovery_url ?? '');
  const [clientId, setClientId] = useState(initial?.client_id ?? '');
  const [clientSecret, setClientSecret] = useState('');
  const [scopes, setScopes] = useState(initial?.scopes?.join(', ') ?? 'openid, profile, email');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        tenant_id: tenantId,
        name: name.trim(),
        protocol,
        entity_id: entityId || null,
        sso_url: ssoUrl || null,
        slo_url: sloUrl || null,
        certificate: certificate || null,
        metadata_url: metadataUrl || null,
        discovery_url: discoveryUrl || null,
        client_id: clientId || null,
        client_secret_encrypted: clientSecret || initial?.client_secret_encrypted || null,
        scopes: scopes.split(',').map(s => s.trim()).filter(Boolean),
        status: initial?.status ?? 'draft',
        updated_at: new Date().toISOString(),
      };

      if (initial) {
        const { error } = await supabase
          .from('identity_provider_configs')
          .update(payload as any)
          .eq('id', initial.id);
        if (error) throw error;
        toast.success('Provedor atualizado');
      } else {
        const { error } = await supabase
          .from('identity_provider_configs')
          .insert(payload as any);
        if (error) throw error;
        toast.success('Provedor criado');
      }

      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Azure AD, Okta..." />
        </div>
        <div className="space-y-2">
          <Label>Protocolo</Label>
          <Select value={protocol} onValueChange={setProtocol} disabled={!!initial}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="saml">SAML 2.0</SelectItem>
              <SelectItem value="oidc">OpenID Connect</SelectItem>
              <SelectItem value="oauth2">OAuth 2.0</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {protocol === 'saml' && (
        <>
          <div className="space-y-2">
            <Label>Entity ID</Label>
            <Input value={entityId} onChange={e => setEntityId(e.target.value)} placeholder="https://idp.example.com/entity" />
          </div>
          <div className="space-y-2">
            <Label>SSO URL</Label>
            <Input value={ssoUrl} onChange={e => setSsoUrl(e.target.value)} placeholder="https://idp.example.com/sso" />
          </div>
          <div className="space-y-2">
            <Label>SLO URL (opcional)</Label>
            <Input value={sloUrl} onChange={e => setSloUrl(e.target.value)} placeholder="https://idp.example.com/slo" />
          </div>
          <div className="space-y-2">
            <Label>Metadata URL (opcional)</Label>
            <Input value={metadataUrl} onChange={e => setMetadataUrl(e.target.value)} placeholder="https://idp.example.com/metadata" />
          </div>
          <div className="space-y-2">
            <Label>Certificado X.509</Label>
            <Textarea value={certificate} onChange={e => setCertificate(e.target.value)} placeholder="Cole o certificado PEM aqui..." rows={4} className="font-mono text-xs" />
          </div>
        </>
      )}

      {(protocol === 'oidc' || protocol === 'oauth2') && (
        <>
          {protocol === 'oidc' && (
            <div className="space-y-2">
              <Label>Discovery URL</Label>
              <Input value={discoveryUrl} onChange={e => setDiscoveryUrl(e.target.value)} placeholder="https://idp.example.com/.well-known/openid-configuration" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input value={clientId} onChange={e => setClientId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Client Secret</Label>
              <Input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder={initial ? '••••••••' : ''} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Scopes</Label>
            <Input value={scopes} onChange={e => setScopes(e.target.value)} placeholder="openid, profile, email" />
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onSaved}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : initial ? 'Salvar Alterações' : 'Criar Provedor'}
        </Button>
      </div>
    </div>
  );
}
