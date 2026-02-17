/**
 * ReferralLinkCard — Card para o usuário copiar/gerenciar seu link de indicação.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Link2, Copy, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { getRevenueIntelligenceEngine } from '@/domains/revenue-intelligence';
import type { ReferralLink } from '@/domains/revenue-intelligence';
import { useAuth } from '@/contexts/AuthContext';

export default function ReferralLinkCard() {
  const { user } = useAuth();
  const [link, setLink] = useState<ReferralLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const engine = getRevenueIntelligenceEngine();

  useEffect(() => {
    if (!user?.id) return;
    engine.referral.getLinks(user.id).then(links => {
      setLink(links[0] ?? null);
      setLoading(false);
    });
  }, [user?.id]);

  const handleGenerate = async () => {
    if (!user?.id) return;
    try {
      const newLink = await engine.referral.generateLink(user.id);
      setLink(newLink);
      toast.success('Link de indicação criado!');
    } catch {
      toast.error('Erro ao criar link');
    }
  };

  const handleCopy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link.url);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <Card><CardContent className="pt-5"><Skeleton className="h-24 w-full" /></CardContent></Card>;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" /> Seu Link de Indicação
        </CardTitle>
      </CardHeader>
      <CardContent>
        {link ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                readOnly
                value={link.url}
                className="font-mono text-xs bg-muted/50"
              />
              <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={handleCopy}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Compartilhe este link e ganhe recompensas a cada indicação convertida.
            </p>
          </div>
        ) : (
          <div className="text-center py-4 space-y-3">
            <p className="text-sm text-muted-foreground">Você ainda não tem um link de indicação.</p>
            <Button size="sm" className="gap-1.5" onClick={handleGenerate}>
              <Plus className="h-3.5 w-3.5" /> Gerar Meu Link
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
