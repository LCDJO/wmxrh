/**
 * /referral — "Indique e Ganhe" — Tenant-facing referral page.
 */
import ReferralLinkCard from '@/components/referral/ReferralLinkCard';
import ReferralStatsPanel from '@/components/referral/ReferralStatsPanel';
import GamificationProgressBar from '@/components/referral/GamificationProgressBar';
import { Gift } from 'lucide-react';

export default function ReferralPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
          <Gift className="h-6 w-6 text-primary" /> Indique e Ganhe
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compartilhe seu link, acompanhe suas indicações e ganhe recompensas por cada conversão.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ReferralLinkCard />
        <GamificationProgressBar />
      </div>

      <ReferralStatsPanel />
    </div>
  );
}
