import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollText } from 'lucide-react';

export default function PlatformAudit() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <ScrollText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Auditoria</h1>
          <p className="text-sm text-muted-foreground">Logs globais de auditoria da plataforma.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logs de Auditoria</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Funcionalidade em desenvolvimento.</p>
        </CardContent>
      </Card>
    </div>
  );
}
