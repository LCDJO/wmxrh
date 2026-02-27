/**
 * SsoSettings — Tenant-level SSO/Federation configuration page.
 *
 * Tabs:
 *   1. Identity Providers — CRUD IdPs (SAML, OIDC, OAuth2)
 *   2. Role Mappings — Map IdP groups → internal roles
 *   3. Active Sessions — View/revoke federation sessions
 *   4. Audit Logs — Federation event log
 */
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, KeyRound, Users, ScrollText } from 'lucide-react';
import { SsoIdpTab } from '@/components/sso/SsoIdpTab';
import { SsoRoleMappingsTab } from '@/components/sso/SsoRoleMappingsTab';
import { SsoSessionsTab } from '@/components/sso/SsoSessionsTab';
import { SsoAuditTab } from '@/components/sso/SsoAuditTab';

export default function SsoSettings() {
  const [activeTab, setActiveTab] = useState('idps');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Single Sign-On (SSO)</h1>
        <p className="text-muted-foreground">
          Configure provedores de identidade, mapeamentos de roles e gerencie sessões federadas.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="idps" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Provedores</span>
          </TabsTrigger>
          <TabsTrigger value="mappings" className="gap-2">
            <KeyRound className="h-4 w-4" />
            <span className="hidden sm:inline">Mapeamentos</span>
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Sessões</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <ScrollText className="h-4 w-4" />
            <span className="hidden sm:inline">Auditoria</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="idps"><SsoIdpTab /></TabsContent>
        <TabsContent value="mappings"><SsoRoleMappingsTab /></TabsContent>
        <TabsContent value="sessions"><SsoSessionsTab /></TabsContent>
        <TabsContent value="audit"><SsoAuditTab /></TabsContent>
      </Tabs>
    </div>
  );
}
