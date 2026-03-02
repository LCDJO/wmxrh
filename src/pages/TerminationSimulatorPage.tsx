/**
 * TerminationSimulatorPage — Simulador de Rescisão com LegalRiskScore
 */
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, ShieldAlert, Scale, FileText, ArrowRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function TerminationSimulatorPage() {
  const [activeTab, setActiveTab] = useState('simulator');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Simulador de Rescisão</h1>
        <p className="text-muted-foreground">Simule cenários de desligamento com análise de risco jurídico</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="simulator">Simulador</TabsTrigger>
          <TabsTrigger value="risk">Risco Jurídico</TabsTrigger>
          <TabsTrigger value="report">Relatório Pré-Demissão</TabsTrigger>
        </TabsList>

        <TabsContent value="simulator">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Aviso Prévio Trabalhado */}
            <Card className="border-chart-2/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calculator className="h-5 w-5 text-chart-2" />
                  Aviso Prévio Trabalhado
                </CardTitle>
                <CardDescription>O colaborador cumpre o período trabalhando</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Saldo Salário</span><span className="font-medium text-foreground">—</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">13º Proporcional</span><span className="font-medium text-foreground">—</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Férias Proporcionais</span><span className="font-medium text-foreground">—</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">FGTS + Multa 40%</span><span className="font-medium text-foreground">—</span></div>
                  <hr className="border-border" />
                  <div className="flex justify-between font-bold"><span>Total Estimado</span><span className="text-chart-2">R$ —</span></div>
                </div>
                <Button variant="outline" className="w-full gap-2" disabled>
                  Simular <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            {/* Aviso Prévio Indenizado */}
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Scale className="h-5 w-5 text-primary" />
                  Aviso Prévio Indenizado
                </CardTitle>
                <CardDescription>O colaborador é dispensado imediatamente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Aviso Indenizado</span><span className="font-medium text-foreground">—</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">13º Proporcional</span><span className="font-medium text-foreground">—</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Férias Proporcionais</span><span className="font-medium text-foreground">—</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">FGTS + Multa 40%</span><span className="font-medium text-foreground">—</span></div>
                  <hr className="border-border" />
                  <div className="flex justify-between font-bold"><span>Total Estimado</span><span className="text-primary">R$ —</span></div>
                </div>
                <Button variant="outline" className="w-full gap-2" disabled>
                  Simular <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            {/* Reversão Judicial */}
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                  Reversão Judicial
                </CardTitle>
                <CardDescription>Custo estimado se Justa Causa for revertida</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Verbas Rescisórias</span><span className="font-medium text-foreground">—</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Indenização Adicional</span><span className="font-medium text-foreground">—</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Dano Moral Estimado</span><span className="font-medium text-foreground">—</span></div>
                  <hr className="border-border" />
                  <div className="flex justify-between font-bold"><span>Risco Total</span><span className="text-destructive">R$ —</span></div>
                </div>
                <Button variant="outline" className="w-full gap-2" disabled>
                  Simular <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground text-center">
                Selecione um colaborador para iniciar a simulação de rescisão com cálculos automáticos baseados na CLT.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                LegalRiskScore
              </CardTitle>
              <CardDescription>Avaliação de 12 fatores de risco baseados na CLT e NRs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-muted-foreground">—</div>
                <div className="flex-1">
                  <Progress value={0} className="h-3" />
                  <p className="text-xs text-muted-foreground mt-1">Score de 0 a 100 (quanto maior, mais seguro)</p>
                </div>
                <Badge variant="secondary">Sem dados</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  'Estabilidade Gestante',
                  'CIPA',
                  'Dirigente Sindical',
                  'Estabilidade Acidentária',
                  'Litígios Ativos',
                  'Exame Demissional (NR-7)',
                  'EPIs Pendentes',
                  'Gradação Disciplinar',
                ].map(factor => (
                  <div key={factor} className="flex items-center gap-2 p-2 rounded-md border border-border">
                    <div className="h-2 w-2 rounded-full bg-muted" />
                    <span className="text-sm text-muted-foreground">{factor}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Relatório Pré-Demissão
              </CardTitle>
              <CardDescription>Histórico disciplinar, advertências, riscos jurídicos e exposição trabalhista</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Advertências', value: '—', color: 'text-chart-4' },
                  { label: 'Suspensões', value: '—', color: 'text-destructive' },
                  { label: 'Exposição (R$)', value: '—', color: 'text-chart-2' },
                  { label: 'Gaps Compliance', value: '—', color: 'text-primary' },
                ].map(stat => (
                  <Card key={stat.label} className="border-dashed">
                    <CardContent className="pt-4 text-center">
                      <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mb-4 opacity-30" />
                <p>Selecione um colaborador para gerar o relatório completo.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
