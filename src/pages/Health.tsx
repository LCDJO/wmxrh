import { useHealthPrograms, useHealthExams } from '@/domains/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PROGRAM_LABELS: Record<string, string> = { pcmso: 'PCMSO', pgr: 'PGR', ltcat: 'LTCAT', ppra: 'PPRA' };
const EXAM_LABELS: Record<string, string> = { admissional: 'Admissional', periodico: 'Periódico', demissional: 'Demissional', mudanca_funcao: 'Mudança Função', retorno_trabalho: 'Retorno' };
const RESULT_LABELS: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' }> = {
  apto: { label: 'Apto', variant: 'default' },
  inapto: { label: 'Inapto', variant: 'destructive' },
  apto_restricao: { label: 'Apto c/ Restrição', variant: 'secondary' },
};

export default function Health() {
  const { data: programs = [], isLoading: loadingPrograms } = useHealthPrograms();
  const { data: exams = [], isLoading: loadingExams } = useHealthExams();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Saúde Ocupacional</h1>
        <p className="text-muted-foreground">Programas, exames e controle de ASOs</p>
      </div>

      <Tabs defaultValue="programs">
        <TabsList>
          <TabsTrigger value="programs">Programas ({programs.length})</TabsTrigger>
          <TabsTrigger value="exams">Exames / ASOs ({exams.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="programs" className="mt-4">
          {loadingPrograms ? <p className="text-muted-foreground">Carregando...</p> : programs.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum programa cadastrado.</CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {programs.map(p => {
                const isExpired = new Date(p.valid_until) < new Date();
                return (
                  <Card key={p.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{p.name}</CardTitle>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-[10px]">{PROGRAM_LABELS[p.program_type]}</Badge>
                          <Badge variant={isExpired ? 'destructive' : 'default'} className="text-[10px]">{isExpired ? 'Vencido' : 'Vigente'}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground space-y-1">
                      <p>Validade: {new Date(p.valid_from).toLocaleDateString('pt-BR')} — {new Date(p.valid_until).toLocaleDateString('pt-BR')}</p>
                      {p.responsible_name && <p>Responsável: {p.responsible_name} ({p.responsible_registration})</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="exams" className="mt-4">
          {loadingExams ? <p className="text-muted-foreground">Carregando...</p> : exams.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum exame registrado.</CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {exams.map(e => {
                const r = RESULT_LABELS[e.result] || { label: e.result, variant: 'secondary' as const };
                return (
                  <Card key={e.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{EXAM_LABELS[e.exam_type] || e.exam_type}</CardTitle>
                        <Badge variant={r.variant} className="text-[10px]">{r.label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground space-y-1">
                      <p>Data: {new Date(e.exam_date).toLocaleDateString('pt-BR')}</p>
                      {e.expiry_date && <p>Validade: {new Date(e.expiry_date).toLocaleDateString('pt-BR')}</p>}
                      {e.physician_name && <p>Médico: {e.physician_name} — CRM {e.physician_crm}</p>}
                      {e.cbo_code && <p>CBO: {e.cbo_code}</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
