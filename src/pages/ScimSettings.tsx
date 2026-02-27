/**
 * SCIM 2.0 Provisioning Engine — Tenant-side management page.
 * Manages SCIM clients, attribute mappings, provisioned users/groups, and logs.
 */
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield } from 'lucide-react';
import { ScimClientsTab } from '@/components/scim/ScimClientsTab';
import { ScimConfigTab } from '@/components/scim/ScimConfigTab';
import { ScimProvisionedUsersTab } from '@/components/scim/ScimProvisionedUsersTab';
import { ScimProvisionedGroupsTab } from '@/components/scim/ScimProvisionedGroupsTab';
import { ScimLogsTab } from '@/components/scim/ScimLogsTab';
import { ScimQueueTab } from '@/components/scim/ScimQueueTab';

export default function ScimSettings() {
  const [tab, setTab] = useState('config');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          SCIM 2.0 Provisioning
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Provisionamento automático de usuários e grupos via protocolo SCIM 2.0.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="clients">Clientes SCIM</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="groups">Grupos</TabsTrigger>
          <TabsTrigger value="queue">Fila</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="config"><ScimConfigTab /></TabsContent>
        <TabsContent value="clients"><ScimClientsTab /></TabsContent>
        <TabsContent value="users"><ScimProvisionedUsersTab /></TabsContent>
        <TabsContent value="groups"><ScimProvisionedGroupsTab /></TabsContent>
        <TabsContent value="queue"><ScimQueueTab /></TabsContent>
        <TabsContent value="logs"><ScimLogsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
