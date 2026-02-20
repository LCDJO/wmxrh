/**
 * eSocial Governance & Monitoring Center — SuperAdmin Dashboard
 */

import { useState, useMemo } from 'react';
import {
  Shield, Building2, AlertTriangle, CheckCircle2, Clock,
  ChevronDown, ChevronRight, FileText, Activity, Zap,
  Server, XCircle, Info, KeyRound, Send,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { StatsCard } from '@/components/shared/StatsCard';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  getPlatformKPIs,
  getTenantOverviews,
  getActiveAlerts,
  getLayoutVersions,
  getSystemStatus,
  runCertificateMonitor,
  type EsocialTenantOverview,
  type EsocialAlert,
} from '@/domains/esocial-governance';

// ── Status config ──

const STATUS_CONFIG: Record<string, { label: string; bgClass: string; textClass: string; icon: typeof CheckCircle2 }> = {
  em_dia:               { label: 'Em dia',       bgClass: 'bg-primary/10',      textClass: 'text-primary',      icon: CheckCircle2 },
  pendencias_menores:   { label: 'Pendências',   bgClass: 'bg-warning/10',      textClass: 'text-warning',      icon: Clock },
  pendencias_criticas:  { label: 'Crítico',      bgClass: 'bg-destructive/10',  textClass: 'text-destructive',  icon: AlertTriangle },
  bloqueado:            { label: 'Bloqueado',     bgClass: 'bg-destructive/10',  textClass: 'text-destructive',  icon: XCircle },
  nao_configurado:      { label: 'Não config.',  bgClass: 'bg-muted',           textClass: 'text-muted-foreground', icon: Info },
};

const SEVERITY_CONFIG: Record<string, { bgClass: string; textClass: string }> = {
  info:     { bgClass: 'bg-info/10',         textClass: 'text-info' },
  warning:  { bgClass: 'bg-warning/10',      textClass: 'text-warning' },
  critical: { bgClass: 'bg-destructive/10',  textClass: 'text-destructive' },
};

const PIE_COLORS = [
  'hsl(160, 84%, 29%)',  // em_dia
  'hsl(38, 92%, 50%)',   // pendencias
  'hsl(0, 72%, 51%)',    // critico/bloqueado
  'hsl(215, 15%, 65%)',  // nao_configurado
];

