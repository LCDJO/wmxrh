/**
 * /platform/apis — Platform API Management (PAMS) hub with sub-route navigation.
 *
 * Submenus:
 *   /platform/apis          → Clients overview
 *   /platform/apis/keys     → API Keys management
 *   /platform/apis/usage    → Usage logs & analytics
 *   /platform/apis/rate-limits → Rate limit configs
 *   /platform/apis/versions → API versioning
 *
 * SECURITY:
 *   - ApiKey nunca visível após criação (masked)
 *   - Somente PlatformSuperAdmin cria scopes globais
 */
import { useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import {
  Network, Key, BarChart3, Gauge, GitBranch, Plus, Search,
  ShieldAlert, Eye, EyeOff, Copy, Clock, AlertTriangle,
} from 'lucide-react';

// ── Tab routing ──

const TABS = [
  { value: '', label: 'Clients', icon: Network, path: '' },
  { value: 'keys', label: 'Keys', icon: Key, path: 'keys' },
  { value: 'usage', label: 'Usage', icon: BarChart3, path: 'usage' },
  { value: 'rate-limits', label: 'Rate Limits', icon: Gauge, path: 'rate-limits' },
  { value: 'versions', label: 'Versions', icon: GitBranch, path: 'versions' },
] as const;

function resolveTab(pathname: string): string {
  if (pathname.endsWith('/keys')) return 'keys';
  if (pathname.endsWith('/usage')) return 'usage';
  if (pathname.endsWith('/rate-limits')) return 'rate-limits';
  if (pathname.endsWith('/versions')) return 'versions';
  return '';
}

// ── Clients Panel ──

function ClientsPanel() {
  const [search, setSearch] = useState('');

  const mockClients = [
    { id: '1', name: 'Tenant Portal', client_type: 'tenant', status: 'active', environment: 'production' },
    { id: '2', name: 'Partner Integration', client_type: 'partner', status: 'active', environment: 'production' },
    { id: '3', name: 'Dev Testing', client_type: 'internal', status: 'active', environment: 'sandbox' },
    { id: '4', name: 'Mobile App', client_type: 'tenant', status: 'suspended', environment: 'production' },
  ];

  const filtered = mockClients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar client..."
            className="pl-8"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Client
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Ambiente</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">{c.client_type}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={c.environment === 'sandbox' ? 'secondary' : 'default'} className="text-xs">
                    {c.environment}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={c.status === 'active' ? 'default' : 'destructive'} className="capitalize">
                    {c.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ── Keys Panel ──

function KeysPanel() {
  /**
   * SECURITY: API keys are NEVER shown after creation.
   * Only the masked prefix is displayed. The full key is returned ONCE
   * at generation time and must be copied immediately.
   */
  const mockKeys = [
    { id: '1', prefix: 'pams_a1b2_', client: 'Tenant Portal', scopes: 3, expires: '2026-06-01', status: 'active' },
    { id: '2', prefix: 'pams_c3d4_', client: 'Partner Integration', scopes: 5, expires: null, status: 'active' },
    { id: '3', prefix: 'pams_e5f6_', client: 'Dev Testing', scopes: 2, expires: '2026-03-01', status: 'active' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldAlert className="h-4 w-4" />
          <span>Chaves são exibidas apenas uma vez no momento da criação.</span>
        </div>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Gerar Key
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key (masked)</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Scopes</TableHead>
              <TableHead>Expira em</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockKeys.map(k => (
              <TableRow key={k.id}>
                <TableCell className="font-mono text-xs">
                  <span className="flex items-center gap-1.5">
                    <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                    {k.prefix}{'•'.repeat(24)}
                  </span>
                </TableCell>
                <TableCell>{k.client}</TableCell>
                <TableCell>
                  <Badge variant="outline">{k.scopes} scopes</Badge>
                </TableCell>
                <TableCell>
                  {k.expires ? (
                    <span className="flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3" />
                      {k.expires}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem expiração</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="default">Ativa</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ── Usage Panel ──

function UsagePanel() {
  const stats = [
    { label: 'Requests (24h)', value: '12,847', change: '+8.2%' },
    { label: 'Avg Latency', value: '142ms', change: '-3.1%' },
    { label: 'Error Rate', value: '0.3%', change: '-0.1%' },
    { label: 'Rate Limited', value: '23', change: '+5' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{s.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Request Log (últimos)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Endpoint</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Latência</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { endpoint: '/api/v1/hr/employees', module: 'hr', status: 200, latency: 89, ts: '14:32:01' },
                { endpoint: '/api/v1/billing/invoices', module: 'billing', status: 200, latency: 124, ts: '14:31:58' },
                { endpoint: '/api/v2/compensation/salary', module: 'compensation', status: 429, latency: 12, ts: '14:31:55' },
                { endpoint: '/api/v1/health/exams', module: 'health', status: 200, latency: 203, ts: '14:31:52' },
              ].map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{r.endpoint}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{r.module}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={r.status === 200 ? 'default' : 'destructive'}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{r.latency}ms</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.ts}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Rate Limits Panel ──

function RateLimitsPanel() {
  const plans = [
    { tier: 'free', perMin: 10, perHour: 100, burst: 3, concurrent: 2, daily: 500 },
    { tier: 'starter', perMin: 30, perHour: 500, burst: 5, concurrent: 3, daily: 5000 },
    { tier: 'professional', perMin: 60, perHour: 2000, burst: 10, concurrent: 5, daily: 20000 },
    { tier: 'enterprise', perMin: 300, perHour: 10000, burst: 50, concurrent: 20, daily: 100000 },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Limites por Plano</CardTitle>
          <CardDescription>Rate limits aplicados via TenantPlan + UsageBillingRules</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plano</TableHead>
                <TableHead>Req/min</TableHead>
                <TableHead>Req/hora</TableHead>
                <TableHead>Burst</TableHead>
                <TableHead>Concurrent</TableHead>
                <TableHead>Daily Limit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map(p => (
                <TableRow key={p.tier}>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{p.tier}</Badge>
                  </TableCell>
                  <TableCell>{p.perMin}</TableCell>
                  <TableCell>{p.perHour.toLocaleString()}</TableCell>
                  <TableCell>{p.burst}</TableCell>
                  <TableCell>{p.concurrent}</TableCell>
                  <TableCell>{p.daily.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Versions Panel ──

function VersionsPanel() {
  const versions = [
    { version: 'v2', status: 'active', released: '2026-01-15', endpoints: 47 },
    { version: 'v1', status: 'deprecated', released: '2025-06-01', endpoints: 38 },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Versions</CardTitle>
          <CardDescription>Resolvidas via ModuleVersionRegistry — /api/v1/, /api/v2/</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Versão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Release</TableHead>
                <TableHead>Endpoints</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map(v => (
                <TableRow key={v.version}>
                  <TableCell className="font-mono font-bold">{v.version}</TableCell>
                  <TableCell>
                    <Badge variant={v.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                      {v.status}
                    </Badge>
                    {v.status === 'deprecated' && (
                      <AlertTriangle className="inline ml-1.5 h-3.5 w-3.5 text-warning" />
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{v.released}</TableCell>
                  <TableCell>{v.endpoints}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Component ──

export default function PlatformApiManagement() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentTab = resolveTab(location.pathname);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">API Management</h1>
        <p className="text-muted-foreground">
          Gerencie clients, keys, rate limits e versões da API da plataforma.
        </p>
      </div>

      <Tabs
        value={currentTab}
        onValueChange={v => {
          const base = '/platform/apis';
          navigate(v ? `${base}/${v}` : base);
        }}
      >
        <TabsList>
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                <Icon className="h-4 w-4" />
                {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <Routes>
        <Route index element={<ClientsPanel />} />
        <Route path="keys" element={<KeysPanel />} />
        <Route path="usage" element={<UsagePanel />} />
        <Route path="rate-limits" element={<RateLimitsPanel />} />
        <Route path="versions" element={<VersionsPanel />} />
      </Routes>
    </div>
  );
}
