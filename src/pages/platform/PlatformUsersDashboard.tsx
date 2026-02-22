/**
 * /platform/users/dashboard — Users Overview Dashboard
 * Summary of platform users by role, status, with activity data.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  Users, Shield, UserCheck, UserX, Loader2,
  TrendingUp, Clock, Plus, BarChart3,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis,
} from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(38 92% 50%)',
  'hsl(200 70% 50%)',
  'hsl(280 60% 55%)',
  'hsl(150 60% 40%)',
  'hsl(350 70% 55%)',
  'hsl(var(--accent-foreground))',
];

interface UserStats {
  total: number;
  active: number;
  suspended: number;
  inactive: number;
  byRole: { role: string; count: number }[];
  byStatus: { status: string; count: number; label: string }[];
  recentUsers: { display_name: string | null; email: string; role_name: string; created_at: string; status: string }[];
  createdThisMonth: number;
  createdLastMonth: number;
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  suspended: 'Suspenso',
  inactive: 'Inativo',
};

export default function PlatformUsersDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);

    const { data: users } = await supabase
      .from('platform_users')
      .select('id, display_name, email, status, role_id, created_at, platform_roles(name)')
      .order('created_at', { ascending: false });

    const all = users ?? [];

    // By role
    const roleMap = new Map<string, number>();
    all.forEach((u: any) => {
      const name = u.platform_roles?.name ?? 'Unknown';
      roleMap.set(name, (roleMap.get(name) ?? 0) + 1);
    });
    const byRole = Array.from(roleMap.entries())
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count);

    // By status
    const statusMap = new Map<string, number>();
    all.forEach((u: any) => {
      statusMap.set(u.status, (statusMap.get(u.status) ?? 0) + 1);
    });
    const byStatus = Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, count, label: STATUS_LABELS[status] ?? status }));

    // Recent users (last 5)
    const recentUsers = all.slice(0, 8).map((u: any) => ({
      display_name: u.display_name,
      email: u.email,
      role_name: u.platform_roles?.name ?? '—',
      created_at: u.created_at,
      status: u.status,
    }));

    // Created this month vs last month
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const createdThisMonth = all.filter((u: any) => new Date(u.created_at) >= thisMonthStart).length;
    const createdLastMonth = all.filter((u: any) => {
      const d = new Date(u.created_at);
      return d >= lastMonthStart && d < thisMonthStart;
    }).length;

    setStats({
      total: all.length,
      active: all.filter((u: any) => u.status === 'active').length,
      suspended: all.filter((u: any) => u.status === 'suspended').length,
      inactive: all.filter((u: any) => u.status === 'inactive').length,
      byRole,
      byStatus,
      recentUsers,
      createdThisMonth,
      createdLastMonth,
    });

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return null;

  const growthPct = stats.createdLastMonth > 0
    ? Math.round(((stats.createdThisMonth - stats.createdLastMonth) / stats.createdLastMonth) * 100)
    : stats.createdThisMonth > 0 ? 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Usuários — Visão Geral</h1>
            <p className="text-sm text-muted-foreground">
              Resumo de todos os usuários da plataforma, organizados por cargo e status.
            </p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => navigate('/platform/users')}>
          <Plus className="h-4 w-4" /> Gerenciar Usuários
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Total</span>
            </div>
            <p className="text-2xl font-bold font-display">{stats.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Ativos</span>
            </div>
            <p className="text-2xl font-bold font-display">{stats.active}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <UserX className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Suspensos</span>
            </div>
            <p className="text-2xl font-bold font-display">{stats.suspended}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Este Mês</span>
            </div>
            <p className="text-2xl font-bold font-display">{stats.createdThisMonth}</p>
            <p className="text-xs text-muted-foreground mt-1">novos cadastros</p>
          </CardContent>
        </Card>

        <Card className={cn(
          growthPct > 0 ? 'border-primary/30' : growthPct < 0 ? 'border-destructive/30' : ''
        )}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Crescimento</span>
            </div>
            <p className={cn(
              "text-2xl font-bold font-display",
              growthPct > 0 ? 'text-primary' : growthPct < 0 ? 'text-destructive' : ''
            )}>
              {growthPct > 0 ? '+' : ''}{growthPct}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">vs mês anterior</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* By Role */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> Distribuição por Cargo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.byRole.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.byRole} layout="vertical">
                  <XAxis type="number" />
                  <YAxis dataKey="role" type="category" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>

        {/* By Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Distribuição por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.byStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={stats.byStatus}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    label={({ label, count }) => `${label}: ${count}`}
                    labelLine={false}
                  >
                    {stats.byStatus.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Users */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Usuários Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.recentUsers.map((u, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 text-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {(u.display_name || u.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{u.display_name || u.email}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{u.role_name}</Badge>
                  <Badge
                    variant={u.status === 'active' ? 'default' : u.status === 'suspended' ? 'destructive' : 'secondary'}
                    className="text-[10px]"
                  >
                    {STATUS_LABELS[u.status] ?? u.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-2">
                    {format(new Date(u.created_at), 'dd/MM/yy')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
