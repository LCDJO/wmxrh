/**
 * /platform/security/scim — Platform-level SCIM 2.0 Control Plane.
 * Provides cross-tenant visibility into SCIM configurations, provisioning logs, and role mappings.
 */
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Settings, ScrollText, KeyRound } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { PlatformScimConfigs } from '@/components/platform/scim/PlatformScimConfigs';
import { PlatformScimLogs } from '@/components/platform/scim/PlatformScimLogs';
import { PlatformScimRoleMappings } from '@/components/platform/scim/PlatformScimRoleMappings';

export default function PlatformScim() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'configs';
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t) setTab(t);
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          SCIM Control Plane
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestão centralizada de provisionamento SCIM 2.0 em todos os tenants.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="configs" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Configurations
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <ScrollText className="h-3.5 w-3.5" /> Provisioning Logs
          </TabsTrigger>
          <TabsTrigger value="role-mapping" className="gap-1.5">
            <KeyRound className="h-3.5 w-3.5" /> Role Mapping
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configs"><PlatformScimConfigs /></TabsContent>
        <TabsContent value="logs"><PlatformScimLogs /></TabsContent>
        <TabsContent value="role-mapping"><PlatformScimRoleMappings /></TabsContent>
      </Tabs>
    </div>
  );
}
