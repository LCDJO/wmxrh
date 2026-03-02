/**
 * TimeTrackingPage — Controle de Ponto com banco de horas inteligente
 */
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, AlertTriangle, TrendingUp, Calendar, Timer, Plus } from 'lucide-react';

export default function TimeTrackingPage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Controle de Ponto</h1>
          <p className="text-muted-foreground">Banco de horas inteligente, regras configuráveis e alertas automáticos</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Registrar Ponto
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Registros Hoje</p>
                <p className="text-2xl font-bold text-foreground">0</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-2/10">
                <Timer className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Banco de Horas</p>
                <p className="text-2xl font-bold text-foreground">0h</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Alertas Ativos</p>
                <p className="text-2xl font-bold text-foreground">0</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-4/10">
                <TrendingUp className="h-5 w-5 text-chart-4" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Horas Extras (Mês)</p>
                <p className="text-2xl font-bold text-foreground">0h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="bank">Banco de Horas</TabsTrigger>
          <TabsTrigger value="rules">Regras</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Registros Recentes
              </CardTitle>
              <CardDescription>Últimos registros de ponto dos colaboradores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-lg font-medium">Nenhum registro encontrado</p>
                <p className="text-sm">Os registros de ponto aparecerão aqui quando forem criados.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank">
          <Card>
            <CardHeader>
              <CardTitle>Banco de Horas Inteligente</CardTitle>
              <CardDescription>Créditos e débitos com expiração automática (CLT Art. 59)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Timer className="h-12 w-12 mb-4 opacity-30" />
                <p>Nenhuma entrada no banco de horas.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>Regras Configuráveis</CardTitle>
              <CardDescription>Jornada padrão, tolerâncias, intervalos e adicional noturno</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Jornada Diária', value: '8h', desc: 'CLT Art. 58' },
                  { label: 'Tolerância', value: '10 min', desc: 'CLT Art. 58 §1' },
                  { label: 'Intervalo Mínimo', value: '1h', desc: 'CLT Art. 71' },
                  { label: 'Adicional Noturno', value: '20%', desc: 'CLT Art. 73' },
                ].map(rule => (
                  <Card key={rule.label} className="border-dashed">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{rule.label}</p>
                          <p className="text-xs text-muted-foreground">{rule.desc}</p>
                        </div>
                        <Badge variant="secondary">{rule.value}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Alertas Automáticos</CardTitle>
              <CardDescription>Monitoramento de irregularidades e conformidade</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mb-4 opacity-30" />
                <p>Nenhum alerta ativo no momento.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
