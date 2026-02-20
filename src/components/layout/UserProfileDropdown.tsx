/**
 * UserProfileDropdown — Avatar dropdown with user info, plan badge, and sign out.
 */

import { useAuth } from '@/contexts/AuthContext';
import { useExperienceProfile } from '@/hooks/use-experience-profile';
import { useSecurityKernel } from '@/domains/security/use-security-kernel';
import { PlanBadge } from '@/components/shared/PlanBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { LogOut, Crown } from 'lucide-react';
import { dualIdentityEngine } from '@/domains/security/kernel/dual-identity-engine';
import { cn } from '@/lib/utils';

export function UserProfileDropdown() {
  const { user, signOut } = useAuth();
  const { profile: expProfile } = useExperienceProfile();
  const { effectiveRoles } = useSecurityKernel();
  const isImpersonating = dualIdentityEngine.isImpersonating;

  const initials = isImpersonating
    ? 'IM'
    : (user?.email?.substring(0, 2).toUpperCase() ?? 'AD');

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

      <PopoverContent align="end" className="w-72 p-0" sideOffset={8}>
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
                {user?.email ?? 'Administrador'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {effectiveRoles.slice(0, 2).map(role => (
                  <span key={role} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent text-accent-foreground uppercase">
                    {role.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Plan section */}
        {expProfile.plan_tier && (
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Crown className="h-4 w-4" />
                <span className="text-xs font-medium">Plano Atual</span>
              </div>
              <PlanBadge tier={expProfile.plan_tier} size="sm" />
            </div>
          </div>
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
