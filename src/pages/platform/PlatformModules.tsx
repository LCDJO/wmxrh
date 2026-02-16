import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Puzzle } from 'lucide-react';

export default function PlatformModules() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Puzzle className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Módulos</h1>
          <p className="text-sm text-muted-foreground">Ativação e configuração de módulos por tenant.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Módulos Disponíveis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Funcionalidade em desenvolvimento.</p>
        </CardContent>
      </Card>
    </div>
  );
}
