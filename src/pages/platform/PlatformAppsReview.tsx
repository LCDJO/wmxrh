/**
 * PlatformAppsReview — App review workflow for PlatformSuperAdmin/Operations.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardCheck, Clock, CheckCircle, XCircle } from 'lucide-react';

export default function PlatformAppsReview() {
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['platform-app-reviews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('developer_app_reviews')
        .select('*, developer_apps(name, slug, app_status, version)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const statusIcon: Record<string, typeof Clock> = {
    pending: Clock,
    in_progress: ClipboardCheck,
    passed: CheckCircle,
    failed: XCircle,
  };

  const statusColor: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    in_progress: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    passed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    failed: 'bg-red-500/10 text-red-500 border-red-500/20',
    waived: 'bg-muted text-muted-foreground border-border',
  };

  const stageLabel: Record<string, string> = {
    automated: 'Automatizada',
    manual: 'Manual',
    security: 'Segurança',
  };

  const pending = reviews.filter((r: any) => r.status === 'pending' || r.status === 'in_progress');
  const completed = reviews.filter((r: any) => r.status === 'passed' || r.status === 'failed' || r.status === 'waived');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Revisão de Apps</h1>
        <p className="text-sm text-muted-foreground">Workflow de aprovação: automated → manual → security.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: reviews.length },
          { label: 'Pendentes', value: pending.length },
          { label: 'Aprovados', value: reviews.filter((r: any) => r.status === 'passed').length },
          { label: 'Rejeitados', value: reviews.filter((r: any) => r.status === 'failed').length },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pendentes ({pending.length})</TabsTrigger>
          <TabsTrigger value="completed">Concluídos ({completed.length})</TabsTrigger>
        </TabsList>

        {['pending', 'completed'].map(tab => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardContent className="pt-4">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : (tab === 'pending' ? pending : completed).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma revisão.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="pb-2 font-medium text-muted-foreground">App</th>
                          <th className="pb-2 font-medium text-muted-foreground">Estágio</th>
                          <th className="pb-2 font-medium text-muted-foreground">Status</th>
                          <th className="pb-2 font-medium text-muted-foreground">Findings</th>
                          <th className="pb-2 font-medium text-muted-foreground">Data</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(tab === 'pending' ? pending : completed).map((review: any) => {
                          const Icon = statusIcon[review.status] || Clock;
                          return (
                            <tr key={review.id} className="hover:bg-muted/50">
                              <td className="py-2.5 font-medium text-foreground">
                                {review.developer_apps?.name || '—'}
                                <span className="text-xs text-muted-foreground ml-1">v{review.developer_apps?.version || '?'}</span>
                              </td>
                              <td className="py-2.5">
                                <Badge variant="outline">{stageLabel[review.review_stage] || review.review_stage}</Badge>
                              </td>
                              <td className="py-2.5">
                                <Badge variant="outline" className={statusColor[review.status] || ''}>
                                  <Icon className="h-3 w-3 mr-1" />{review.status}
                                </Badge>
                              </td>
                              <td className="py-2.5 text-muted-foreground text-xs">{review.findings?.length || 0} findings</td>
                              <td className="py-2.5 text-muted-foreground text-xs">{new Date(review.created_at).toLocaleDateString('pt-BR')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