export default function EsocialGovernanceDashboard() {
  const kpis = getPlatformKPIs();
  const tenants = getTenantOverviews();
  const alerts = getActiveAlerts();
  const layouts = getLayoutVersions();
  const systemStatus = getSystemStatus();
  const certMonitor = runCertificateMonitor();
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);

  const taxaRejeicao = kpis.eventos_enviados_mes > 0
    ? Math.round((kpis.eventos_rejeitados_mes / kpis.eventos_enviados_mes) * 100)
    : 0;
  const empresasCriticas = tenants.filter(t => t.status === 'pendencias_criticas' || t.status === 'bloqueado');
  const certsExpirando = certMonitor.certificados.filter(c => c.status === 'expirando' || c.status === 'expirado');

  // Charts data
  const statusDistribution = useMemo(() => {
    const counts = { em_dia: 0, pendencias: 0, critico: 0, nao_config: 0 };
    tenants.forEach(t => {
      if (t.status === 'em_dia') counts.em_dia++;
      else if (t.status === 'pendencias_menores') counts.pendencias++;
      else if (t.status === 'pendencias_criticas' || t.status === 'bloqueado') counts.critico++;
      else counts.nao_config++;
    });
    return [
      { name: 'Em dia', value: counts.em_dia, fill: PIE_COLORS[0] },
      { name: 'Pendências', value: counts.pendencias, fill: PIE_COLORS[1] },
      { name: 'Crítico', value: counts.critico, fill: PIE_COLORS[2] },
      { name: 'Não config.', value: counts.nao_config, fill: PIE_COLORS[3] },
    ].filter(d => d.value > 0);
  }, [tenants]);

  const tenantBarData = useMemo(() =>
    tenants.filter(t => t.status !== 'nao_configurado').map(t => ({
      name: t.tenant_name.length > 16 ? t.tenant_name.slice(0, 16) + '…' : t.tenant_name,
      pendentes: t.eventos_pendentes,
      rejeitados: t.eventos_rejeitados,
    })),
  [tenants]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Server className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">eSocial Governance Center</h1>
          <p className="text-sm text-muted-foreground">
            Monitoramento centralizado da integração eSocial — SuperAdmin
          </p>
        </div>
      </div>

      {/* ═══ KPIs ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
        <StatsCard title="Eventos Hoje" value={kpis.eventos_enviados_mes} subtitle="total enviados" icon={Send} />
        <StatsCard title="Taxa Rejeição" value={`${taxaRejeicao}%`} subtitle={`${kpis.eventos_rejeitados_mes} rejeitados`} icon={XCircle} />
        <StatsCard title="Empresas Críticas" value={empresasCriticas.length} subtitle={empresasCriticas.length > 0 ? empresasCriticas.map(e => e.tenant_name).join(', ') : 'Nenhuma'} icon={AlertTriangle} />
        <StatsCard title="Layout" value={systemStatus.layout_atual_suportado} subtitle={systemStatus.compatibilidade ? `✓ Compatível (${systemStatus.layout_vigente_oficial})` : `⚠ Oficial: ${systemStatus.layout_vigente_oficial}`} icon={FileText} />
        <StatsCard title="Certificados" value={`${certMonitor.expirando + certMonitor.expirados}`} subtitle={certMonitor.expirando > 0 ? `${certMonitor.expirando} expirando em 30d` : 'Todos em dia'} icon={KeyRound} />
      </div>

      {/* ═══ Charts ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status distribution */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold font-display text-card-foreground">Status dos Tenants</h2>
            </div>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} strokeWidth={2}>
                    {statusDistribution.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {statusDistribution.map(item => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                    <span className="text-card-foreground">{item.name}</span>
                    <span className="ml-auto font-semibold text-muted-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Events by tenant */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold font-display text-card-foreground">Eventos por Tenant</h2>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tenantBarData}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215, 15%, 50%)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} />
                <Tooltip />
                <Bar dataKey="pendentes" name="Pendentes" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rejeitados" name="Rejeitados" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Layout Versions ═══ */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Versões do Layout</h2>
          </div>
          <div className="space-y-2">
            {layouts.map(layout => (
              <div key={layout.versao} className="flex items-center gap-4 p-3 rounded-lg border border-border">
                <Badge variant="outline" className={cn('text-xs font-mono', layout.status === 'vigente' ? 'bg-primary/10 text-primary' : layout.status === 'futuro' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground')}>
                  {layout.versao}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[9px]">{layout.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {layout.data_inicio_obrigatoriedade} → {layout.data_fim_obrigatoriedade ?? '∞'}
                    </span>
                  </div>
                  <div className="flex gap-1 mt-1">
                    {layout.eventos_alterados.slice(0, 5).map(e => (
                      <Badge key={e} variant="secondary" className="text-[9px] px-1 py-0 font-mono">{e}</Badge>
                    ))}
                    {layout.eventos_alterados.length > 5 && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0">+{layout.eventos_alterados.length - 5}</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ═══ Certificates Near Expiry ═══ */}
      {certsExpirando.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold font-display text-card-foreground">Certificados — Atenção</h2>
              <Badge variant="destructive" className="text-[10px] ml-auto">{certsExpirando.length}</Badge>
            </div>
            <div className="space-y-2">
              {certsExpirando.map(cert => (
                <div key={cert.company_id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0', cert.status === 'expirado' ? 'bg-destructive/10' : 'bg-warning/10')}>
                    <KeyRound className={cn('h-4 w-4', cert.status === 'expirado' ? 'text-destructive' : 'text-warning')} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-card-foreground">{cert.company_name}</p>
                    <p className="text-xs text-muted-foreground">Tipo {cert.tipo} · {cert.emitido_por ?? 'N/A'}</p>
                  </div>
                  <Badge variant="outline" className={cn('text-[10px] shrink-0', cert.status === 'expirado' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning')}>
                    {cert.status === 'expirado' ? `Expirado (${Math.abs(cert.dias_restantes!)}d atrás)` : `${cert.dias_restantes}d restantes`}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ Alerts ═══ */}
      {alerts.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold font-display text-card-foreground">Alertas Ativos</h2>
              <Badge variant="destructive" className="text-[10px] ml-auto">{alerts.length}</Badge>
            </div>
            <div className="space-y-2">
              {alerts.map(alert => {
                const sev = SEVERITY_CONFIG[alert.severity];
                return (
                  <div key={alert.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0', sev.bgClass)}>
                      <AlertTriangle className={cn('h-4 w-4', sev.textClass)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-card-foreground">{alert.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{alert.description}</p>
                    </div>
                    <Badge variant="outline" className={cn('text-[10px] shrink-0', sev.bgClass, sev.textClass)}>
                      {alert.severity}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(alert.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ Tenant Overview (expandable) ═══ */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold font-display text-foreground">Monitoramento por Tenant</h2>
        </div>

        {tenants.map(tenant => {
          const isExpanded = expandedTenant === tenant.tenant_id;
          const cfg = STATUS_CONFIG[tenant.status] ?? STATUS_CONFIG.nao_configurado;
          const StatusIcon = cfg.icon;
          const totalEmpresas = tenant.empresas_total;
          const pctEmDia = totalEmpresas > 0 ? Math.round((tenant.empresas_em_dia / totalEmpresas) * 100) : 0;

          return (
            <Card key={tenant.tenant_id} className={cn('transition-all', isExpanded && 'ring-1 ring-primary/20')}>
              <CardContent className="p-0">
                <button
                  onClick={() => setExpandedTenant(isExpanded ? null : tenant.tenant_id)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg shrink-0', cfg.bgClass)}>
                    <StatusIcon className={cn('h-4 w-4', cfg.textClass)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-card-foreground">{tenant.tenant_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {tenant.empresas_total} empresa{tenant.empresas_total > 1 ? 's' : ''} · Layout {tenant.layout_version}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {tenant.eventos_pendentes > 0 && (
                      <span className="text-xs font-semibold text-warning">{tenant.eventos_pendentes} pendentes</span>
                    )}
                    {tenant.eventos_rejeitados > 0 && (
                      <span className="text-xs font-semibold text-destructive">{tenant.eventos_rejeitados} rejeitados</span>
                    )}
                    <Badge variant="outline" className={cn('text-[10px]', cfg.bgClass, cfg.textClass)}>
                      {cfg.label}
                    </Badge>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-4 animate-fade-in">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 rounded-lg bg-muted/20">
                        <p className="text-2xl font-bold text-card-foreground">{tenant.empresas_em_dia}</p>
                        <p className="text-[10px] text-muted-foreground">Em dia</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/20">
                        <p className="text-2xl font-bold text-warning">{tenant.empresas_pendentes}</p>
                        <p className="text-[10px] text-muted-foreground">Pendentes</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/20">
                        <p className="text-2xl font-bold text-destructive">{tenant.empresas_bloqueadas}</p>
                        <p className="text-[10px] text-muted-foreground">Bloqueadas</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/20">
                        <p className="text-2xl font-bold text-card-foreground">{tenant.eventos_pendentes + tenant.eventos_rejeitados}</p>
                        <p className="text-[10px] text-muted-foreground">Eventos c/ issue</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Conformidade das empresas</span>
                        <span className="text-xs font-semibold text-card-foreground">{pctEmDia}%</span>
                      </div>
                      <Progress value={pctEmDia} className="h-2" />
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {tenant.ultimo_envio && (
                        <span>Último envio: {new Date(tenant.ultimo_envio).toLocaleDateString('pt-BR')}</span>
                      )}
                      {tenant.proximo_prazo && (
                        <span className="font-semibold text-warning">Próximo prazo: {new Date(tenant.proximo_prazo).toLocaleDateString('pt-BR')}</span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
