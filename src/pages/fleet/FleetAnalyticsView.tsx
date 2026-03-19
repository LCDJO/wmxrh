/**
 * FleetAnalyticsView — Analytics dashboard for fleet compliance.
 * Charts: Infractions by period, Driver ranking, Avg score by sector, Historical heatmap.
 * Filters: Period, Sector, Infraction type, Vehicle.
 */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  BarChart3, TrendingUp, Users, MapPin, Filter, Calendar,
  Car, AlertTriangle, Shield, Search, Award, Flame,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import { cn } from '@/lib/utils';

// ── Mock data generators ──
const SECTORS = ['Operações', 'Logística', 'Manutenção', 'Campo', 'Administrativo'];
const INFRACTION_TYPES = ['overspeed', 'harsh_brake', 'route_deviation', 'geofence', 'idle_excess'];
const TYPE_LABELS: Record<string, string> = {
  overspeed: 'Excesso Velocidade',
  harsh_brake: 'Freada Brusca',
  route_deviation: 'Desvio de Rota',
  geofence: 'Geofence',
  idle_excess: 'Ociosidade',
};
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const WEEKS = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'];
const COLORS = ['hsl(var(--primary))', '#f59e0b', '#ef4444', '#22c55e', '#8b5cf6', '#06b6d4'];
const PIE_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4'];

