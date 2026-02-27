/**
 * /platform/security/federation — Federation Overview Dashboard
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Shield, Globe, KeyRound, Settings, FileText,
  Users, ArrowRight, CheckCircle2, AlertTriangle,
} from 'lucide-react';

const SECTIONS = [
  {
    title: 'Identity Providers',
    description: 'Gerencie provedores SAML 2.0 e OIDC federados.',
    icon: Users,
    path: '/platform/security/federation/identity-providers',
    stats: { label: 'IdPs Ativos', value: '—' },
  },
  {
    title: 'SAML Config',
    description: 'Configure Service Provider SAML, certificados e attribute mapping.',
    icon: Shield,
    path: '/platform/security/federation/saml-config',
    stats: { label: 'Certificados', value: '—' },
  },
  {
    title: 'OAuth Clients',
    description: 'Clientes OAuth2 registrados e fluxos de autorização.',
    icon: KeyRound,
    path: '/platform/security/federation/oauth-clients',
    stats: { label: 'Clientes', value: '—' },
  },
  {
    title: 'Token Settings',
    description: 'Configurações de emissão, lifetime e rotação de tokens.',
    icon: Settings,
    path: '/platform/security/federation/token-settings',
    stats: { label: 'Configurações', value: '—' },
  },
  {
    title: 'Audit Logs',
    description: 'Logs de autenticação federada, logins e eventos de segurança.',
    icon: FileText,
    path: '/platform/security/federation/audit-logs',
    stats: { label: 'Eventos (24h)', value: '—' },
  },
];

export default function PlatformFederation() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Globe className="h-6 w-6 text-primary" />
          Identity Federation
        </h1>
        <p className="text-muted-foreground mt-1">
          Unified Identity Federation Engine — SAML 2.0, OIDC e OAuth2.
        </p>
      </div>

      {/* Status Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">
            Federation Engine inicializado. Configure provedores de identidade para habilitar SSO.
          </span>
        </CardContent>
      </Card>

      {/* Section Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => (
          <Card
            key={section.title}
            className="cursor-pointer hover:border-primary/40 transition-colors group"
            onClick={() => navigate(section.path)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <section.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <Badge variant="secondary" className="text-xs">
                  {section.stats.label}: {section.stats.value}
                </Badge>
              </div>
              <CardTitle className="text-base mt-2">{section.title}</CardTitle>
              <CardDescription className="text-xs">{section.description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button variant="ghost" size="sm" className="gap-1 p-0 h-auto text-primary">
                Gerenciar <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
