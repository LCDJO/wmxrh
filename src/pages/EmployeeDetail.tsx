/**
 * EmployeeDetail — Simplified profile card + consolidated Ficha Completa hub.
 *
 * All 13 previous tabs were consolidated into the FichaTrabalhadorTab
 * organized in 6 logical groups: Cadastro, Contrato & Trabalho,
 * Remuneração, SST & Compliance, Documentos Legais, Governança.
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { usePermissions } from '@/domains/security';
import { useEmployee, useUpdateEmployee } from '@/domains/hooks';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Mail, Phone, Calendar, Building2, FileText, Pencil, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FichaTrabalhadorTab } from '@/components/employee/FichaTrabalhadorTab';

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const tenantId = currentTenant?.id;
  const { data: employee } = useEmployee(id!);
  const updateEmployee = useUpdateEmployee();
  const { canManageEmployees, canManageCompensation } = usePermissions();

  // Edit employee state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [editHireDate, setEditHireDate] = useState('');
  const [editStatus, setEditStatus] = useState('');

  const openEditDialog = () => {
    if (!employee) return;
    setEditName(employee.name || '');
    setEditEmail(employee.email || '');
    setEditPhone(employee.phone || '');
    setEditCpf(employee.cpf || '');
    setEditHireDate(employee.hire_date ? employee.hire_date.split('T')[0] : '');
    setEditStatus(employee.status || 'active');
    setEditOpen(true);
  };

  const handleUpdateEmployee = () => {
    if (!id) return;
    updateEmployee.mutate({
      id,
      name: editName,
      email: editEmail || null,
      phone: editPhone || null,
      cpf: editCpf || null,
      hire_date: editHireDate || null,
      status: editStatus,
    }, {
      onSuccess: () => { toast({ title: 'Colaborador atualizado!' }); setEditOpen(false); },
      onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  if (!employee) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Carregando...</p>
        <Button variant="ghost" onClick={() => navigate('/employees')} className="mt-4">Voltar</Button>
      </div>
    );
  }

  const initials = employee.name.split(' ').map(n => n[0]).slice(0, 2).join('');

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" onClick={() => navigate('/employees')} className="gap-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ═══════════ Profile Card ═══════════ */}
        <div className="bg-card rounded-xl shadow-card p-6">
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-20 w-20 mb-4">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">{initials}</AvatarFallback>
            </Avatar>
            <h2 className="text-xl font-bold font-display text-card-foreground">{employee.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">{employee.positions?.title || '—'}</p>
            <div className="mt-3"><StatusBadge status={employee.status} /></div>
          </div>

          {/* Edit button */}
          {canManageEmployees && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={openEditDialog}>
                <Pencil className="h-3.5 w-3.5" /> Editar Colaborador
              </Button>
            </div>
          )}

          <div className="mt-6 space-y-3 border-t border-border pt-5">
            {employee.email && <div className="flex items-center gap-3 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /><span className="text-card-foreground">{employee.email}</span></div>}
            {employee.phone && <div className="flex items-center gap-3 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /><span className="text-card-foreground">{employee.phone}</span></div>}
            {employee.hire_date && <div className="flex items-center gap-3 text-sm"><Calendar className="h-4 w-4 text-muted-foreground" /><span className="text-card-foreground">Admissão: {new Date(employee.hire_date).toLocaleDateString('pt-BR')}</span></div>}
            {employee.companies?.name && <div className="flex items-center gap-3 text-sm"><Building2 className="h-4 w-4 text-muted-foreground" /><span className="text-card-foreground">{employee.companies.name}</span></div>}
            {employee.departments?.name && <div className="flex items-center gap-3 text-sm"><Building2 className="h-4 w-4 text-muted-foreground" /><span className="text-card-foreground">{employee.departments.name}</span></div>}
            {employee.cpf && <div className="flex items-center gap-3 text-sm"><FileText className="h-4 w-4 text-muted-foreground" /><span className="text-card-foreground">CPF: {employee.cpf}</span></div>}
          </div>

          {/* Quick salary summary */}
          <div className="mt-5 border-t border-border pt-5 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Salário Base</span>
              <span className="font-semibold text-card-foreground">R$ {(employee.base_salary || 0).toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Salário Atual</span>
              <span className="font-bold text-primary">R$ {(employee.current_salary || 0).toLocaleString('pt-BR')}</span>
            </div>
          </div>

          {/* Behavioral Profile Button */}
          <div className="mt-5 border-t border-border pt-5">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => navigate(`/fleet-behavior-profile?employee=${id}`)}
            >
              <Activity className="h-4 w-4" />
              Ver Perfil Comportamental
            </Button>
          </div>
        </div>

        {/* ═══════════ Ficha Completa — Hub Central ═══════════ */}
        <div className="lg:col-span-3">
          {tenantId && id ? (
            <FichaTrabalhadorTab
              employeeId={id}
              tenantId={tenantId}
              canEdit={canManageEmployees}
              employee={employee}
              canManageCompensation={canManageCompensation}
            />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Dados não disponíveis.</p>
          )}
        </div>
      </div>

      {/* ═══════════ Edit Employee Dialog ═══════════ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Editar Colaborador — {employee.name}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); handleUpdateEmployee(); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={editName} onChange={e => setEditName(e.target.value)} required /></div>
              <div className="space-y-2"><Label>CPF</Label><Input value={editCpf} onChange={e => setEditCpf(e.target.value)} /></div>
              <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input value={editPhone} onChange={e => setEditPhone(e.target.value)} /></div>
              <div className="space-y-2"><Label>Data Admissão</Label><Input type="date" value={editHireDate} onChange={e => setEditHireDate(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                    <SelectItem value="on_leave">Afastado</SelectItem>
                    <SelectItem value="terminated">Desligado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={updateEmployee.isPending}>
              {updateEmployee.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
