/**
 * /platform/governance/enforcement — Policy Enforcement Overview
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldAlert, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface EnforcementRecord {
  id: string;
  tenant_id: string;
  action_type: string;
  reason: string;
  severity: string;
  status: string;
  enforced_at: string;
}

export default function GovernanceEnforcement() {
  const [records, setRecords] = useState<EnforcementRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('account_enforcements')
      .select('id, tenant_id, action_type, reason, severity, status, enforced_at')
      .order('enforced_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setRecords((data ?? []) as EnforcementRecord[]);
        setLoading(false);
      });
  }, []);

  const severityIcon = (s: string) => {
    if (s === 'critical') return <ShieldAlert className="h-4 w-4 text-destructive" />;
    if (s === 'high') return <AlertTriangle className="h-4 w-4 text-warning" />;
    if (s === 'resolved') return <CheckCircle className="h-4 w-4 text-primary" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Enforcement</h1>
        <p className="text-sm text-muted-foreground">Ações de enforcement aplicadas a tenants por violação de políticas.</p>
      </div>

      <ScrollArea className="h-[calc(100vh-220px)]">
        <div className="grid gap-3">
          {records.map(r => (
            <Card key={r.id} className="border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {severityIcon(r.severity)}
                    <CardTitle className="text-sm font-medium text-foreground">{r.action_type}</CardTitle>
                  </div>
                  <Badge variant={r.status === 'active' ? 'destructive' : 'secondary'}>{r.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <p>{r.reason}</p>
                <p>Tenant: {r.tenant_id.slice(0, 8)}… • {new Date(r.enforced_at).toLocaleString('pt-BR')}</p>
              </CardContent>
            </Card>
          ))}
          {loading && <p className="text-sm text-muted-foreground p-4">Carregando...</p>}
          {!loading && records.length === 0 && (
            <p className="text-sm text-muted-foreground p-4">Nenhum enforcement registrado.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
