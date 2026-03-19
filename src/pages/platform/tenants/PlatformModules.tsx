import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Puzzle, Users, DollarSign, Heart, Shield, Activity, FileText, Calculator,
  FileSignature, Brain, Scale, GraduationCap, Key, Settings, CreditCard,
  Zap, Monitor, BarChart3, Headphones, Megaphone, Rocket, Layout, Globe,
  TrendingUp, Server, Briefcase,
} from 'lucide-react';
import { PLATFORM_MODULES, getDomainModules, getPlatformModules } from '@/domains/platform/platform-modules';

const ICON_MAP: Record<string, React.ElementType> = {
  Users, DollarSign, Heart, Shield, Activity, FileText, Calculator,
  FileSignature, Brain, Scale, GraduationCap, Key, Settings, CreditCard,
  Zap, Monitor, BarChart3, Headphones, Megaphone, Rocket, Layout, Globe,
  TrendingUp,
};

const CATEGORY_META = {
  domain: { label: 'RH / Gestão de Pessoas', icon: Briefcase, badge: 'Domínio', badgeClass: 'bg-primary/10 text-primary border-primary/20' },
  platform: { label: 'Infraestrutura SaaS', icon: Server, badge: 'Plataforma', badgeClass: 'bg-accent/60 text-accent-foreground border-accent/30' },
} as const;

export default function PlatformModules() {
  const domainModules = getDomainModules();
  const platformModules = getPlatformModules();

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Puzzle className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Módulos</h1>
          <p className="text-sm text-muted-foreground">
            {PLATFORM_MODULES.length} módulos — {domainModules.length} de domínio RH · {platformModules.length} de plataforma SaaS.
          </p>
        </div>
      </div>

      {([
        { modules: domainModules, cat: 'domain' as const },
        { modules: platformModules, cat: 'platform' as const },
      ]).map(({ modules, cat }) => {
        const meta = CATEGORY_META[cat];
        const CatIcon = meta.icon;
        return (
          <section key={cat} className="space-y-4">
            <div className="flex items-center gap-2">
              <CatIcon className="h-4.5 w-4.5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">{meta.label}</h2>
              <Badge variant="outline" className={`ml-1 text-[10px] ${meta.badgeClass}`}>
                {modules.length}
              </Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((mod) => {
                const Icon = ICON_MAP[mod.icon] ?? Puzzle;
                return (
                  <Card key={mod.key} className="group hover:shadow-md transition-shadow">
                    <CardContent className="pt-5 pb-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{mod.label}</p>
                            <Badge variant="outline" className="mt-1 text-[10px] font-mono">{mod.key}</Badge>
                          </div>
                        </div>
                        <Switch disabled className="mt-1" />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{mod.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
