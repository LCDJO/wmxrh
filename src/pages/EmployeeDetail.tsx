/**
 * EmployeeDetail — Simplified profile card + consolidated Ficha Completa hub.
 *
 * All 13 previous tabs were consolidated into the FichaTrabalhadorTab
 * organized in 6 logical groups: Cadastro, Contrato & Trabalho,
 * Remuneração, SST & Compliance, Documentos Legais, Governança.
 */
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { usePermissions } from '@/domains/security';
import { useEmployee } from '@/domains/hooks';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, Phone, Calendar, Building2, FileText } from 'lucide-react';
import { FichaTrabalhadorTab } from '@/components/employee/FichaTrabalhadorTab';

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const { data: employee } = useEmployee(id!);
  const { canManageEmployees, canManageCompensation } = usePermissions();

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
    </div>
  );
}
