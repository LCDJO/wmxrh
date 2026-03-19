import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowUpRight,
  Bot,
  Brain,
  Briefcase,
  FileText,
  GripVertical,
  MapPinned,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { StatsCard } from '@/components/shared/StatsCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { TalentTopNav } from '@/modules/talent-hub/TalentTopNav';
import { TalentFiltersBar } from '@/modules/talent-hub/TalentFiltersBar';
import { RiskBadge } from '@/modules/talent-hub/RiskBadge';
import { PipelineStageBadge } from '@/modules/talent-hub/PipelineStageBadge';
import { TalentMonetizationView } from '@/modules/talent-hub/TalentMonetizationView';
import { TalentUsageBanner } from '@/modules/talent-hub/TalentUsageBanner';
import { talentUsageSnapshot } from '@/modules/talent-hub/monetization-data';
import { talentAiSignals, talentCandidates, talentJobs, talentPipelineDistribution, talentTrend } from '@/modules/talent-hub/mock-data';
import type { Candidate, CandidateStage, Job, TalentView } from '@/modules/talent-hub/types';
import { cn } from '@/lib/utils';

const stageOrder: CandidateStage[] = ['novo', 'triagem', 'entrevista', 'proposta', 'contratado'];

const stageLabels: Record<CandidateStage, string> = {
  novo: 'Novo',
  triagem: 'Triagem',
  entrevista: 'Entrevista',
  proposta: 'Proposta',
  contratado: 'Contratado',
};

const stageSurfaceClass: Record<CandidateStage, string> = {
  novo: 'bg-secondary/70 border-border',
  triagem: 'bg-accent/70 border-border',
  entrevista: 'bg-primary/5 border-primary/10',
  proposta: 'bg-warning/10 border-[hsl(var(--warning))]/20',
  contratado: 'bg-primary/10 border-primary/15',
};

const chartPalette = ['hsl(var(--secondary-foreground))', 'hsl(var(--accent-foreground))', 'hsl(var(--primary))', 'hsl(var(--warning))', 'hsl(var(--success))'];

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function scoreRadarData(candidate: Candidate) {
  return [
    { subject: 'Total', value: candidate.score.total },
    { subject: 'Técnico', value: candidate.score.technical },
    { subject: 'Comport.', value: candidate.score.behavioral },
    { subject: 'Aderência', value: candidate.score.aderencia },
    { subject: 'Risco', value: 100 - candidate.score.risk },
  ];
}

