/**
 * DocumentSignatureIntegrations — Admin page for managing
 * digital signature provider integrations.
 */

import { useState } from 'react';
import { CheckCircle2, ExternalLink, Settings, Plug, FileSignature } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  website: string;
  logo: string;
  status: 'available' | 'coming_soon';
  features: string[];
}

const providers: ProviderInfo[] = [
  {
    id: 'clicksign',
    name: 'Clicksign',
    description: 'Plataforma brasileira de assinatura eletrônica com validade jurídica. Integração via API REST.',
    website: 'https://www.clicksign.com',
    logo: '✍️',
    status: 'available',
    features: ['Assinatura eletrônica', 'Validade jurídica ICP-Brasil', 'Webhook de callback', 'API REST'],
  },
  {
    id: 'autentique',
    name: 'Autentique',
    description: 'Assinatura eletrônica e digital brasileira com planos acessíveis e API completa.',
    website: 'https://www.autentique.com.br',
    logo: '📝',
    status: 'available',
    features: ['Assinatura eletrônica', 'Assinatura digital ICP-Brasil', 'API GraphQL', 'Templates'],
  },
  {
    id: 'zapsign',
    name: 'ZapSign',
    description: 'Plataforma de assinatura digital com foco em simplicidade e integração rápida.',
    website: 'https://www.zapsign.com.br',
    logo: '⚡',
    status: 'available',
    features: ['Assinatura via WhatsApp', 'API REST', 'Webhook automático', 'Reconhecimento facial'],
  },
  {
    id: 'opensign',
    name: 'OpenSign',
    description: 'Solução open-source de assinatura digital. Auto-hospedado ou cloud.',
    website: 'https://github.com/OpenSignLabs/OpenSign',
    logo: '🔓',
    status: 'available',
    features: ['Open-source', 'Self-hosted', 'API REST', 'Sem custo por documento'],
  },
  {
    id: 'docusign',
    name: 'DocuSign',
    description: 'Líder global em assinatura eletrônica. Integração planejada para versões futuras.',
    website: 'https://www.docusign.com',
    logo: '📄',
    status: 'coming_soon',
    features: ['Líder global', 'eSignature', 'CLM', 'API REST & SDK'],
  },
];

export default function DocumentSignatureIntegrations() {
  const { toast } = useToast();
  const [enabledProviders, setEnabledProviders] = useState<Record<string, boolean>>({});

  const handleToggle = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (provider?.status === 'coming_soon') {
      toast({ title: 'Em breve', description: `${provider.name} estará disponível em versões futuras.` });
      return;
    }
    setEnabledProviders(prev => {
      const next = { ...prev, [providerId]: !prev[providerId] };
      const action = next[providerId] ? 'ativado' : 'desativado';
      toast({ title: `${provider?.name} ${action}`, description: `Provider de assinatura ${action} com sucesso.` });
      return next;
    });
  };

  const activeCount = Object.values(enabledProviders).filter(Boolean).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Assinatura de Documentos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie as integrações com provedores de assinatura digital
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Plug className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{providers.length}</p>
              <p className="text-xs text-muted-foreground">Provedores disponíveis</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10">
              <CheckCircle2 className="h-5 w-5 text-chart-2" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <FileSignature className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{providers.filter(p => p.status === 'available').length}</p>
              <p className="text-xs text-muted-foreground">Prontos para integração</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {providers.map(provider => {
          const isEnabled = enabledProviders[provider.id] ?? false;
          const isComingSoon = provider.status === 'coming_soon';

          return (
            <Card key={provider.id} className={isComingSoon ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{provider.logo}</span>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {provider.name}
                        {isComingSoon && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Em breve</Badge>
                        )}
                        {isEnabled && !isComingSoon && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-chart-2/10 text-chart-2 border-0">Ativo</Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">{provider.description}</CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={() => handleToggle(provider.id)}
                    disabled={isComingSoon}
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {provider.features.map(feat => (
                    <span key={feat} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                      {feat}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => window.open(provider.website, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Documentação
                  </Button>
                  {isEnabled && !isComingSoon && (
                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                      <Settings className="h-3 w-3" />
                      Configurar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Architecture info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Arquitetura de Integração</CardTitle>
          <CardDescription className="text-xs">
            O sistema utiliza o padrão Adapter (Ports & Adapters) para integrar provedores de assinatura digital.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            <strong className="text-card-foreground">SignatureRequest</strong>: <code className="bg-muted px-1 rounded">employee_nome</code>, <code className="bg-muted px-1 rounded">employee_email</code>, <code className="bg-muted px-1 rounded">documento_html</code>, <code className="bg-muted px-1 rounded">callback_url</code>
          </p>
          <p>
            Cada provider implementa a interface <code className="bg-muted px-1 rounded">ISignatureProvider</code> e é registrado no <code className="bg-muted px-1 rounded">DigitalSignatureProviderAdapter</code>, que roteia operações para o adapter correto.
          </p>
          <p>
            O fluxo completo: Envio → Webhook de callback → Atualização de status → Armazenamento do documento assinado no vault.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
