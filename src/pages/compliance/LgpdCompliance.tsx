/**
 * LGPD Compliance Dashboard
 *
 * Manages legal basis, access logs, retention periods,
 * and automatic anonymization for ex-employee data.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useQueryScope } from '@/domains/hooks';
import { usePermissions } from '@/domains/security';
import { useAuth } from '@/contexts/AuthContext';
import {
  listLegalBasis,
  upsertLegalBasis,
  listAccessLogs,
  getRetentionOverview,
  anonymizeProfile,
  runAutoAnonymization,
  DEFAULT_LEGAL_BASES,
} from '@/domains/lgpd';
import type { LgpdLegalBasis } from '@/domains/lgpd';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Shield, ShieldAlert, Eye, Trash2, Plus, Loader2,
  Clock, AlertTriangle, CheckCircle2, FileText, Users,
  Database, Lock, Search,
} from 'lucide-react';

export default function LgpdCompliance() {
  const qs = useQueryScope();
  const { user } = useAuth();
  const { canManageEmployees } = usePermissions();
  const queryClient = useQueryClient();
  const [editBasis, setEditBasis] = useState<Partial<LgpdLegalBasis> | null>(null);
  const [logFilter, setLogFilter] = useState('');

  // ── Queries ──
  const { data: legalBases = [], isLoading: loadingBases } = useQuery({
    queryKey: ['lgpd_legal_basis', qs?.tenantId],
    queryFn: () => listLegalBasis(qs!.tenantId),
    enabled: !!qs?.tenantId,
  });

  const { data: accessLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['lgpd_access_logs', qs?.tenantId],
    queryFn: () => listAccessLogs(qs!.tenantId),
    enabled: !!qs?.tenantId,
  });

  const { data: retention, isLoading: loadingRetention } = useQuery({
    queryKey: ['lgpd_retention', qs?.tenantId],
    queryFn: () => getRetentionOverview(qs!.tenantId),
    enabled: !!qs?.tenantId,
  });

  // ── Mutations ──
  const saveBasisMutation = useMutation({
    mutationFn: (basis: Parameters<typeof upsertLegalBasis>[1]) => upsertLegalBasis(qs!.tenantId, basis),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lgpd_legal_basis'] });
      queryClient.invalidateQueries({ queryKey: ['lgpd_retention'] });
      toast.success('Base legal salva');
      setEditBasis(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const seedDefaultsMutation = useMutation({
    mutationFn: async () => {
      for (const basis of DEFAULT_LEGAL_BASES) {
        await upsertLegalBasis(qs!.tenantId, basis);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lgpd_legal_basis'] });
      toast.success('Bases legais padrão criadas');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const anonymizeMutation = useMutation({
    mutationFn: (archiveId: string) => anonymizeProfile(archiveId, qs!.tenantId, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lgpd_retention'] });
      toast.success('Perfil anonimizado com sucesso');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const autoAnonymizeMutation = useMutation({
    mutationFn: () => runAutoAnonymization(qs!.tenantId, user!.id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['lgpd_retention'] });
      toast.success(`Anonimização automática: ${result.anonymized} perfis processados`, {
        description: result.errors.length > 0 ? `${result.errors.length} erros` : undefined,
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filteredLogs = accessLogs.filter(log => {
    if (!logFilter.trim()) return true;
    const q = logFilter.toLowerCase();
    return log.employee_id.toLowerCase().includes(q) ||
      log.access_type.toLowerCase().includes(q) ||
      (log.purpose || '').toLowerCase().includes(q);
  });

  if (!canManageEmployees) {
    return (
      <div className="flex items-center justify-center py-24">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-3">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Acesso Restrito</h2>
            <p className="text-sm text-muted-foreground">Permissão necessária para acessar o módulo LGPD.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">LGPD — Proteção de Dados</h1>
          <p className="text-sm text-muted-foreground">Bases legais, retenção de dados e anonimização de ex-colaboradores</p>
        </div>
      </div>

      {/* Summary Cards */}
      {retention && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Database className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Total Arquivados</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{retention.total_archived}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Lock className="h-4 w-4 text-chart-2" />
                <p className="text-xs text-muted-foreground">Anonimizados</p>
              </div>
              <p className="text-2xl font-bold text-chart-2">{retention.anonymized}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-chart-4" />
                <p className="text-xs text-muted-foreground">Em Retenção</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{retention.within_retention}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <p className="text-xs text-muted-foreground">Prazo Expirado</p>
              </div>
              <p className="text-2xl font-bold text-destructive">{retention.past_retention}</p>
              {retention.past_retention > 0 && (
                <Button
                  size="sm" variant="destructive" className="mt-2 h-7 text-xs gap-1"
                  onClick={() => autoAnonymizeMutation.mutate()}
                  disabled={autoAnonymizeMutation.isPending}
                >
                  {autoAnonymizeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  Anonimizar Todos
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="legal_basis" className="space-y-4">
        <TabsList>
          <TabsTrigger value="legal_basis" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Bases Legais</TabsTrigger>
          <TabsTrigger value="access_logs" className="gap-1.5"><Eye className="h-3.5 w-3.5" /> Log de Acesso</TabsTrigger>
          <TabsTrigger value="anonymization" className="gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> Anonimização</TabsTrigger>
        </TabsList>

        {/* ── Tab: Legal Basis ── */}
        <TabsContent value="legal_basis">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Bases Legais de Retenção</CardTitle>
                <CardDescription className="text-xs">Defina a justificativa legal e o prazo de retenção para cada categoria de dados</CardDescription>
              </div>
              <div className="flex gap-2">
                {legalBases.length === 0 && (
                  <Button size="sm" variant="outline" onClick={() => seedDefaultsMutation.mutate()} disabled={seedDefaultsMutation.isPending} className="gap-1 text-xs">
                    {seedDefaultsMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Carregar Padrões CLT
                  </Button>
                )}
                <Button size="sm" onClick={() => setEditBasis({})} className="gap-1 text-xs">
                  <Plus className="h-3 w-3" /> Nova Base Legal
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingBases ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : legalBases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma base legal configurada. Clique em "Carregar Padrões CLT" para iniciar.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Artigo LGPD</TableHead>
                      <TableHead>Retenção</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {legalBases.map(basis => (
                      <TableRow key={basis.id}>
                        <TableCell className="text-sm font-medium">{basis.data_category.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{basis.legal_basis_type.replace(/_/g, ' ')}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{basis.lgpd_article}</Badge></TableCell>
                        <TableCell className="text-sm">{basis.retention_period_months} meses ({Math.round(basis.retention_period_months / 12)} anos)</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${basis.is_active ? 'bg-chart-2/10 text-chart-2' : 'bg-muted text-muted-foreground'}`}>
                            {basis.is_active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditBasis(basis)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Access Logs ── */}
        <TabsContent value="access_logs">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base">Log de Acesso a Ex-Colaboradores</CardTitle>
                <CardDescription className="text-xs">Registro imutável de todos os acessos a dados de colaboradores desligados</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Filtrar..." value={logFilter} onChange={e => setLogFilter(e.target.value)} className="pl-9 h-8 text-sm" />
              </div>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : filteredLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro de acesso encontrado.</p>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Recurso</TableHead>
                        <TableHead>Finalidade</TableHead>
                        <TableHead>Acessado por</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map(log => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(parseISO(log.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{log.employee_id.slice(0, 8)}...</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{log.access_type}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{log.resource_type}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{log.purpose || '—'}</TableCell>
                          <TableCell className="text-xs font-mono">{log.accessed_by.slice(0, 8)}...</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Anonymization ── */}
        <TabsContent value="anonymization">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Anonimização de Dados</CardTitle>
              <CardDescription className="text-xs">
                Perfis com prazo de retenção expirado devem ser anonimizados conforme LGPD Art. 16.
                A anonimização é irreversível — dados pessoais são substituídos por placeholders.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRetention ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : !retention || retention.candidates.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-chart-2" />
                  <p className="text-sm text-muted-foreground">Nenhum perfil com prazo de retenção expirado.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      <strong className="text-destructive">{retention.candidates.length}</strong> perfis com prazo expirado
                    </p>
                    <Button
                      variant="destructive" size="sm" className="gap-1.5"
                      onClick={() => {
                        if (confirm('Tem certeza? A anonimização é IRREVERSÍVEL. Dados pessoais serão permanentemente removidos.')) {
                          autoAnonymizeMutation.mutate();
                        }
                      }}
                      disabled={autoAnonymizeMutation.isPending}
                    >
                      {autoAnonymizeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Anonimizar Todos ({retention.candidates.length})
                    </Button>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Desligamento</TableHead>
                        <TableHead>Retenção</TableHead>
                        <TableHead>Expirou em</TableHead>
                        <TableHead className="w-[100px]">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {retention.candidates.map(c => (
                        <TableRow key={c.archive_id}>
                          <TableCell className="text-xs font-mono">{c.employee_id.slice(0, 8)}...</TableCell>
                          <TableCell className="text-xs">{format(parseISO(c.data_desligamento), 'dd/MM/yyyy')}</TableCell>
                          <TableCell className="text-xs">{c.retention_months} meses</TableCell>
                          <TableCell className="text-xs text-destructive">{format(parseISO(c.retention_end_date), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline" size="sm" className="h-7 text-xs text-destructive gap-1"
                              onClick={() => {
                                if (confirm('Anonimizar este perfil? Ação irreversível.')) {
                                  anonymizeMutation.mutate(c.archive_id);
                                }
                              }}
                              disabled={anonymizeMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3" /> Anonimizar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Legal Basis Dialog */}
      {editBasis !== null && (
        <EditLegalBasisDialog
          basis={editBasis}
          onSave={(b) => saveBasisMutation.mutate(b)}
          onClose={() => setEditBasis(null)}
          isPending={saveBasisMutation.isPending}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Edit Legal Basis Dialog
// ═══════════════════════════════════════

function EditLegalBasisDialog({
  basis,
  onSave,
  onClose,
  isPending,
}: {
  basis: Partial<LgpdLegalBasis>;
  onSave: (b: any) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [category, setCategory] = useState(basis.data_category || '');
  const [basisType, setBasisType] = useState(basis.legal_basis_type || 'obrigacao_legal');
  const [article, setArticle] = useState(basis.lgpd_article || 'Art. 7º, II');
  const [description, setDescription] = useState(basis.description || '');
  const [months, setMonths] = useState(basis.retention_period_months ?? 60);
  const [active, setActive] = useState(basis.is_active ?? true);

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{basis.id ? 'Editar Base Legal' : 'Nova Base Legal'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Categoria de Dados</Label>
            <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Ex: dados_pessoais" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Tipo de Base Legal</Label>
              <Input value={basisType} onChange={e => setBasisType(e.target.value)} placeholder="obrigacao_legal" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Artigo LGPD</Label>
              <Input value={article} onChange={e => setArticle(e.target.value)} placeholder="Art. 7º, II" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Descrição / Justificativa</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Prazo de Retenção (meses)</Label>
              <Input type="number" value={months} onChange={e => setMonths(Number(e.target.value))} min={1} />
              <p className="text-[10px] text-muted-foreground">{Math.round(months / 12)} anos</p>
            </div>
            <div className="space-y-1.5 flex items-end pb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="rounded" />
                <span className="text-sm">Ativa</span>
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => onSave({
              ...(basis.id ? { id: basis.id } : {}),
              data_category: category,
              legal_basis_type: basisType,
              lgpd_article: article,
              description,
              retention_period_months: months,
              is_active: active,
            })}
            disabled={isPending || !category || !description}
            className="gap-1.5"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
