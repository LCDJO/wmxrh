import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, Activity, DollarSign } from 'lucide-react';

export default function PlatformDashboard() {
  const stats = [
    { label: 'Tenants Ativos', value: '—', icon: Building2, color: 'text-primary' },
    { label: 'Usuários Totais', value: '—', icon: Users, color: 'text-info' },
    { label: 'Uptime', value: '99.9%', icon: Activity, color: 'text-success' },
    { label: 'MRR', value: '—', icon: DollarSign, color: 'text-warning' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Platform Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral da plataforma SaaS.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-display text-foreground">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Atividade Recente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
        </CardContent>
      </Card>
    </div>
  );
}
