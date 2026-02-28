/**
 * /platform/governance/appeals — Policy Appeals Management
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Scale, Inbox } from 'lucide-react';

export default function GovernanceAppeals() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Appeals</h1>
        <p className="text-sm text-muted-foreground">Recursos e apelações contra ações de enforcement.</p>
      </div>

      <ScrollArea className="h-[calc(100vh-220px)]">
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base font-medium text-foreground">Fila de Apelações</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma apelação pendente.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Apelações serão exibidas aqui quando tenants contestarem ações de enforcement.
              </p>
            </div>
          </CardContent>
        </Card>
      </ScrollArea>
    </div>
  );
}
