/**
 * SaaS Dashboard — Two-tab layout:
 *  1. Operacional (default): realtime sessions, map, alerts, system status
 *  2. Financeiro: MRR, ARR, churn, LTV, revenue charts
 */
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, DollarSign } from 'lucide-react';
import { OperationalDashboard } from '@/components/dashboard/OperationalDashboard';
import { FinancialDashboard } from '@/components/dashboard/FinancialDashboard';
import { ContextualAdSlot } from '@/components/ads/ContextualAdSlot';

export default function Dashboard() {
  const [tab, setTab] = useState('operational');

  return (
    <div className="space-y-6 animate-fade-in">
      <ContextualAdSlot slot="tenant_dashboard_top" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="space-y-6 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold font-display text-foreground">Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Centro de comando da plataforma SaaS
              </p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="operational" className="gap-2">
                <Activity className="h-4 w-4" /> Operacional
              </TabsTrigger>
              <TabsTrigger value="financial" className="gap-2">
                <DollarSign className="h-4 w-4" /> Financeiro
              </TabsTrigger>
            </TabsList>

            <TabsContent value="operational" className="mt-6 space-y-6">
              <OperationalDashboard />
            </TabsContent>

            <TabsContent value="financial" className="mt-6 space-y-6">
              <FinancialDashboard />
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24">
          <ContextualAdSlot slot="tenant_dashboard_widget" />
        </aside>
      </div>
    </div>
  );
}
