/**
 * AgreementManagement — Admin RH Page
 *
 * Two main sections:
 *   1. Biblioteca de Termos (agreement templates)
 *   2. Assinaturas Pendentes (pending employee agreements)
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useQueryScope } from '@/domains/hooks';
import {
  FileText, Clock, CheckCircle2, Search, Users,
  AlertTriangle, Filter, XCircle, ExternalLink,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatsCard } from '@/components/shared/StatsCard';
import { useToast } from '@/hooks/use-toast';

// ── Types ──

interface TemplateRow {
  id: string;
  name: string;
  category: string;
  is_mandatory: boolean;
  is_active: boolean;
  versao: number;
  description: string | null;
  created_at: string;
}

interface PendingAgreementRow {
  id: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  expires_at: string | null;
  signature_provider: string | null;
  external_signing_url: string | null;
  employee: { name: string; email: string | null } | null;
  template: { name: string; category: string; is_mandatory: boolean } | null;
}

const categoryLabels: Record<string, string> = {
  geral: 'Geral', funcao: 'Função', empresa: 'Empresa', risco: 'Risco',
};

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-chart-3/10 text-chart-3' },
  sent: { label: 'Enviado', className: 'bg-primary/10 text-primary' },
  signed: { label: 'Assinado', className: 'bg-chart-2/10 text-chart-2' },
  rejected: { label: 'Rejeitado', className: 'bg-destructive/10 text-destructive' },
  expired: { label: 'Expirado', className: 'bg-muted text-muted-foreground' },
};

export default function AgreementManagement() {
  const qs = useQueryScope();
  const { toast } = useToast();
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState('all');
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingStatus, setPendingStatus] = useState('all');

  // ── Templates query ──
  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['agreement_templates_admin', qs?.tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agreement_templates')
        .select('id, name, category, is_mandatory, is_active, versao, description, created_at')
        .eq('tenant_id', qs!.tenantId)
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return (data || []) as TemplateRow[];
    },
    enabled: !!qs,
  });

  // ── All agreements query (for pending + stats) ──
  const { data: allAgreements = [], isLoading: loadingAgreements } = useQuery({
    queryKey: ['employee_agreements_admin', qs?.tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_agreements')
        .select(`
          id, status, sent_at, created_at, expires_at, signature_provider, external_signing_url,
          employee:employees!employee_agreements_employee_id_fkey(name, email),
          template:agreement_templates!employee_agreements_template_id_fkey(name, category, is_mandatory)
        `)
        .eq('tenant_id', qs!.tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((row: Record<string, unknown>) => ({
        ...row,
        employee: Array.isArray(row.employee) ? row.employee[0] : row.employee,
        template: Array.isArray(row.template) ? row.template[0] : row.template,
      })) as PendingAgreementRow[];
    },
    enabled: !!qs,
  });

  // ── Stats ──
  const stats = useMemo(() => {
    const total = allAgreements.length;
    const pending = allAgreements.filter(a => a.status === 'pending' || a.status === 'sent').length;
    const signed = allAgreements.filter(a => a.status === 'signed').length;
    const rejected = allAgreements.filter(a => a.status === 'rejected').length;
    return { total, pending, signed, rejected };
  }, [allAgreements]);

  // ── Filtered templates ──
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      if (templateCategory !== 'all' && t.category !== templateCategory) return false;
      if (templateSearch && !t.name.toLowerCase().includes(templateSearch.toLowerCase())) return false;
      return true;
    });
  }, [templates, templateSearch, templateCategory]);

  // ── Filtered pending agreements ──
  const filteredAgreements = useMemo(() => {
    return allAgreements.filter(a => {
      if (pendingStatus === 'all') {
        if (!['pending', 'sent'].includes(a.status)) return false;
      } else if (a.status !== pendingStatus) return false;
      if (pendingSearch) {
        const search = pendingSearch.toLowerCase();
        if (
          !(a.employee?.name?.toLowerCase().includes(search)) &&
          !(a.template?.name?.toLowerCase().includes(search))
        ) return false;
      }
      return true;
    });
  }, [allAgreements, pendingSearch, pendingStatus]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Termos e Acordos</h1>
        <p className="text-sm text-muted-foreground mt-1">Biblioteca de termos e gestão de assinaturas</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatsCard title="Total Termos" value={templates.length} icon={FileText} />
        <StatsCard title="Pendentes" value={stats.pending} icon={Clock} trend={stats.pending > 0 ? { value: stats.pending, label: 'aguardando' } : undefined} />
        <StatsCard title="Assinados" value={stats.signed} icon={CheckCircle2} />
        <StatsCard title="Rejeitados" value={stats.rejected} icon={XCircle} />
      </div>

      <Tabs defaultValue="biblioteca" className="space-y-4">
        <TabsList>
          <TabsTrigger value="biblioteca" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />Biblioteca de Termos
          </TabsTrigger>
          <TabsTrigger value="pendentes" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />Assinaturas Pendentes
            {stats.pending > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">{stats.pending}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ══════ Biblioteca de Termos ══════ */}
        <TabsContent value="biblioteca">
          <div className="bg-card rounded-xl shadow-card p-6">
            <div className="flex flex-wrap gap-3 mb-5">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar termo..." value={templateSearch} onChange={e => setTemplateSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={templateCategory} onValueChange={setTemplateCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {loadingTemplates ? (
              <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
            ) : filteredTemplates.length > 0 ? (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Termo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-center">Obrigatório</TableHead>
                      <TableHead className="text-center">Versão</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Criado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTemplates.map(t => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium text-card-foreground">{t.name}</p>
                            {t.description && <p className="text-xs text-muted-foreground truncate max-w-[250px]">{t.description}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                            {categoryLabels[t.category] || t.category}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {t.is_mandatory ? (
                            <CheckCircle2 className="h-4 w-4 text-primary inline-block" />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-xs font-mono text-muted-foreground">v{t.versao}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.is_active ? 'bg-chart-2/10 text-chart-2' : 'bg-muted text-muted-foreground'}`}>
                            {t.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString('pt-BR')}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum termo encontrado.</p>
            )}
          </div>
        </TabsContent>

        {/* ══════ Assinaturas Pendentes ══════ */}
        <TabsContent value="pendentes">
          <div className="bg-card rounded-xl shadow-card p-6">
            <div className="flex flex-wrap gap-3 mb-5">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar colaborador ou termo..." value={pendingSearch} onChange={e => setPendingSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={pendingStatus} onValueChange={setPendingStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Pendentes</SelectItem>
                  <SelectItem value="pending">Aguardando envio</SelectItem>
                  <SelectItem value="sent">Enviado</SelectItem>
                  <SelectItem value="signed">Assinado</SelectItem>
                  <SelectItem value="rejected">Rejeitado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loadingAgreements ? (
              <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
            ) : filteredAgreements.length > 0 ? (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Termo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Enviado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAgreements.map(a => {
                      const st = statusLabels[a.status] || statusLabels.pending;
                      return (
                        <TableRow key={a.id}>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium text-card-foreground">{a.employee?.name || '—'}</p>
                              {a.employee?.email && <p className="text-xs text-muted-foreground">{a.employee.email}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-card-foreground">{a.template?.name || '—'}</span>
                              {a.template?.is_mandatory && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Obrigatório</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.className}`}>
                              {st.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground capitalize">{a.signature_provider || '—'}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {a.sent_at ? new Date(a.sent_at).toLocaleDateString('pt-BR') : '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {a.external_signing_url && (
                              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => window.open(a.external_signing_url!, '_blank')}>
                                <ExternalLink className="h-3.5 w-3.5" />
                                Link
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma assinatura pendente.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
