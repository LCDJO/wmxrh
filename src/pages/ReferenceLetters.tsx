/**
 * Reference Letters Dashboard
 *
 * HR can request, review eligibility, track dual-signature flow,
 * and view/download signed letters.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useQueryScope } from '@/domains/hooks';
import { usePermissions } from '@/domains/security';
import { useAuth } from '@/contexts/AuthContext';
import {
  listReferenceLetters,
  requestReferenceLetter,
  signAsManager,
  signAsHR,
  cancelLetter,
  STATUS_LABELS,
  STATUS_COLORS,
  LETTER_TEMPLATES,
} from '@/domains/reference-letter';
import type { ReferenceLetter, ReferenceLetterStatus } from '@/domains/reference-letter';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  FileText, Plus, Loader2, Eye, PenLine, XCircle,
  CheckCircle2, Clock, Shield, Search, UserCheck,
} from 'lucide-react';

export default function ReferenceLetters() {
  const qs = useQueryScope();
  const { user } = useAuth();
  const { canManageEmployees } = usePermissions();
  const queryClient = useQueryClient();

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<ReferenceLetter | null>(null);
  const [signDialog, setSignDialog] = useState<{ letter: ReferenceLetter; role: 'manager' | 'hr' } | null>(null);
  const [signNote, setSignNote] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // ── Queries ──
  const { data: letters = [], isLoading } = useQuery({
    queryKey: ['reference_letters', qs?.tenantId],
    queryFn: () => listReferenceLetters(qs!.tenantId),
    enabled: !!qs?.tenantId,
  });

  // ── Mutations ──
  const signMutation = useMutation({
    mutationFn: async ({ letterId, role, note }: { letterId: string; role: 'manager' | 'hr'; note?: string }) => {
      if (role === 'manager') return signAsManager(letterId, user!.id, note);
      return signAsHR(letterId, user!.id, note);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference_letters'] });
      toast.success('Carta assinada com sucesso');
      setSignDialog(null);
      setSignNote('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelLetter(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference_letters'] });
      toast.success('Carta cancelada');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Filter ──
  const filtered = letters.filter(l => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return l.employee_id.toLowerCase().includes(q) ||
      (l.purpose || '').toLowerCase().includes(q) ||
      STATUS_LABELS[l.status as ReferenceLetterStatus].toLowerCase().includes(q);
  });

  if (!canManageEmployees) {
    return (
      <div className="flex items-center justify-center py-24">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-3">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Acesso Restrito</h2>
            <p className="text-sm text-muted-foreground">Você não tem permissão para gerenciar cartas de referência.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Cartas de Referência</h1>
            <p className="text-sm text-muted-foreground">Solicite, assine e gerencie cartas de referência profissional</p>
          </div>
        </div>
        <Button onClick={() => setShowNewDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Solicitação
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(['pending_manager_signature', 'pending_hr_signature', 'signed', 'eligibility_denied'] as ReferenceLetterStatus[]).map(s => (
          <Card key={s}>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-foreground">{letters.filter(l => l.status === s).length}</p>
              <p className="text-xs text-muted-foreground">{STATUS_LABELS[s]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter + Table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Solicitações</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhuma carta de referência encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Finalidade</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Solicitado em</TableHead>
                  <TableHead className="w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(letter => (
                  <TableRow key={letter.id}>
                    <TableCell className="font-medium text-sm">{letter.employee_id.slice(0, 8)}...</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{letter.purpose || '—'}</TableCell>
                    <TableCell className="text-sm">
                      <Badge variant="outline" className="text-[10px]">
                        {LETTER_TEMPLATES[letter.template_key]?.label || letter.template_key}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${STATUS_COLORS[letter.status as ReferenceLetterStatus] || ''}`}>
                        {STATUS_LABELS[letter.status as ReferenceLetterStatus] || letter.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(parseISO(letter.created_at), 'dd/MM/yy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedLetter(letter)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {letter.status === 'pending_manager_signature' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-chart-4" onClick={() => setSignDialog({ letter, role: 'manager' })}>
                            <PenLine className="h-4 w-4" />
                          </Button>
                        )}
                        {letter.status === 'pending_hr_signature' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-chart-3" onClick={() => setSignDialog({ letter, role: 'hr' })}>
                            <PenLine className="h-4 w-4" />
                          </Button>
                        )}
                        {!['signed', 'delivered', 'cancelled', 'eligibility_denied'].includes(letter.status) && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => cancelMutation.mutate(letter.id)}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Request Dialog */}
      {showNewDialog && <NewRequestDialog tenantId={qs!.tenantId} userId={user!.id} onClose={() => setShowNewDialog(false)} />}

      {/* View Letter Dialog */}
      {selectedLetter && (
        <Dialog open onOpenChange={o => { if (!o) setSelectedLetter(null); }}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> Carta de Referência
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1">
              {/* Eligibility info */}
              <div className="mb-4 p-3 rounded-md border border-border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Elegibilidade</p>
                <p className="text-sm text-foreground">{selectedLetter.eligibility_reason || '—'}</p>
              </div>

              {/* Signature status */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 rounded-md border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Gestor Direto</p>
                  {selectedLetter.manager_signed_at ? (
                    <div className="flex items-center gap-1.5 text-chart-2 text-sm">
                      <CheckCircle2 className="h-4 w-4" /> Assinado em {format(parseISO(selectedLetter.manager_signed_at), 'dd/MM/yy HH:mm')}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                      <Clock className="h-4 w-4" /> Pendente
                    </div>
                  )}
                </div>
                <div className="p-3 rounded-md border border-border">
                  <p className="text-xs text-muted-foreground mb-1">RH / Admin</p>
                  {selectedLetter.hr_signed_at ? (
                    <div className="flex items-center gap-1.5 text-chart-2 text-sm">
                      <CheckCircle2 className="h-4 w-4" /> Assinado em {format(parseISO(selectedLetter.hr_signed_at), 'dd/MM/yy HH:mm')}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                      <Clock className="h-4 w-4" /> Pendente
                    </div>
                  )}
                </div>
              </div>

              <Separator className="my-4" />

              {/* Letter content */}
              {selectedLetter.content_html ? (
                <div className="border border-border rounded-md p-4 bg-background" dangerouslySetInnerHTML={{ __html: selectedLetter.content_html }} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Carta não gerada (colaborador inelegível).</p>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {/* Sign Dialog */}
      {signDialog && (
        <Dialog open onOpenChange={o => { if (!o) { setSignDialog(null); setSignNote(''); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PenLine className="h-5 w-5" />
                Assinar como {signDialog.role === 'manager' ? 'Gestor Direto' : 'RH / Admin'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Observação (opcional)</Label>
                <Textarea
                  value={signNote}
                  onChange={e => setSignNote(e.target.value)}
                  placeholder="Ex: Confirmo a recomendação..."
                  rows={3}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Ao assinar, você confirma a veracidade das informações contidas na carta de referência.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setSignDialog(null); setSignNote(''); }}>Cancelar</Button>
              <Button
                onClick={() => signMutation.mutate({ letterId: signDialog.letter.id, role: signDialog.role, note: signNote })}
                disabled={signMutation.isPending}
                className="gap-2"
              >
                {signMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                Assinar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// New Request Dialog
// ═══════════════════════════════════════

function NewRequestDialog({ tenantId, userId, onClose }: { tenantId: string; userId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: employees = [] } = useQuery({
    queryKey: ['employees_for_ref', tenantId, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('employees')
        .select('id, name, status')
        .eq('tenant_id', tenantId)
        .limit(20);
      if (searchTerm.trim()) {
        query = query.ilike('name', `%${searchTerm}%`);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const requestMutation = useMutation({
    mutationFn: () => requestReferenceLetter({ tenant_id: tenantId, employee_id: employeeId, requested_by: userId, purpose }),
    onSuccess: (letter) => {
      queryClient.invalidateQueries({ queryKey: ['reference_letters'] });
      if (letter.is_eligible) {
        toast.success('Carta criada — aguardando assinatura do gestor');
      } else {
        toast.warning(`Inelegível: ${letter.eligibility_reason}`);
      }
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Carta de Referência</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Colaborador</Label>
            <Input placeholder="Buscar por nome..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            {employees.length > 0 && (
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} ({e.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Finalidade (opcional)</Label>
            <Textarea value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Ex: Processo seletivo externo" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => requestMutation.mutate()} disabled={!employeeId || requestMutation.isPending} className="gap-2">
            {requestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Solicitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