function seedRand(seed: number) {
  return () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function generateInfractionsByPeriod(period: string, typeFilter: string, sectorFilter: string) {
  const rand = seedRand(42 + period.length + typeFilter.length + sectorFilter.length);
  const labels = period === 'week' ? ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
    : period === 'month' ? WEEKS
    : period === 'quarter' ? MONTHS.slice(0, 3)
    : MONTHS;

  return labels.map(label => ({
    name: label,
    overspeed: Math.floor(rand() * 25 + 3),
    harsh_brake: Math.floor(rand() * 15 + 1),
    route_deviation: Math.floor(rand() * 10 + 1),
    geofence: Math.floor(rand() * 8),
    idle_excess: Math.floor(rand() * 12 + 2),
  }));
}

function generateDriverRanking(sectorFilter: string) {
  const rand = seedRand(77 + sectorFilter.length);
  const drivers = [
    'João Silva', 'Maria Santos', 'Carlos Lima', 'Ana Costa', 'Pedro Alves',
    'Fernanda Reis', 'Lucas Mendes', 'Roberto Dias', 'Juliana Ferreira', 'Rafael Oliveira',
  ];
  return drivers.map(name => ({
    name: name.split(' ')[0],
    fullName: name,
    score: Math.floor(rand() * 55 + 30),
    infractions: Math.floor(rand() * 20 + 1),
    sector: SECTORS[Math.floor(rand() * SECTORS.length)],
  })).sort((a, b) => b.infractions - a.infractions);
}

function generateScoreBySector() {
  const rand = seedRand(123);
  return SECTORS.map(sector => ({
    name: sector,
    score: Math.floor(rand() * 40 + 45),
    employees: Math.floor(rand() * 30 + 10),
    trend: rand() > 0.5 ? 'up' : 'down',
  }));
}

function generateHeatmapData() {
  const rand = seedRand(999);
  const data: { sector: string; type: string; value: number }[] = [];
  SECTORS.forEach(sector => {
    INFRACTION_TYPES.forEach(type => {
      data.push({ sector, type, value: Math.floor(rand() * 30) });
    });
  });
  return data;
}

function generateInfractionDistribution() {
  const rand = seedRand(555);
  return INFRACTION_TYPES.map((type, i) => ({
    name: TYPE_LABELS[type],
    value: Math.floor(rand() * 40 + 10),
    color: PIE_COLORS[i],
  }));
}

function generateTrendData(period: string) {
  const rand = seedRand(222 + period.length);
  const labels = period === 'week' ? ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
    : period === 'month' ? WEEKS
    : MONTHS;
  return labels.map(label => ({
    name: label,
    score: Math.floor(rand() * 25 + 55),
    incidents: Math.floor(rand() * 15 + 2),
  }));
}

// ── Heatmap Cell ──
function HeatCell({ value, max }: { value: number; max: number }) {
  const intensity = max > 0 ? value / max : 0;
  const bg = intensity > 0.7 ? 'bg-red-500' : intensity > 0.4 ? 'bg-amber-500' : intensity > 0.1 ? 'bg-emerald-500' : 'bg-muted';
  const opacity = Math.max(0.15, intensity);
  return (
    <div
      className={cn("h-9 w-full rounded flex items-center justify-center text-xs font-semibold", bg)}
      style={{ opacity }}
      title={`${value} ocorrências`}
    >
      {value > 0 ? value : ''}
    </div>
  );
}

// ── Custom Tooltip ──
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold text-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function FleetAnalyticsView() {
  const [period, setPeriod] = useState('month');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [vehicleSearch, setVehicleSearch] = useState('');

  const infractions = useMemo(() => generateInfractionsByPeriod(period, typeFilter, sectorFilter), [period, typeFilter, sectorFilter]);
  const driverRanking = useMemo(() => generateDriverRanking(sectorFilter), [sectorFilter]);
  const sectorScores = useMemo(() => generateScoreBySector(), []);
  const heatmapData = useMemo(() => generateHeatmapData(), []);
  const pieData = useMemo(() => generateInfractionDistribution(), []);
  const trendData = useMemo(() => generateTrendData(period), [period]);

  const heatmapMax = Math.max(...heatmapData.map(d => d.value), 1);

  const filteredRanking = useMemo(() => {
    let list = driverRanking;
    if (sectorFilter !== 'all') list = list.filter(d => d.sector === sectorFilter);
    if (vehicleSearch) {
      const q = vehicleSearch.toLowerCase();
      list = list.filter(d => d.fullName.toLowerCase().includes(q));
    }
    return list;
  }, [driverRanking, sectorFilter, vehicleSearch]);

  const summaryStats = useMemo(() => ({
    totalInfractions: infractions.reduce((sum, row) => sum + row.overspeed + row.harsh_brake + row.route_deviation + row.geofence + row.idle_excess, 0),
    avgScore: Math.round(sectorScores.reduce((s, x) => s + x.score, 0) / sectorScores.length),
    worstSector: sectorScores.reduce((a, b) => a.score < b.score ? a : b).name,
    topOffender: filteredRanking[0]?.fullName ?? '—',
  }), [infractions, sectorScores, filteredRanking]);

  // Bars to show based on type filter
  const visibleTypes = typeFilter === 'all' ? INFRACTION_TYPES : [typeFilter];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Analytics — Frota & Compliance
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Análise de infrações, scores e tendências · Dados simulados</p>
        </div>
      </div>

      {/* Filters bar */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Filter className="h-3.5 w-3.5" /> Filtros:
            </div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[150px] h-9">
                <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Última Semana</SelectItem>
                <SelectItem value="month">Último Mês</SelectItem>
                <SelectItem value="quarter">Trimestre</SelectItem>
                <SelectItem value="year">Ano</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="w-[160px] h-9">
                <Users className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Setores</SelectItem>
                {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <AlertTriangle className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {INFRACTION_TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar motorista..."
                value={vehicleSearch}
                onChange={e => setVehicleSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            {(sectorFilter !== 'all' || typeFilter !== 'all' || vehicleSearch) && (
              <Button variant="ghost" size="sm" onClick={() => { setSectorFilter('all'); setTypeFilter('all'); setVehicleSearch(''); }}>
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Infrações', value: summaryStats.totalInfractions, icon: AlertTriangle, color: 'text-destructive' },
          { label: 'Score Médio', value: summaryStats.avgScore, icon: Shield, color: summaryStats.avgScore >= 60 ? 'text-emerald-500' : 'text-amber-500' },
          { label: 'Pior Setor', value: summaryStats.worstSector, icon: Flame, color: 'text-destructive' },
          { label: 'Maior Infrator', value: summaryStats.topOffender, icon: Award, color: 'text-amber-500' },
        ].map(s => (
          <Card key={s.label} className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center bg-muted/50", s.color)}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold text-foreground">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 1: Infractions by Period + Distribution Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Infrações por Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={infractions} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                {visibleTypes.includes('overspeed') && <Bar dataKey="overspeed" name="Excesso Vel." fill="#ef4444" radius={[2, 2, 0, 0]} />}
                {visibleTypes.includes('harsh_brake') && <Bar dataKey="harsh_brake" name="Freada Brusca" fill="#f59e0b" radius={[2, 2, 0, 0]} />}
                {visibleTypes.includes('route_deviation') && <Bar dataKey="route_deviation" name="Desvio Rota" fill="#3b82f6" radius={[2, 2, 0, 0]} />}
                {visibleTypes.includes('geofence') && <Bar dataKey="geofence" name="Geofence" fill="#8b5cf6" radius={[2, 2, 0, 0]} />}
                {visibleTypes.includes('idle_excess') && <Bar dataKey="idle_excess" name="Ociosidade" fill="#06b6d4" radius={[2, 2, 0, 0]} />}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" />
              Distribuição por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Score Trend + Score by Sector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Tendência de Score & Incidentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="score" name="Score Médio" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} strokeWidth={2} />
                <Area type="monotone" dataKey="incidents" name="Incidentes" stroke="#ef4444" fill="#ef4444" fillOpacity={0.08} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Score Médio por Setor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={sectorScores} layout="vertical" barSize={20}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={90} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="score" name="Score" radius={[0, 4, 4, 0]}>
                  {sectorScores.map((entry, i) => (
                    <Cell key={i} fill={entry.score >= 70 ? '#22c55e' : entry.score >= 50 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Driver Ranking + Historical Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Driver Ranking */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" />
                Ranking de Motoristas
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">{filteredRanking.length} motoristas</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[350px] overflow-y-auto divide-y divide-border">
              {filteredRanking.map((d, i) => {
                const scoreColor = d.score >= 70 ? 'text-emerald-500' : d.score >= 40 ? 'text-amber-500' : 'text-destructive';
                return (
                  <div key={d.fullName} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <span className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      i === 0 ? "bg-destructive/20 text-destructive" :
                      i < 3 ? "bg-amber-500/20 text-amber-500" : "bg-muted text-muted-foreground"
                    )}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{d.fullName}</p>
                      <p className="text-[10px] text-muted-foreground">{d.sector}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">{d.infractions}</p>
                      <p className="text-[10px] text-muted-foreground">infrações</p>
                    </div>
                    <div className={cn("text-right shrink-0 min-w-[50px]", scoreColor)}>
                      <p className="text-sm font-bold">{d.score}</p>
                      <p className="text-[10px]">score</p>
                    </div>
                  </div>
                );
              })}
              {filteredRanking.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">Nenhum resultado</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Historical Heatmap */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Heatmap Histórico — Setor × Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-1 text-muted-foreground font-medium w-24">Setor</th>
                    {INFRACTION_TYPES.map(t => (
                      <th key={t} className="text-center py-2 px-1 text-muted-foreground font-medium">{TYPE_LABELS[t].split(' ')[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SECTORS.map(sector => (
                    <tr key={sector}>
                      <td className="py-1 px-1 font-medium text-foreground">{sector}</td>
                      {INFRACTION_TYPES.map(type => {
                        const cell = heatmapData.find(d => d.sector === sector && d.type === type);
                        return (
                          <td key={type} className="py-1 px-1">
                            <HeatCell value={cell?.value ?? 0} max={heatmapMax} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-3 mt-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 opacity-30" /> Baixo</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500 opacity-60" /> Médio</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 opacity-90" /> Alto</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
