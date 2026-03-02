/**
 * PlatformBiometrics — Control Plane for Biometric Trust Layer.
 *
 * Displays:
 *  - Failed verification attempts
 *  - Average match score
 *  - Fraud/deepfake suspicions
 *  - Consent status overview
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Fingerprint, ShieldAlert, TrendingDown, ShieldCheck, RefreshCw,
  XCircle, AlertTriangle, CheckCircle, Eye, ScanFace, FileWarning,
} from 'lucide-react';

// ── Types ──

type AuditEntry = {
  id: string;
  tenant_id: string;
  employee_id: string | null;
  action: string;
  action_category: string;
  entity_type: string | null;
  entity_id: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  lgpd_justification: string | null;
};

type ConsentRecord = {
  id: string;
  tenant_id: string;
  employee_id: string;
  consent_type: string;
  granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
};

type FraudLog = {
  id: string;
  tenant_id: string;
  employee_id: string;
  fraud_type: string;
  severity: string;
  confidence_score: number;
  auto_action: string | null;
  resolved: boolean;
  created_at: string;
};

// ── Helpers ──

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

const SEVERITY_CLASSES: Record<string, string> = {
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

// ── Component ──

export default function PlatformBiometrics() {
  // Failed verifications from audit trail
  const { data: failedAttempts = [], refetch, isLoading: loadingFailed } = useQuery({
    queryKey: ['platform-bio-failed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('biometric_audit_trail' as any)
        .select('*')
        .like('action', '%failed%')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as AuditEntry[];
    },
    refetchInterval: 30000,
  });

  // All recent verifications (for score calc)
  const { data: allVerifications = [], isLoading: loadingVerifications } = useQuery({
    queryKey: ['platform-bio-verifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('biometric_audit_trail' as any)
        .select('*')
        .eq('action_category', 'verification')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as AuditEntry[];
    },
    refetchInterval: 30000,
  });

  // Fraud suspicions (biometric-related)
  const { data: fraudSuspicions = [], isLoading: loadingFraud } = useQuery({
    queryKey: ['platform-bio-fraud'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worktime_fraud_logs' as any)
        .select('*')
        .in('fraud_type', ['biometric_spoof', 'deepfake', 'liveness_failure', 'face_mismatch'])
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as FraudLog[];
    },
    refetchInterval: 30000,
  });

  // Consent status
  const { data: consents = [], isLoading: loadingConsent } = useQuery({
    queryKey: ['platform-bio-consents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('biometric_consents' as any)
        .select('*')
        .order('granted_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ConsentRecord[];
    },
    refetchInterval: 60000,
  });

  // ── Stats ──
  const avgScore = (() => {
    const scores = allVerifications
      .map(v => (v.metadata as any)?.match_score)
      .filter((s): s is number => typeof s === 'number');
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  })();

  const consentGranted = consents.filter(c => c.granted).length;
  const consentRevoked = consents.filter(c => !c.granted).length;
  const uniqueEmployeesWithConsent = new Set(consents.filter(c => c.granted).map(c => c.employee_id)).size;

  const stats = {
    failedAttempts: failedAttempts.length,
    avgScore: (avgScore * 100).toFixed(1),
    fraudSuspicions: fraudSuspicions.filter(f => !f.resolved).length,
    consentGranted,
    consentRevoked,
    uniqueConsented: uniqueEmployeesWithConsent,
    totalVerifications: allVerifications.length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <Fingerprint className="h-6 w-6 text-primary" />
            Biometrics Control Plane
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitoramento da camada de confiança biométrica — Anti-deepfake, Liveness, Consentimento LGPD
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={XCircle}
          label="Tentativas Falhas"
          value={stats.failedAttempts}
          subtitle="verificações rejeitadas"
          color="text-destructive"
        />
        <KpiCard
          icon={TrendingDown}
          label="Score Médio"
          value={`${stats.avgScore}%`}
          subtitle={`de ${stats.totalVerifications} verificações`}
          color="text-primary"
        />
        <KpiCard
          icon={ShieldAlert}
          label="Suspeitas de Fraude"
          value={stats.fraudSuspicions}
          subtitle="não resolvidas"
          color="text-orange-600"
        />
        <KpiCard
          icon={ShieldCheck}
          label="Consentimentos Ativos"
          value={stats.uniqueConsented}
          subtitle={`${stats.consentGranted} concedidos · ${stats.consentRevoked} revogados`}
          color="text-green-600"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="failed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="failed" className="gap-1.5">
            <XCircle className="h-3.5 w-3.5" /> Falhas
            <Badge variant="destructive" className="ml-1 text-[10px] px-1.5">{stats.failedAttempts}</Badge>
          </TabsTrigger>
          <TabsTrigger value="scores" className="gap-1.5">
            <ScanFace className="h-3.5 w-3.5" /> Verificações
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{stats.totalVerifications}</Badge>
          </TabsTrigger>
          <TabsTrigger value="fraud" className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Fraude
            <Badge variant="outline" className="ml-1 text-[10px] px-1.5">{stats.fraudSuspicions}</Badge>
          </TabsTrigger>
          <TabsTrigger value="consent" className="gap-1.5">
            <FileWarning className="h-3.5 w-3.5" /> Consentimento
            <Badge variant="outline" className="ml-1 text-[10px] px-1.5">{stats.uniqueConsented}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Failed Attempts */}
        <TabsContent value="failed">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tentativas de Verificação Falhas</CardTitle>
              <CardDescription>Registros biométricos rejeitados por liveness, match ou deepfake</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-1.5">
                  {failedAttempts.length === 0 && !loadingFailed && (
                    <p className="text-muted-foreground text-sm py-8 text-center">Nenhuma tentativa falha encontrada.</p>
                  )}
                  {failedAttempts.map(entry => (
                    <AuditRow key={entry.id} entry={entry} variant="failed" />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Verifications (scores) */}
        <TabsContent value="scores">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Histórico de Verificações</CardTitle>
              <CardDescription>Todas as verificações biométricas com scores de match e liveness</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-1.5">
                  {allVerifications.length === 0 && !loadingVerifications && (
                    <p className="text-muted-foreground text-sm py-8 text-center">Nenhuma verificação encontrada.</p>
                  )}
                  {allVerifications.map(entry => (
                    <AuditRow key={entry.id} entry={entry} variant="score" />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fraud */}
        <TabsContent value="fraud">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Suspeitas de Fraude Biométrica</CardTitle>
              <CardDescription>Deepfake, spoof e falhas de liveness detectadas pelo motor anti-fraude</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-1.5">
                  {fraudSuspicions.length === 0 && !loadingFraud && (
                    <p className="text-muted-foreground text-sm py-8 text-center">Nenhuma suspeita de fraude biométrica.</p>
                  )}
                  {fraudSuspicions.map(f => (
                    <FraudRow key={f.id} log={f} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Consent */}
        <TabsContent value="consent">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Status de Consentimento LGPD</CardTitle>
              <CardDescription>Consentimentos biométricos concedidos e revogados por colaborador</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-1.5">
                  {consents.length === 0 && !loadingConsent && (
                    <p className="text-muted-foreground text-sm py-8 text-center">Nenhum registro de consentimento.</p>
                  )}
                  {consents.map(c => (
                    <ConsentRow key={c.id} consent={c} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ──

function KpiCard({ icon: Icon, label, value, subtitle, color }: {
  icon: typeof XCircle; label: string; value: string | number; subtitle: string; color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 flex items-center gap-3">
        <div className={`rounded-lg p-2.5 bg-muted ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-[10px] text-muted-foreground/70">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AuditRow({ entry, variant }: { entry: AuditEntry; variant: 'failed' | 'score' }) {
  const meta = (entry.metadata ?? {}) as Record<string, any>;
  const matchScore = meta.match_score as number | undefined;
  const livenessScore = meta.liveness_score as number | undefined;
  const decision = meta.decision as string | undefined;
  const deviceId = meta.device_id as string | undefined;

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors text-sm">
      {variant === 'failed' ? (
        <XCircle className="h-4 w-4 shrink-0 text-destructive" />
      ) : (
        <Eye className="h-4 w-4 shrink-0 text-primary" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">
            {entry.employee_id?.slice(0, 8) ?? 'N/A'}…
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {entry.action.replace(/_/g, ' ')}
          </Badge>
          {decision && (
            <Badge
              variant={decision === 'approved' ? 'default' : decision === 'flagged' ? 'secondary' : 'destructive'}
              className="text-[10px] px-1.5 py-0"
            >
              {decision}
            </Badge>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
          {matchScore != null && <span>Match: <strong>{(matchScore * 100).toFixed(1)}%</strong></span>}
          {livenessScore != null && <span>Liveness: <strong>{(livenessScore * 100).toFixed(1)}%</strong></span>}
          {deviceId && <span className="font-mono text-[10px]">Device: {deviceId.slice(0, 12)}…</span>}
          {entry.ip_address && <span className="font-mono text-[10px]">IP: {entry.ip_address}</span>}
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(entry.created_at)}</span>
    </div>
  );
}

function FraudRow({ log }: { log: FraudLog }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors text-sm">
      <AlertTriangle className={`h-4 w-4 shrink-0 ${
        log.severity === 'critical' ? 'text-red-600' : log.severity === 'high' ? 'text-orange-600' : 'text-yellow-600'
      }`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{log.fraud_type.replace(/_/g, ' ')}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SEVERITY_CLASSES[log.severity] ?? ''}`}>
            {log.severity}
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {Math.round(log.confidence_score * 100)}% confiança
          </Badge>
          {log.resolved && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-600">resolvido</Badge>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          Employee: {log.employee_id.slice(0, 8)}… · {new Date(log.created_at).toLocaleString('pt-BR')}
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(log.created_at)}</span>
    </div>
  );
}

function ConsentRow({ consent }: { consent: ConsentRecord }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors text-sm">
      {consent.granted ? (
        <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-destructive" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{consent.employee_id.slice(0, 8)}…</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {consent.consent_type.replace(/_/g, ' ')}
          </Badge>
          <Badge
            variant={consent.granted ? 'default' : 'destructive'}
            className="text-[10px] px-1.5 py-0"
          >
            {consent.granted ? 'Concedido' : 'Revogado'}
          </Badge>
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {consent.granted && consent.granted_at && (
            <span>Concedido em {new Date(consent.granted_at).toLocaleString('pt-BR')}</span>
          )}
          {!consent.granted && consent.revoked_at && (
            <span>Revogado em {new Date(consent.revoked_at).toLocaleString('pt-BR')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
