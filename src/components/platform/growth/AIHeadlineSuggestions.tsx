/**
 * AIHeadlineSuggestions — AI-powered headline suggestions for landing pages.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Copy, RefreshCw, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Suggestion {
  headline: string;
  subheadline: string;
  predictedCtr: number;
  tone: 'urgente' | 'confiança' | 'benefício' | 'social_proof';
}

const TONE_STYLES: Record<string, string> = {
  urgente: 'bg-red-500/10 text-red-600 border-red-500/20',
  confiança: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  benefício: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  social_proof: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
};

const MOCK_SUGGESTIONS: Suggestion[] = [
  { headline: 'Automatize seu DP em 5 minutos', subheadline: 'Plataforma completa para gestão de RH, folha e eSocial.', predictedCtr: 8.7, tone: 'benefício' },
  { headline: 'Mais de 500 empresas já migraram', subheadline: 'Junte-se às empresas que eliminaram 40h/mês de trabalho manual.', predictedCtr: 7.9, tone: 'social_proof' },
  { headline: 'Última chance: 30 dias grátis', subheadline: 'Oferta válida até o fim do mês. Comece agora sem cartão de crédito.', predictedCtr: 9.2, tone: 'urgente' },
  { headline: 'RH Inteligente e Seguro', subheadline: 'Certificação SOC 2 + LGPD. Seus dados protegidos por design.', predictedCtr: 6.5, tone: 'confiança' },
];

export function AIHeadlineSuggestions() {
  const [suggestions, setSuggestions] = useState(MOCK_SUGGESTIONS);
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      // Shuffle order to simulate new suggestions
      setSuggestions(prev => [...prev].sort(() => Math.random() - 0.5));
      setLoading(false);
      toast.success('Novas sugestões geradas pela IA');
    }, 1200);
  };

  const handleCopy = (s: Suggestion, idx: number) => {
    navigator.clipboard.writeText(`${s.headline}\n${s.subheadline}`);
    setCopiedIdx(idx);
    toast.success('Copiado para a área de transferência');
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Sugestões de Headline (IA)</CardTitle>
          </div>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            Gerar novas
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((s, i) => (
          <div key={i} className="p-3 rounded-lg border border-border/40 hover:border-primary/30 transition-colors space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{s.headline}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.subheadline}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => handleCopy(s, i)}
              >
                {copiedIdx === i ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn('text-[9px]', TONE_STYLES[s.tone])}>
                {s.tone.replace('_', ' ')}
              </Badge>
              <span className="text-[10px] text-muted-foreground">CTR previsto:</span>
              <span className="text-[10px] font-bold text-primary">{s.predictedCtr}%</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
