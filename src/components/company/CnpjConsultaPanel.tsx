import { useState } from 'react';
import { Search, ShieldCheck, AlertTriangle, BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cnpjDataResolverService } from '@/domains/occupational-intelligence/cnpj-data-resolver.service';
import { classifyCnae, mapRiskCategories, parseCnaeDivision, getGrauRiscoLabel } from '@/domains/occupational-intelligence/cnae-risk-classifier';
import { getApplicableNrs } from '@/domains/occupational-intelligence/nr-training-mapper';
import { suggestCbos } from '@/domains/occupational-intelligence/cbo-suggester';
import type { GrauRisco, NrRequirement, CboSuggestion } from '@/domains/occupational-intelligence/types';

interface CnaeConsultResult {
  cnae_principal: string;
  descricao_atividade: string;
  grau_risco: GrauRisco;
  grau_risco_label: string;
  nrs_aplicaveis: NrRequirement[];
  cbos_sugeridos: CboSuggestion[];
}

interface CnpjConsultaPanelProps {
  cnpj: string;
  onCnpjChange: (v: string) => void;
  onResultReady?: (result: CnaeConsultResult) => void;
}

const RISK_COLORS: Record<number, string> = {
  1: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  2: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  3: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  4: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

export function CnpjConsultaPanel({ cnpj, onCnpjChange, onResultReady }: CnpjConsultaPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CnaeConsultResult | null>(null);

  const handleConsultar = async () => {
    const cleaned = cnpj.replace(/\D/g, '');
    if (cleaned.length !== 14) {
      setError('CNPJ deve ter 14 dígitos.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const resolved = await cnpjDataResolverService.resolveCNPJ(cnpj);
      if (!resolved) {
        setError('Não foi possível consultar este CNPJ. Verifique se está correto.');
        return;
      }

      const cnaeInfo = classifyCnae(resolved.cnae_principal, resolved.descricao_atividade);
      const division = parseCnaeDivision(resolved.cnae_principal);
      const nrs = getApplicableNrs(cnaeInfo.grau_risco);
      const cbos = suggestCbos(division);

      const consultResult: CnaeConsultResult = {
        cnae_principal: resolved.cnae_principal,
        descricao_atividade: resolved.descricao_atividade,
        grau_risco: cnaeInfo.grau_risco,
        grau_risco_label: getGrauRiscoLabel(cnaeInfo.grau_risco),
        nrs_aplicaveis: nrs,
        cbos_sugeridos: cbos,
      };

      setResult(consultResult);
      onResultReady?.(consultResult);
    } catch (err) {
      setError('Erro ao consultar CNPJ. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* CNPJ Input + Button */}
      <div className="flex gap-2">
        <Input
          value={cnpj}
          onChange={e => onCnpjChange(e.target.value)}
          placeholder="00.000.000/0000-00"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleConsultar}
          disabled={loading || cnpj.replace(/\D/g, '').length < 14}
          className="gap-2 shrink-0"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Consultar CNAE
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </p>
      )}

      {/* Results Panel */}
      {result && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4 animate-fade-in">
          {/* Header: CNAE + Risk */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">CNAE Principal</p>
              <p className="text-sm font-semibold text-foreground">{result.cnae_principal}</p>
              <p className="text-xs text-muted-foreground">{result.descricao_atividade}</p>
            </div>
            <div className={`px-3 py-1.5 rounded-md text-xs font-bold ${RISK_COLORS[result.grau_risco]}`}>
              Risco {result.grau_risco} — {result.grau_risco_label}
            </div>
          </div>

          {/* NRs */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              NRs Aplicáveis ({result.nrs_aplicaveis.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {result.nrs_aplicaveis.map(nr => (
                <Badge
                  key={nr.nr_number}
                  variant={nr.priority === 'obrigatoria' ? 'default' : 'secondary'}
                  className="text-[10px]"
                >
                  NR-{nr.nr_number}
                </Badge>
              ))}
            </div>
          </div>

          {/* CBOs */}
          {result.cbos_sugeridos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" />
                Cargos Sugeridos (CBO)
              </p>
              <div className="space-y-1">
                {result.cbos_sugeridos.slice(0, 6).map(s => (
                  <div key={s.cbo.code} className="flex items-center justify-between text-xs rounded-md bg-card px-3 py-1.5">
                    <span className="text-foreground">{s.cbo.title}</span>
                    <span className="text-muted-foreground font-mono">{s.cbo.code}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
