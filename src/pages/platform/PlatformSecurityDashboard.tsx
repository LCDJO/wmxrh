/**
 * /platform/security/dashboard — Security Overview Dashboard
 * Aggregated view of roles, permissions, users, risk and audit data.
 */
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Users, Key, Lock, AlertTriangle, CheckCircle,
  ShieldAlert, Eye, GitBranch, Loader2, Activity, FileText,
  TrendingUp, BarChart3,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(38 92% 50%)',
  'hsl(var(--accent-foreground))',
  'hsl(200 70% 50%)',
  'hsl(280 60% 55%)',
  'hsl(150 60% 40%)',
  'hsl(350 70% 55%)',
];

interface SecurityStats {
  totalRoles: number;
  systemRoles: number;
  customRoles: number;
  totalPermissions: number;
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  roleAssignments: { role_name: string; user_count: number }[];
  permissionsByModule: { module: string; count: number }[];
  recentAuditLogs: { action: string; entity_type: string; created_at: string }[];
  rolesWithNoUsers: number;
  avgPermsPerRole: number;
}

export default function PlatformSecurityDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);

    const [rolesRes, permsRes, rpRes, usersRes, auditRes] = await Promise.all([
      supabase.from('platform_roles').select('id, name, slug, is_system_role'),
      supabase.from('platform_permission_definitions').select('id, module, code'),
      supabase.from('platform_role_permissions').select('role_id, permission_id'),
      supabase.from('platform_users').select('id, role_id, status, display_name, email, platform_roles(name)'),
      supabase.from('audit_logs').select('action, entity_type, created_at').order('created_at', { ascending: false }).limit(10),
    ]);

    const roles = rolesRes.data ?? [];
    const perms = permsRes.data ?? [];
    const rp = rpRes.data ?? [];
    const users = usersRes.data ?? [];
    const audits = auditRes.data ?? [];

    // Role assignments count
    const roleCountMap = new Map<string, number>();
    users.forEach((u: any) => {
      const roleName = u.platform_roles?.name ?? 'Unknown';
      roleCountMap.set(roleName, (roleCountMap.get(roleName) ?? 0) + 1);
    });
    const roleAssignments = Array.from(roleCountMap.entries())
      .map(([role_name, user_count]) => ({ role_name, user_count }))
      .sort((a, b) => b.user_count - a.user_count);

    // Permissions by module
    const moduleMap = new Map<string, number>();
    perms.forEach((p: any) => {
      moduleMap.set(p.module, (moduleMap.get(p.module) ?? 0) + 1);
    });
    const permissionsByModule = Array.from(moduleMap.entries())
      .map(([module, count]) => ({ module, count }))
      .sort((a, b) => b.count - a.count);

    // Roles with no users
    const usedRoleIds = new Set(users.map((u: any) => u.role_id));
    const rolesWithNoUsers = roles.filter(r => !usedRoleIds.has(r.id)).length;

    // Avg perms per role
    const rolePermCount = new Map<string, number>();
    rp.forEach((r: any) => {
      rolePermCount.set(r.role_id, (rolePermCount.get(r.role_id) ?? 0) + 1);
    });
    const avgPerms = rolePermCount.size > 0
      ? Math.round(Array.from(rolePermCount.values()).reduce((a, b) => a + b, 0) / rolePermCount.size)
      : 0;

    setStats({
      totalRoles: roles.length,
      systemRoles: roles.filter(r => r.is_system_role).length,
      customRoles: roles.filter(r => !r.is_system_role).length,
      totalPermissions: perms.length,
      totalUsers: users.length,
      activeUsers: users.filter((u: any) => u.status === 'active').length,
      suspendedUsers: users.filter((u: any) => u.status === 'suspended').length,
      roleAssignments,
      permissionsByModule,
      recentAuditLogs: audits as any[],
      rolesWithNoUsers,
      avgPermsPerRole: avgPerms,
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

  const securityScore = Math.min(100, Math.round(
    (stats.activeUsers > 0 ? 20 : 0) +
    (stats.totalRoles > 1 ? 20 : 0) +
    (stats.totalPermissions > 10 ? 20 : 0) +
    (stats.rolesWithNoUsers === 0 ? 20 : 10) +
    (stats.suspendedUsers === 0 ? 20 : 10)
  ));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Segurança — Visão Geral</h1>
            <p className="text-sm text-muted-foreground">
              Resumo de cargos, permissões, usuários e indicadores de segurança.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Key className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Cargos</span>
            </div>
            <p className="text-2xl font-bold font-display">{stats.totalRoles}</p>
            <div className="flex gap-2 mt-1">
              <Badge variant="secondary" className="text-[9px]">{stats.systemRoles} sistema</Badge>
              <Badge variant="outline" className="text-[9px]">{stats.customRoles} custom</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Permissões</span>
            </div>
            <p className="text-2xl font-bold font-display">{stats.totalPermissions}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.permissionsByModule.length} módulos</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Usuários</span>
            </div>
            <p className="text-2xl font-bold font-display">{stats.totalUsers}</p>
            <div className="flex gap-2 mt-1">
              <Badge variant="default" className="text-[9px]">{stats.activeUsers} ativos</Badge>
              {stats.suspendedUsers > 0 && (
                <Badge variant="destructive" className="text-[9px]">{stats.suspendedUsers} suspensos</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Média Perms/Cargo</span>
            </div>
            <p className="text-2xl font-bold font-display">{stats.avgPermsPerRole}</p>
          </CardContent>
        </Card>

        <Card className={cn(
          securityScore >= 80 ? 'border-primary/30' : securityScore >= 50 ? 'border-yellow-500/30' : 'border-destructive/30'
        )}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Security Score</span>
            </div>
            <p className="text-2xl font-bold font-display">{securityScore}/100</p>
            <Progress value={securityScore} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Users per Role */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Distribuição por Cargo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.roleAssignments.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={stats.roleAssignments}
                    dataKey="user_count"
                    nameKey="role_name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ role_name, user_count }) => `${role_name}: ${user_count}`}
                    labelLine={false}
                  >
                    {stats.roleAssignments.map((_, i) => (
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

        {/* Permissions by Module */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" /> Permissões por Módulo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.permissionsByModule.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.permissionsByModule.slice(0, 8)} layout="vertical">
                  <XAxis type="number" />
                  <YAxis dataKey="module" type="category" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" /> Alertas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.rolesWithNoUsers > 0 && (
              <div className="flex items-center gap-2 text-xs p-2 rounded-md bg-yellow-500/10">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 shrink-0" />
                <span>{stats.rolesWithNoUsers} cargo(s) sem usuários atribuídos</span>
              </div>
            )}
            {stats.suspendedUsers > 0 && (
              <div className="flex items-center gap-2 text-xs p-2 rounded-md bg-destructive/10">
                <ShieldAlert className="h-3.5 w-3.5 text-destructive shrink-0" />
                <span>{stats.suspendedUsers} usuário(s) suspenso(s)</span>
              </div>
            )}
            {stats.rolesWithNoUsers === 0 && stats.suspendedUsers === 0 && (
              <div className="flex items-center gap-2 text-xs p-2 rounded-md bg-primary/10">
                <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>Nenhum alerta de segurança</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Audit */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Últimas Ações (Audit)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentAuditLogs.length > 0 ? (
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                {stats.recentAuditLogs.map((log, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted/50">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{log.action}</span>
                      <Badge variant="outline" className="text-[9px]">{log.entity_type}</Badge>
                    </div>
                    <span className="text-muted-foreground">
                      {new Date(log.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum registro de auditoria recente.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => navigate('/platform/security/roles')} className="gap-1.5">
          <GitBranch className="h-3.5 w-3.5" /> Gerenciar Cargos
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/platform/security/permissions')} className="gap-1.5">
          <Key className="h-3.5 w-3.5" /> Ver Permissões
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/platform/security/access-graph')} className="gap-1.5">
          <Eye className="h-3.5 w-3.5" /> Access Graph
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/platform/users')} className="gap-1.5">
          <Users className="h-3.5 w-3.5" /> Gerenciar Usuários
        </Button>
      </div>
    </div>
  );
}