function TalentHero({ totalCandidates, avgScore }: { totalCandidates: number; avgScore: number }) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-border bg-card p-6 shadow-card lg:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--accent))_0%,transparent_35%),radial-gradient(circle_at_bottom_left,hsl(var(--secondary))_0%,transparent_45%)]" />
      <div className="relative grid gap-6 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
        <div className="space-y-4">
          <Badge className="rounded-full border-transparent bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            Talent Intelligence Hub
          </Badge>
          <div className="space-y-3">
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-foreground lg:text-5xl">
              Banco de Talentos com visão operacional, risco e inteligência visual em uma única camada.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground lg:text-base">
              Estrutura inspirada em suítes corporativas modernas: visão executiva, busca inteligente, pipeline e perfil analítico do candidato.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button className="rounded-xl">Criar shortlist</Button>
            <Button variant="outline" className="rounded-xl">Exportar visão analítica</Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background/90 p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Base ativa</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{totalCandidates}</p>
            <p className="mt-1 text-sm text-muted-foreground">candidatos monitorados</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/90 p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Score médio</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{avgScore}</p>
            <p className="mt-1 text-sm text-muted-foreground">aderência consolidada</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CandidateMap({ candidates }: { candidates: Candidate[] }) {
  return (
    <Card className="overflow-hidden rounded-[24px] shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl"><MapPinned className="h-5 w-5 text-primary" /> Mapa de candidatos</CardTitle>
        <CardDescription>Heatmap simplificado por concentração geográfica e risco.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative h-[320px] overflow-hidden rounded-[20px] border border-border bg-[linear-gradient(180deg,hsl(var(--secondary))_0%,hsl(var(--background))_100%)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_30%,hsl(var(--accent-foreground)/0.12),transparent_18%),radial-gradient(circle_at_78%_58%,hsl(var(--primary)/0.12),transparent_18%),linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px),linear-gradient(hsl(var(--border))_1px,transparent_1px)] bg-[length:auto,auto,56px_56px,56px_56px]" />
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
              style={{ left: `${candidate.location.x}%`, top: `${candidate.location.y}%` }}
            >
              <span
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-background/80',
                  candidate.risk === 'alto' && 'bg-destructive',
                  candidate.risk === 'médio' && 'bg-[hsl(var(--warning))]',
                  candidate.risk === 'baixo' && 'bg-primary',
                )}
              />
              <span className="rounded-full bg-background/90 px-2 py-1 text-[10px] font-medium text-foreground shadow-sm">
                {candidate.city}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CandidateModal({ candidate, open, onOpenChange }: { candidate: Candidate | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!candidate) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden rounded-[28px] border-border p-0">
        <ScrollArea className="max-h-[92vh]">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="border-b border-border p-6 lg:border-b-0 lg:border-r">
              <DialogHeader className="text-left">
                <DialogTitle className="text-2xl font-bold text-foreground">{candidate.name}</DialogTitle>
                <DialogDescription className="text-sm leading-6">
                  {candidate.role} · {candidate.city}/{candidate.state} · {candidate.age} anos
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Card className="rounded-2xl shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Dados pessoais</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p><span className="font-medium text-foreground">Email:</span> {candidate.email}</p>
                    <p><span className="font-medium text-foreground">Telefone:</span> {candidate.phone}</p>
                    <p><span className="font-medium text-foreground">Origem:</span> {candidate.origin}</p>
                    <p><span className="font-medium text-foreground">Resumo:</span> {candidate.summary}</p>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Documentos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {candidate.documents.map((doc) => (
                      <div key={doc.id} className="rounded-xl border border-border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{doc.title}</p>
                            <p className="text-xs text-muted-foreground">{doc.type} · {doc.updatedAt}</p>
                          </div>
                          <Badge className="rounded-full border-transparent bg-secondary px-2.5 py-1 text-secondary-foreground">
                            {doc.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <div className="mt-6">
                <Tabs defaultValue="timeline">
                  <TabsList className="grid w-full grid-cols-3 rounded-xl">
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    <TabsTrigger value="scores">Score detalhado</TabsTrigger>
                    <TabsTrigger value="enrichment">Enriquecimento</TabsTrigger>
                  </TabsList>
                  <TabsContent value="timeline" className="mt-4 space-y-3">
                    {candidate.timeline.map((event) => (
                      <div key={event.id} className="rounded-2xl border border-border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{event.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{event.date}</span>
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                  <TabsContent value="scores" className="mt-4">
                    <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
                      <div className="h-[260px] rounded-2xl border border-border p-3">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={scoreRadarData(candidate)}>
                            <PolarGrid stroke="hsl(var(--border))" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-3">
                        {[
                          ['Score total', candidate.score.total],
                          ['Técnico', candidate.score.technical],
                          ['Comportamental', candidate.score.behavioral],
                          ['Aderência', candidate.score.aderencia],
                          ['Risco invertido', 100 - candidate.score.risk],
                        ].map(([label, value]) => (
                          <div key={label} className="space-y-2 rounded-2xl border border-border p-4">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-foreground">{label}</span>
                              <span className="text-muted-foreground">{value}</span>
                            </div>
                            <Progress value={Number(value)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="enrichment" className="mt-4 space-y-3">
                    {candidate.enrichments.map((enrichment) => (
                      <div key={enrichment.source} className="rounded-2xl border border-border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{enrichment.source}</p>
                            <p className="text-xs text-muted-foreground">Atualizado em {enrichment.updatedAt}</p>
                          </div>
                          <Badge className="rounded-full border-transparent bg-accent px-2.5 py-1 text-accent-foreground">
                            {enrichment.status}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {Object.entries(enrichment.data).map(([key, value]) => (
                            <div key={key} className="rounded-xl bg-secondary/60 p-3 text-sm">
                              <span className="block text-xs uppercase tracking-[0.16em] text-muted-foreground">{key}</span>
                              <span className="mt-1 block font-medium text-foreground">{Array.isArray(value) ? value.join(', ') : String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            <div className="p-6">
              <div className="rounded-[24px] border border-border bg-secondary/50 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Insights visuais de IA</p>
                <div className="mt-4 space-y-3">
                  {candidate.aiInsights.map((insight) => (
                    <div key={insight.title} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{insight.text}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-[24px] border border-border p-5">
                <p className="text-sm font-semibold text-foreground">Tags estratégicas</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {candidate.skills.map((skill) => (
                    <Badge key={skill} className="rounded-full border-transparent bg-secondary px-3 py-1 text-secondary-foreground">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-[24px] border border-border p-5">
                <p className="text-sm font-semibold text-foreground">Notas do recrutador</p>
                <Textarea className="mt-3 min-h-[140px]" placeholder="Adicionar insight humano, objeções ou próximos passos..." />
                <Button className="mt-3 w-full rounded-xl">Salvar anotação</Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function DashboardView({ candidates, onOpenCandidate, onOpenMonetization }: { candidates: Candidate[]; onOpenCandidate: (candidate: Candidate) => void; onOpenMonetization: () => void }) {
  const totalCandidates = candidates.length;
  const avgScore = Math.round(candidates.reduce((acc, candidate) => acc + candidate.score.total, 0) / candidates.length);
  const averageRisk = Math.round(candidates.reduce((acc, candidate) => acc + candidate.score.risk, 0) / candidates.length);

  return (
    <div className="space-y-6">
      <TalentHero totalCandidates={totalCandidates} avgScore={avgScore} />
      <TalentUsageBanner snapshot={talentUsageSnapshot} onOpenMonetization={onOpenMonetization} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Total de candidatos" value={totalCandidates} subtitle="Base ativa do tenant" icon={Users} trend={{ value: 12, label: 'vs. último mês' }} />
        <StatsCard title="Entrevistas em curso" value={candidates.filter((candidate) => candidate.stage === 'entrevista').length} subtitle="Pipeline aquecido" icon={Target} trend={{ value: 8, label: 'últimos 7 dias' }} />
        <StatsCard title="Score médio" value={avgScore} subtitle="Aderência consolidada" icon={Brain} trend={{ value: 5, label: 'qualidade do pool' }} />
        <StatsCard title="Risco médio" value={averageRisk} subtitle="Quanto menor, melhor" icon={Bot} trend={{ value: -9, label: 'melhoria de compliance' }} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="rounded-[24px] shadow-card">
          <CardHeader>
            <CardTitle className="text-xl">Fluxo de candidatos x score médio</CardTitle>
            <CardDescription>Comparativo mensal entre volume captado e qualidade média do funil.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={talentTrend}>
                <defs>
                  <linearGradient id="scoreFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Area yAxisId="right" type="monotone" dataKey="score" stroke="hsl(var(--primary))" fill="url(#scoreFill)" strokeWidth={2.5} />
                <Bar yAxisId="left" dataKey="candidatos" radius={[10, 10, 0, 0]} fill="hsl(var(--accent-foreground))" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] shadow-card">
          <CardHeader>
            <CardTitle className="text-xl">Insights de IA</CardTitle>
            <CardDescription>Leituras visuais para priorização da equipe.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {talentAiSignals.map((signal) => (
              <div key={signal.title} className="rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{signal.title}</p>
                  <span className="text-sm font-semibold text-primary">{signal.value}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{signal.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <CandidateMap candidates={candidates} />
        <Card className="rounded-[24px] shadow-card">
          <CardHeader>
            <CardTitle className="text-xl">Etapas do pipeline</CardTitle>
            <CardDescription>Distribuição visual por coluna operacional.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={talentPipelineDistribution} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="stage" type="category" tickLine={false} axisLine={false} tickFormatter={(value: CandidateStage) => stageLabels[value]} tick={{ fill: 'hsl(var(--muted-foreground))' }} width={94} />
                <Bar dataKey="total" radius={10}>
                  {talentPipelineDistribution.map((entry, index) => (
                    <Cell key={entry.stage} fill={chartPalette[index % chartPalette.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[24px] shadow-card">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-xl">Candidatos em destaque</CardTitle>
            <CardDescription>Perfis com melhor combinação entre aderência, prontidão e risco.</CardDescription>
          </div>
          <Button variant="outline" className="rounded-xl">Ver shortlist completa</Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-3">
            {candidates.slice(0, 3).map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => onOpenCandidate(candidate)}
                className="rounded-[24px] border border-border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-card-hover"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-foreground">{candidate.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{candidate.role}</p>
                  </div>
                  <RiskBadge risk={candidate.risk} compact />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <PipelineStageBadge stage={candidate.stage} />
                  <Badge className="rounded-full border-transparent bg-secondary px-2.5 py-1 text-secondary-foreground">{candidate.origin}</Badge>
                </div>
                <div className="mt-5 rounded-2xl bg-secondary/60 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Score total</p>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <span className="text-4xl font-bold text-foreground">{candidate.score.total}</span>
                    <ArrowUpRight className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{candidate.aiInsights[0]?.text}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CandidatesView({ candidates, search, onSearch, onOpenCandidate }: { candidates: Candidate[]; search: string; onSearch: (value: string) => void; onOpenCandidate: (candidate: Candidate) => void }) {
  return (
    <div className="space-y-5">
      <TalentFiltersBar search={search} onSearch={onSearch} />
      <Card className="rounded-[24px] shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Lista de candidatos</CardTitle>
          <CardDescription>Tabela operacional com score, risco, origem e acesso rápido ao perfil completo.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Risco</TableHead>
                <TableHead>Local</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((candidate) => (
                <TableRow key={candidate.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{candidate.name}</p>
                      <p className="text-xs text-muted-foreground">{candidate.role}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold text-foreground">{candidate.score.total}</span>
                      <Progress value={candidate.score.total} className="w-24" />
                    </div>
                  </TableCell>
                  <TableCell><PipelineStageBadge stage={candidate.stage} /></TableCell>
                  <TableCell className="capitalize text-muted-foreground">{candidate.origin}</TableCell>
                  <TableCell><RiskBadge risk={candidate.risk} compact /></TableCell>
                  <TableCell className="text-muted-foreground">{candidate.city}/{candidate.state}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" className="rounded-xl" onClick={() => onOpenCandidate(candidate)}>Abrir perfil</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileView({ candidate, onOpenCandidate }: { candidate: Candidate; onOpenCandidate: (candidate: Candidate) => void }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[24px] shadow-card">
          <CardHeader>
            <CardTitle className="text-xl">Perfil do candidato</CardTitle>
            <CardDescription>Dados pessoais, score detalhado, timeline e enriquecimento em profundidade.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border p-5">
              <p className="text-2xl font-bold text-foreground">{candidate.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{candidate.role}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <PipelineStageBadge stage={candidate.stage} />
                <RiskBadge risk={candidate.risk} compact />
                <Badge className="rounded-full border-transparent bg-secondary px-2.5 py-1 text-secondary-foreground">{candidate.origin}</Badge>
              </div>
              <div className="mt-5 space-y-2 text-sm text-muted-foreground">
                <p>{candidate.email}</p>
                <p>{candidate.phone}</p>
                <p>{candidate.city}/{candidate.state}</p>
              </div>
              <Button className="mt-5 rounded-xl" onClick={() => onOpenCandidate(candidate)}>Abrir modal completo</Button>
            </div>
            <div className="rounded-2xl border border-border p-5">
              <p className="text-sm font-semibold text-foreground">Resumo executivo</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{candidate.summary}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {candidate.skills.map((skill) => (
                  <Badge key={skill} className="rounded-full border-transparent bg-accent px-3 py-1 text-accent-foreground">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] shadow-card">
          <CardHeader>
            <CardTitle className="text-xl">Score detalhado</CardTitle>
            <CardDescription>Leitura rápida dos vetores de decisão.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={scoreRadarData(candidate)}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.18} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-[24px] shadow-card">
          <CardHeader>
            <CardTitle className="text-xl">Timeline</CardTitle>
            <CardDescription>Histórico de interações e decisões.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {candidate.timeline.map((event) => (
              <div key={event.id} className="rounded-2xl border border-border p-4">
                <p className="text-sm font-semibold text-foreground">{event.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">{event.date}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="rounded-[24px] shadow-card">
          <CardHeader>
            <CardTitle className="text-xl">Dados enriquecidos</CardTitle>
            <CardDescription>Abas por fonte e sinais de risco.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={candidate.enrichments[0]?.source ?? 'Receita Federal'}>
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 rounded-xl bg-transparent p-0">
                {candidate.enrichments.map((enrichment) => (
                  <TabsTrigger key={enrichment.source} value={enrichment.source} className="rounded-full border border-border bg-card px-3 py-2 data-[state=active]:bg-accent">
                    {enrichment.source}
                  </TabsTrigger>
                ))}
              </TabsList>
              {candidate.enrichments.map((enrichment) => (
                <TabsContent key={enrichment.source} value={enrichment.source} className="mt-4 grid gap-3 md:grid-cols-2">
                  {Object.entries(enrichment.data).map(([key, value]) => (
                    <div key={key} className="rounded-2xl border border-border p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{key}</p>
                      <p className="mt-2 text-sm font-medium text-foreground">{Array.isArray(value) ? value.join(', ') : String(value)}</p>
                    </div>
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PipelineView({ candidates, onOpenCandidate }: { candidates: Candidate[]; onOpenCandidate: (candidate: Candidate) => void }) {
  const [board, setBoard] = useState<Candidate[]>(candidates);

  const moveCandidate = (candidateId: string, stage: CandidateStage) => {
    setBoard((current) => current.map((candidate) => (candidate.id === candidateId ? { ...candidate, stage } : candidate)));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Pipeline Kanban</h2>
          <p className="text-sm text-muted-foreground">Drag and drop nativo para mover candidatos entre etapas.</p>
        </div>
        <Button variant="outline" className="rounded-xl">Automatizar próxima ação</Button>
      </div>
      <div className="grid gap-4 xl:grid-cols-5">
        {stageOrder.map((stage) => {
          const columnCandidates = board.filter((candidate) => candidate.stage === stage);
          return (
            <div
              key={stage}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const candidateId = event.dataTransfer.getData('text/plain');
                if (candidateId) moveCandidate(candidateId, stage);
              }}
              className={cn('min-h-[520px] rounded-[24px] border p-4', stageSurfaceClass[stage])}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{stageLabels[stage]}</p>
                  <p className="text-xs text-muted-foreground">{columnCandidates.length} candidatos</p>
                </div>
                <PipelineStageBadge stage={stage} />
              </div>
              <div className="space-y-3">
                {columnCandidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData('text/plain', candidate.id)}
                    onClick={() => onOpenCandidate(candidate)}
                    className="w-full rounded-[20px] border border-border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{candidate.name}</p>
                        <p className="text-xs text-muted-foreground">{candidate.role}</p>
                      </div>
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <RiskBadge risk={candidate.risk} compact />
                      <Badge className="rounded-full border-transparent bg-secondary px-2.5 py-1 text-secondary-foreground">{candidate.score.total}</Badge>
                    </div>
                    <Progress value={candidate.score.total} className="mt-4" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JobsView({ jobs, candidates }: { jobs: Job[]; candidates: Candidate[] }) {
  const [selectedJobId, setSelectedJobId] = useState(jobs[0]?.id ?? '');
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0];
  const relatedCandidates = candidates.filter((candidate) => selectedJob && candidate.linkedJobIds.includes(selectedJob.id));

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card className="rounded-[24px] shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Lista de vagas</CardTitle>
          <CardDescription>Visão rápida do portfólio de posições e volume de candidatos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobs.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => setSelectedJobId(job.id)}
              className={cn(
                'w-full rounded-[22px] border p-4 text-left transition-all',
                selectedJob?.id === job.id ? 'border-primary bg-accent/50 shadow-sm' : 'border-border bg-card hover:border-primary/30',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{job.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{job.department} · {job.location}</p>
                </div>
                <Badge className="rounded-full border-transparent bg-secondary px-2.5 py-1 text-secondary-foreground">{job.status}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <span>{job.applicants} candidatos</span>
                <span>{job.openDays} dias</span>
                <span>{job.seniority}</span>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      {selectedJob && (
        <Card className="rounded-[24px] shadow-card">
          <CardHeader>
            <CardTitle className="text-xl">Detalhes da vaga</CardTitle>
            <CardDescription>{selectedJob.title}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Faixa salarial</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{selectedJob.salaryRange}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Resumo</p>
                <p className="mt-2 text-sm text-muted-foreground">{selectedJob.summary}</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Requisitos</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedJob.requirements.map((requirement) => (
                  <Badge key={requirement} className="rounded-full border-transparent bg-accent px-3 py-1 text-accent-foreground">
                    {requirement}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Candidatos por vaga</p>
              <div className="mt-3 space-y-3">
                {relatedCandidates.map((candidate) => (
                  <div key={candidate.id} className="rounded-2xl border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{candidate.name}</p>
                        <p className="text-xs text-muted-foreground">{candidate.city}/{candidate.state}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <PipelineStageBadge stage={candidate.stage} />
                        <Badge className="rounded-full border-transparent bg-secondary px-2.5 py-1 text-secondary-foreground">{candidate.score.total}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SettingsView() {
  const scoreWeights = [
    { label: 'Peso técnico', value: 40 },
    { label: 'Peso comportamental', value: 25 },
    { label: 'Peso aderência', value: 20 },
    { label: 'Peso risco', value: 15 },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <Card className="rounded-[24px] shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Pesos de score</CardTitle>
          <CardDescription>Ajuste visual dos vetores usados pela triagem inteligente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {scoreWeights.map((item) => (
            <div key={item.label} className="space-y-2 rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{item.label}</span>
                <span className="text-muted-foreground">{item.value}%</span>
              </div>
              <Progress value={item.value} />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="rounded-[24px] shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Integrações</CardTitle>
          <CardDescription>Conectores visuais e status operacional.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            ['Receita Federal', 'Ativa', 'Conector principal para validação cadastral'],
            ['CNJ / TST', 'Fallback', 'Busca complementar jurídica com fallback público'],
            ['LGPD', 'Ativa', 'Fluxos de consentimento, retenção e esquecimento'],
          ].map(([title, status, description]) => (
            <div key={title} className="rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <Badge className="rounded-full border-transparent bg-accent px-2.5 py-1 text-accent-foreground">{status}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="rounded-[24px] shadow-card xl:col-span-2">
        <CardHeader>
          <CardTitle className="text-xl">LGPD</CardTitle>
          <CardDescription>Retenção, consentimento e direito ao esquecimento com foco operacional.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Consentimento ativo</p>
            <p className="mt-2 text-3xl font-bold text-foreground">96%</p>
            <p className="mt-1 text-sm text-muted-foreground">dos perfis com base legal registrada</p>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Esquecimento pendente</p>
            <p className="mt-2 text-3xl font-bold text-foreground">3</p>
            <p className="mt-1 text-sm text-muted-foreground">requisições aguardando aprovação</p>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Retenção média</p>
            <p className="mt-2 text-3xl font-bold text-foreground">180d</p>
            <p className="mt-1 text-sm text-muted-foreground">janela padrão por política do tenant</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TalentHub() {
  const { currentTenant } = useTenant();
  const [activeView, setActiveView] = useState<TalentView>('dashboard');
  const [search, setSearch] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(talentCandidates[0] ?? null);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);

  const filteredCandidates = useMemo(() => {
    const term = normalizeText(search.trim());
    if (!term) return talentCandidates;

    return talentCandidates.filter((candidate) => {
      const haystack = normalizeText([
        candidate.name,
        candidate.role,
        candidate.city,
        candidate.state,
        candidate.origin,
        candidate.summary,
        ...candidate.skills,
      ].join(' '));

      return haystack.includes(term);
    });
  }, [search]);

  const openCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setCandidateModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Recrutamento / Talent Intelligence</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Banco de Talentos</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Workspace moderno para {currentTenant?.name ?? 'o tenant atual'} com dashboard, lista, perfil, pipeline, vagas, monetização e governança do banco de talentos.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="rounded-xl"><FileText className="h-4 w-4" /> Exportar</Button>
          <Button className="rounded-xl"><Briefcase className="h-4 w-4" /> Nova vaga</Button>
        </div>
      </div>

      <TalentTopNav active={activeView} onChange={setActiveView} />

      {activeView === 'dashboard' && <DashboardView candidates={filteredCandidates} onOpenCandidate={openCandidate} onOpenMonetization={() => setActiveView('settings')} />}
      {activeView === 'candidates' && <CandidatesView candidates={filteredCandidates} search={search} onSearch={setSearch} onOpenCandidate={openCandidate} />}
      {activeView === 'profile' && selectedCandidate && <ProfileView candidate={selectedCandidate} onOpenCandidate={openCandidate} />}
      {activeView === 'pipeline' && <PipelineView candidates={filteredCandidates} onOpenCandidate={openCandidate} />}
      {activeView === 'jobs' && <JobsView jobs={talentJobs} candidates={talentCandidates} />}
      {activeView === 'settings' && (
        <div className="space-y-6">
          <TalentMonetizationView currentPlan={talentUsageSnapshot} />
          <SettingsView />
        </div>
      )}

      <CandidateModal candidate={selectedCandidate} open={candidateModalOpen} onOpenChange={setCandidateModalOpen} />
    </div>
  );
}
