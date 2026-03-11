/**
 * DisplayPoliciesPanel — Security policies for displays: token expiration,
 * max displays per tenant, auto-disconnect rules.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ShieldCheck, Clock, Monitor, WifiOff, AlertTriangle, Info } from 'lucide-react';

interface PolicyConfig {
  token_expiry_hours: number;
  max_displays_per_tenant: number;
  auto_disconnect_inactive_hours: number;
  require_reauth_on_ip_change: boolean;
  allow_multi_tenant_pairing: boolean;
  enforce_https_only: boolean;
}

const DEFAULT_POLICIES: PolicyConfig = {
  token_expiry_hours: 72,
  max_displays_per_tenant: 50,
  auto_disconnect_inactive_hours: 24,
  require_reauth_on_ip_change: true,
  allow_multi_tenant_pairing: false,
  enforce_https_only: true,
};

export default function DisplayPoliciesPanel() {
  const [policies, setPolicies] = useState<PolicyConfig>(DEFAULT_POLICIES);

  const update = <K extends keyof PolicyConfig>(key: K, value: PolicyConfig[K]) => {
    setPolicies(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-muted/50 border rounded-lg p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">Políticas de Segurança para Displays</p>
          <p className="text-xs text-muted-foreground mt-1">
            Configure regras globais de expiração de tokens, limites por tenant e segurança de conexão para todos os displays da plataforma.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Token & Expiration */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Expiração de Tokens
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Validade do token de pareamento (horas)</Label>
              <Input
                type="number"
                min={1}
                max={720}
                value={policies.token_expiry_hours}
                onChange={e => update('token_expiry_hours', Number(e.target.value))}
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Após este período, o display precisará ser pareado novamente.
              </p>
            </div>
            <Separator />
            <div>
              <Label className="text-xs">Auto-desconexão por inatividade (horas)</Label>
              <Input
                type="number"
                min={1}
                max={168}
                value={policies.auto_disconnect_inactive_hours}
                onChange={e => update('auto_disconnect_inactive_hours', Number(e.target.value))}
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Displays sem heartbeat serão desconectados automaticamente.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Limits */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary" /> Limites por Tenant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Máximo de displays por tenant</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={policies.max_displays_per_tenant}
                onChange={e => update('max_displays_per_tenant', Number(e.target.value))}
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Limita a quantidade de displays que um tenant pode registrar.
              </p>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">Permitir pareamento cross-tenant</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Permite que um display seja pareado a partir de tenants diferentes.
                </p>
              </div>
              <Switch
                checked={policies.allow_multi_tenant_pairing}
                onCheckedChange={v => update('allow_multi_tenant_pairing', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Segurança de Conexão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Reautenticação ao mudar de IP</Label>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Exige novo pareamento se o IP do display mudar.
                  </p>
                </div>
                <Switch
                  checked={policies.require_reauth_on_ip_change}
                  onCheckedChange={v => update('require_reauth_on_ip_change', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Forçar HTTPS apenas</Label>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Bloqueia conexões de displays em HTTP não seguro.
                  </p>
                </div>
                <Switch
                  checked={policies.enforce_https_only}
                  onCheckedChange={v => update('enforce_https_only', v)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active rules summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Regras Ativas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-xs gap-1">
              <Clock className="h-3 w-3" /> Token: {policies.token_expiry_hours}h
            </Badge>
            <Badge variant="secondary" className="text-xs gap-1">
              <WifiOff className="h-3 w-3" /> Auto-disconnect: {policies.auto_disconnect_inactive_hours}h
            </Badge>
            <Badge variant="secondary" className="text-xs gap-1">
              <Monitor className="h-3 w-3" /> Max/tenant: {policies.max_displays_per_tenant}
            </Badge>
            {policies.require_reauth_on_ip_change && (
              <Badge variant="outline" className="text-xs gap-1 text-amber-500">
                <ShieldCheck className="h-3 w-3" /> Re-auth IP change
              </Badge>
            )}
            {policies.enforce_https_only && (
              <Badge variant="outline" className="text-xs gap-1 text-emerald-500">
                <ShieldCheck className="h-3 w-3" /> HTTPS only
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
