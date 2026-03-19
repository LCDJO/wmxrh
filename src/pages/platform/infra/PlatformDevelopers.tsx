/**
 * PlatformDevelopers — Developer account management for platform admins.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, CheckCircle, AlertTriangle, Ban } from 'lucide-react';

export default function PlatformDevelopers() {
  const { data: developers = [], isLoading } = useQuery({
    queryKey: ['platform-developers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('developer_accounts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const statusColor: Record<string, string> = {
    active: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    suspended: 'bg-red-500/10 text-red-500 border-red-500/20',
    revoked: 'bg-muted text-muted-foreground border-border',
  };

  const stats = {
    total: developers.length,
    active: developers.filter(d => d.status === 'active').length,
    pending: developers.filter(d => d.status === 'pending').length,
    suspended: developers.filter(d => d.status === 'suspended').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Developers</h1>
        <p className="text-sm text-muted-foreground">Gerenciamento de contas de desenvolvedores e parceiros.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: Users, color: 'text-primary' },
          { label: 'Ativos', value: stats.active, icon: CheckCircle, color: 'text-emerald-500' },
          { label: 'Pendentes', value: stats.pending, icon: AlertTriangle, color: 'text-amber-500' },
          { label: 'Suspensos', value: stats.suspended, icon: Ban, color: 'text-red-500' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Desenvolvedores Registrados</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : developers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum desenvolvedor registrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 font-medium text-muted-foreground">Nome</th>
                    <th className="pb-2 font-medium text-muted-foreground">Email</th>
                    <th className="pb-2 font-medium text-muted-foreground">Empresa</th>
                    <th className="pb-2 font-medium text-muted-foreground">Tier</th>
                    <th className="pb-2 font-medium text-muted-foreground">Verificado</th>
                    <th className="pb-2 font-medium text-muted-foreground">Status</th>
                    <th className="pb-2 font-medium text-muted-foreground">Registrado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {developers.map((dev: any) => (
                    <tr key={dev.id} className="hover:bg-muted/50">
                      <td className="py-2.5 font-medium text-foreground">{dev.name}</td>
                      <td className="py-2.5 text-muted-foreground">{dev.email}</td>
                      <td className="py-2.5 text-muted-foreground">{dev.company || '—'}</td>
                      <td className="py-2.5"><Badge variant="outline" className="text-[10px]">{dev.tier}</Badge></td>
                      <td className="py-2.5">{dev.verified ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <span className="text-muted-foreground text-xs">Não</span>}</td>
                      <td className="py-2.5"><Badge variant="outline" className={statusColor[dev.status] || ''}>{dev.status}</Badge></td>
                      <td className="py-2.5 text-muted-foreground text-xs">{new Date(dev.created_at).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
