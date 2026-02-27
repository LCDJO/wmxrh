/**
 * /platform/security/federation/token-settings — Token issuance settings
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Settings, Save, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function FederationTokenSettings() {
  const { toast } = useToast();

  const [config, setConfig] = useState({
    accessTokenLifetime: 3600,
    refreshTokenLifetime: 2592000,
    idTokenLifetime: 3600,
    enableRefreshTokenRotation: true,
    enablePKCE: true,
    requirePKCEForPublicClients: true,
    maxActiveSessions: 5,
    issuer: `${window.location.origin}/devportal`,
  });

  function handleSave() {
    toast({ title: 'Salvo', description: 'Configurações de token atualizadas.' });
  }

  function handleReset() {
    setConfig({
      accessTokenLifetime: 3600,
      refreshTokenLifetime: 2592000,
      idTokenLifetime: 3600,
      enableRefreshTokenRotation: true,
      enablePKCE: true,
      requirePKCEForPublicClients: true,
      maxActiveSessions: 5,
      issuer: `${window.location.origin}/devportal`,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Token Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configurações de emissão, lifetime e segurança de tokens.
        </p>
      </div>

      {/* Lifetimes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Token Lifetimes</CardTitle>
          <CardDescription>Tempo de vida dos tokens emitidos pela plataforma.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Access Token (segundos)</Label>
              <Input
                type="number"
                value={config.accessTokenLifetime}
                onChange={(e) => setConfig((c) => ({ ...c, accessTokenLifetime: parseInt(e.target.value) || 0 }))}
              />
              <p className="text-[10px] text-muted-foreground">
                ≈ {Math.round(config.accessTokenLifetime / 60)} min
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Refresh Token (segundos)</Label>
              <Input
                type="number"
                value={config.refreshTokenLifetime}
                onChange={(e) => setConfig((c) => ({ ...c, refreshTokenLifetime: parseInt(e.target.value) || 0 }))}
              />
              <p className="text-[10px] text-muted-foreground">
                ≈ {Math.round(config.refreshTokenLifetime / 86400)} dias
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">ID Token (segundos)</Label>
              <Input
                type="number"
                value={config.idTokenLifetime}
                onChange={(e) => setConfig((c) => ({ ...c, idTokenLifetime: parseInt(e.target.value) || 0 }))}
              />
              <p className="text-[10px] text-muted-foreground">
                ≈ {Math.round(config.idTokenLifetime / 60)} min
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Segurança</CardTitle>
          <CardDescription>Políticas de segurança para fluxos OAuth2/OIDC.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Refresh Token Rotation</Label>
              <p className="text-xs text-muted-foreground">Invalida refresh token antigo ao emitir novo.</p>
            </div>
            <Switch
              checked={config.enableRefreshTokenRotation}
              onCheckedChange={(v) => setConfig((c) => ({ ...c, enableRefreshTokenRotation: v }))}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">PKCE Habilitado</Label>
              <p className="text-xs text-muted-foreground">Proof Key for Code Exchange (RFC 7636).</p>
            </div>
            <Switch
              checked={config.enablePKCE}
              onCheckedChange={(v) => setConfig((c) => ({ ...c, enablePKCE: v }))}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">PKCE Obrigatório para Public Clients</Label>
              <p className="text-xs text-muted-foreground">Clientes públicos devem usar PKCE.</p>
            </div>
            <Switch
              checked={config.requirePKCEForPublicClients}
              onCheckedChange={(v) => setConfig((c) => ({ ...c, requirePKCEForPublicClients: v }))}
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs">Máximo de Sessões Ativas por Usuário</Label>
            <Input
              type="number"
              value={config.maxActiveSessions}
              onChange={(e) => setConfig((c) => ({ ...c, maxActiveSessions: parseInt(e.target.value) || 1 }))}
              className="max-w-[200px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Issuer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issuer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Issuer URL (iss claim)</Label>
            <Input value={config.issuer} readOnly className="font-mono text-xs" />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={handleSave} className="gap-1.5">
          <Save className="h-3.5 w-3.5" /> Salvar Configurações
        </Button>
        <Button variant="outline" onClick={handleReset} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" /> Resetar Padrões
        </Button>
      </div>
    </div>
  );
}
