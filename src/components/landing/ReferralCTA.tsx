import { Button } from '@/components/ui/button';
import { Gift, ArrowRight } from 'lucide-react';

interface Props {
  referralCode?: string;
  reward?: string;
  onReferralAction?: (action: 'share' | 'signup' | 'click') => void;
}

export function ReferralCTA({ referralCode, reward = 'R$ 100 de crédito', onReferralAction }: Props) {
  const handleShare = () => {
    onReferralAction?.('share');
  };

  return (
    <section className="py-12 px-6">
      <div className="max-w-3xl mx-auto rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center space-y-4">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 mx-auto">
          <Gift className="h-6 w-6 text-primary" />
        </div>

        <h2 className="text-xl font-bold text-foreground">Indique e ganhe {reward}</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Compartilhe seu link exclusivo. Para cada empresa que assinar, você e ela ganham {reward} em créditos na plataforma.
        </p>

        {referralCode && (
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2">
            <code className="text-xs font-mono text-primary">{referralCode}</code>
          </div>
        )}

        <div>
          <Button className="gap-2" onClick={handleShare}>
            Compartilhar link <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
