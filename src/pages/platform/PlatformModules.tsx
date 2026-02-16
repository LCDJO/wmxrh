import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Puzzle, Users, DollarSign, Heart, Shield, Activity, FileText, Calculator, FileSignature, Brain, Scale, GraduationCap, Key } from 'lucide-react';
import { PLATFORM_MODULES } from '@/domains/platform/platform-modules';

const ICON_MAP: Record<string, React.ElementType> = {
  Users, DollarSign, Heart, Shield, Activity, FileText, Calculator, FileSignature, Brain, Scale, GraduationCap, Key,
};

export default function PlatformModules() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Puzzle className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Módulos</h1>
          <p className="text-sm text-muted-foreground">
            {PLATFORM_MODULES.length} módulos disponíveis para ativação por tenant.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORM_MODULES.map((mod) => {
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
    </div>
  );
}
