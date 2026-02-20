/**
 * UserProfileDropdown — Avatar dropdown with user info, plan badge, profile editing, and sign out.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useExperienceProfile } from '@/hooks/use-experience-profile';
import { useSecurityKernel } from '@/domains/security/use-security-kernel';
import { PlanBadge } from '@/components/shared/PlanBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LogOut, Crown, Pencil, Save, X, Phone, Mail, User, ChevronRight } from 'lucide-react';
import { dualIdentityEngine } from '@/domains/security/kernel/dual-identity-engine';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProfileFormData {
  name: string;
  email: string;
  phone: string;
}

export function UserProfileDropdown() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { currentTenant } = useTenant();
  const { profile: expProfile } = useExperienceProfile();
  const { effectiveRoles } = useSecurityKernel();
  const isImpersonating = dualIdentityEngine.isImpersonating;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProfileFormData>({ name: '', email: '', phone: '' });
  const [membershipId, setMembershipId] = useState<string | null>(null);

  const fetchMembership = useCallback(async () => {
    if (!user?.id || !currentTenant?.id) return;
    const { data } = await supabase
      .from('tenant_memberships')
      .select('id, name, email, phone')
      .eq('user_id', user.id)
      .eq('tenant_id', currentTenant.id)
      .maybeSingle();
    if (data) {
      setMembershipId(data.id);
      setForm({
        name: (data as any).name ?? '',
        email: (data as any).email ?? user.email ?? '',
        phone: (data as any).phone ?? '',
      });
    } else {
      setForm({ name: '', email: user.email ?? '', phone: '' });
    }
  }, [user?.id, currentTenant?.id, user?.email]);

  useEffect(() => { fetchMembership(); }, [fetchMembership]);

  const handleSave = async () => {
    if (!membershipId) {
      toast.error('Perfil de membro não encontrado.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('tenant_memberships')
      .update({ name: form.name, email: form.email, phone: form.phone })
      .eq('id', membershipId);
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar perfil: ' + error.message);
    } else {
      toast.success('Perfil atualizado com sucesso.');
      setEditing(false);
    }
  };

  const displayName = form.name || user?.email || 'Administrador';
  const initials = isImpersonating
    ? 'IM'
    : (form.name
        ? form.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
        : (user?.email?.substring(0, 2).toUpperCase() ?? 'AD'));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="focus:outline-none rounded-full">
          <Avatar className={cn(
            "h-9 w-9 border-2 cursor-pointer transition-shadow hover:shadow-md",
            isImpersonating ? 'border-[hsl(var(--impersonation))]' : 'border-primary/20'
          )}>
            <AvatarFallback className={cn(
              "text-sm font-semibold",
              isImpersonating
                ? 'bg-[hsl(var(--impersonation))] text-[hsl(var(--impersonation-foreground))]'
                : 'bg-primary text-primary-foreground'
            )}>
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* User info header */}
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-border">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">
                {displayName}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {effectiveRoles.slice(0, 2).map(role => (
                  <span key={role} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent text-accent-foreground uppercase">
                    {role.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Editar perfil"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Edit form */}
        {editing && (
          <div className="px-4 py-3 border-b border-border space-y-2.5">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nome completo"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="E-mail"
                type="email"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="Telefone"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setEditing(false); fetchMembership(); }}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3 mr-1" /> Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="h-7 text-xs"
              >
                <Save className="h-3 w-3 mr-1" /> {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        )}

        {/* Plan section — clickable → /plans */}
        {expProfile.plan_tier && (
          <button
            onClick={() => navigate('/plans')}
            className="w-full px-4 py-3 border-b border-border hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Crown className="h-4 w-4" />
                <span className="text-xs font-medium">Plano Atual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <PlanBadge tier={expProfile.plan_tier} size="sm" />
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              </div>
            </div>
          </button>
        )}

        {/* Actions */}
        <div className="p-1.5">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sair</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
