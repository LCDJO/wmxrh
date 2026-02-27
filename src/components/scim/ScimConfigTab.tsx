/**
 * ScimConfigTab — Tenant-level SCIM enable/disable + attribute & role mapping config.
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Save, Plus, Trash2 } from 'lucide-react';

interface RoleMappingRule {
  scim_group: string;
  internal_role: string;
}

const INTERNAL_ROLES = ['owner', 'admin', 'hr', 'manager', 'analyst', 'viewer'];

const DEFAULT_ATTR_MAP: Record<string, string> = {
  'userName': 'email',
  'displayName': 'display_name',
  'name.givenName': 'first_name',
  'name.familyName': 'last_name',
  'emails[0].value': 'email',
  'active': 'active',
  'externalId': 'external_id',
};

export function ScimConfigTab() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['scim_config', currentTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scim_configs')
        .select('*')
        .eq('tenant_id', currentTenant!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
  });

  const [isEnabled, setIsEnabled] = useState(false);
  const [autoCreate, setAutoCreate] = useState(true);
  const [autoDeactivate, setAutoDeactivate] = useState(true);
  const [syncGroups, setSyncGroups] = useState(true);
  const [defaultRole, setDefaultRole] = useState('viewer');
  const [attrMap, setAttrMap] = useState<Record<string, string>>(DEFAULT_ATTR_MAP);
  const [roleRules, setRoleRules] = useState<RoleMappingRule[]>([]);

  useEffect(() => {
    if (config) {
      setIsEnabled(config.is_enabled);
      setAutoCreate(config.auto_create_users);
      setAutoDeactivate(config.auto_deactivate_users);
      setSyncGroups(config.sync_groups_to_roles);
      setDefaultRole(config.default_role);
      setAttrMap(
        typeof config.default_attribute_mapping === 'object' && config.default_attribute_mapping
          ? (config.default_attribute_mapping as Record<string, string>)
          : DEFAULT_ATTR_MAP
      );
      setRoleRules(
        Array.isArray(config.role_mapping_rules)
          ? (config.role_mapping_rules as unknown as RoleMappingRule[])
          : []
      );
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: currentTenant!.id,
        is_enabled: isEnabled,
        auto_create_users: autoCreate,
        auto_deactivate_users: autoDeactivate,
        sync_groups_to_roles: syncGroups,
        default_role: defaultRole,
        default_attribute_mapping: attrMap as any,
        role_mapping_rules: roleRules as any,
      };

      if (config?.id) {
        const { error } = await supabase
          .from('scim_configs')
          .update(payload)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('scim_configs')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scim_config'] });
      toast.success('Configuração SCIM salva');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateAttr = (scimKey: string, value: string) => {
    setAttrMap(prev => ({ ...prev, [scimKey]: value }));
  };

  const addAttr = () => {
    setAttrMap(prev => ({ ...prev, '': '' }));
  };

  const removeAttr = (key: string) => {
    setAttrMap(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const addRoleRule = () => {
    setRoleRules(prev => [...prev, { scim_group: '', internal_role: 'viewer' }]);
  };

  const removeRoleRule = (i: number) => {
    setRoleRules(prev => prev.filter((_, idx) => idx !== i));
  };

  const updateRoleRule = (i: number, field: keyof RoleMappingRule, value: string) => {
    setRoleRules(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  if (isLoading) return <p className="text-sm text-muted-foreground mt-4">Carregando...</p>;

  return (
    <div className="space-y-4 mt-4">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Status do SCIM
            <Badge variant={isEnabled ? 'default' : 'secondary'}>
              {isEnabled ? 'Ativo' : 'Inativo'}
            </Badge>
          </CardTitle>
          <CardDescription>Ative ou desative o provisionamento SCIM para este tenant.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>SCIM Habilitado</Label>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Criar usuários automaticamente</Label>
              <p className="text-xs text-muted-foreground">Provisionar novos usuários ao receber via SCIM.</p>
            </div>
            <Switch checked={autoCreate} onCheckedChange={setAutoCreate} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Desativar usuários automaticamente</Label>
              <p className="text-xs text-muted-foreground">Desativar quando o IdP envia active=false.</p>
            </div>
            <Switch checked={autoDeactivate} onCheckedChange={setAutoDeactivate} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Sincronizar grupos como roles</Label>
              <p className="text-xs text-muted-foreground">Mapear grupos SCIM para roles internos.</p>
            </div>
            <Switch checked={syncGroups} onCheckedChange={setSyncGroups} />
          </div>
          <div>
            <Label>Role padrão para novos usuários</Label>
            <Select value={defaultRole} onValueChange={setDefaultRole}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTERNAL_ROLES.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Attribute Mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapeamento de Atributos</CardTitle>
          <CardDescription>Define como atributos SCIM mapeiam para campos internos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(attrMap).map(([scimKey, internalField]) => (
            <div key={scimKey} className="flex items-center gap-2">
              <Input
                placeholder="Atributo SCIM (ex: userName)"
                value={scimKey}
                onChange={e => {
                  const newMap = { ...attrMap };
                  delete newMap[scimKey];
                  newMap[e.target.value] = internalField;
                  setAttrMap(newMap);
                }}
                className="flex-1 font-mono text-xs"
              />
              <span className="text-muted-foreground">→</span>
              <Input
                placeholder="Campo interno"
                value={internalField}
                onChange={e => updateAttr(scimKey, e.target.value)}
                className="flex-1 font-mono text-xs"
              />
              <Button variant="ghost" size="icon" onClick={() => removeAttr(scimKey)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addAttr}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar Mapeamento
          </Button>
        </CardContent>
      </Card>

      {/* Role Mapping Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regras de Mapeamento de Roles</CardTitle>
          <CardDescription>Mapeie grupos do IdP para roles internos do tenant.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {roleRules.map((rule, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="Grupo SCIM (ex: Engineering)"
                value={rule.scim_group}
                onChange={e => updateRoleRule(i, 'scim_group', e.target.value)}
                className="flex-1"
              />
              <span className="text-muted-foreground">→</span>
              <Select value={rule.internal_role} onValueChange={v => updateRoleRule(i, 'internal_role', v)}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERNAL_ROLES.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => removeRoleRule(i)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addRoleRule}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar Regra
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Salvando...' : 'Salvar Configuração'}
        </Button>
      </div>
    </div>
  );
}
