import { FileText, Plus } from 'lucide-react';
import { usePayrollCatalog } from '@/domains/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const INCIDENCE_LABELS: Record<string, string> = {
  all: 'INSS+IRRF+FGTS', inss: 'INSS', irrf: 'IRRF', fgts: 'FGTS',
  inss_irrf: 'INSS+IRRF', inss_fgts: 'INSS+FGTS', irrf_fgts: 'IRRF+FGTS', none: 'Nenhuma',
};

export default function Compliance() {
  const { data: items = [], isLoading } = usePayrollCatalog();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rubricas</h1>
          <p className="text-muted-foreground">{items.length} rubricas cadastradas</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma rubrica cadastrada.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map(item => (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{item.code} — {item.name}</CardTitle>
                  <Badge variant={item.item_type === 'provento' ? 'default' : 'destructive'} className="text-[10px]">
                    {item.item_type === 'provento' ? 'Provento' : 'Desconto'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground">
                <p>Natureza: {item.nature} | Incidência: {INCIDENCE_LABELS[item.incidence] || item.incidence}</p>
                {item.esocial_code && <p>eSocial: {item.esocial_code}</p>}
                {item.description && <p>{item.description}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
