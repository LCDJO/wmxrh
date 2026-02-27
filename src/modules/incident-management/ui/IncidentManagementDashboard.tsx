/**
 * Incident Management Dashboard — Full incident lifecycle management.
 */
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, AlertTriangle, Clock, FileText, BarChart3 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { IncidentListPanel } from './IncidentListPanel';
import { SLADashboardPanel } from './SLADashboardPanel';
import { PostmortemPanel } from './PostmortemPanel';
import { AvailabilityPanel } from './AvailabilityPanel';

export default function IncidentManagementDashboard() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'incidents');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="h-6 w-6 text-destructive" />
          Enterprise Incident Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestão de incidentes 24×7 com SLA automático, escalonamento e status page pública.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="incidents" className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Incidentes
          </TabsTrigger>
          <TabsTrigger value="sla" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" /> SLA
          </TabsTrigger>
          <TabsTrigger value="postmortems" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Postmortems
          </TabsTrigger>
          <TabsTrigger value="availability" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Disponibilidade
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incidents"><IncidentListPanel /></TabsContent>
        <TabsContent value="sla"><SLADashboardPanel /></TabsContent>
        <TabsContent value="postmortems"><PostmortemPanel /></TabsContent>
        <TabsContent value="availability"><AvailabilityPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
