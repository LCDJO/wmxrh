/**
 * BannedAccountScreen — Full-screen blocker for banned/suspended tenants.
 * Displays enforcement details, allows appeal submission if permitted.
 */
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Ban, ShieldOff, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { getAccountEnforcementEngine } from '@/domains/account-enforcement/account-enforcement-engine';
import type { AccountEnforcement } from '@/domains/account-enforcement/types';

interface Props {
  status: 'banned' | 'suspended' | 'restricted' | 'under_review';
  enforcements: AccountEnforcement[];
}

const STATUS_CONFIG = {
  banned: {
    icon: Ban,
    title: 'Conta Banida',
    description: 'Sua conta foi banida permanentemente. O acesso ao sistema está bloqueado.',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
  suspended: {
    icon: ShieldOff,
    title: 'Conta Suspensa',
    description: 'Sua conta está temporariamente suspensa. O acesso será restaurado após revisão.',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  restricted: {
    icon: AlertTriangle,
    title: 'Conta Restrita',
    description: 'Sua conta possui restrições ativas. Algumas funcionalidades estão indisponíveis.',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
  },
  under_review: {
    icon: AlertTriangle,
    title: 'Conta em Revisão',
    description: 'Sua conta está sob revisão. O acesso pode ser limitado até a conclusão.',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
};

export function BannedAccountScreen({ status, enforcements }: Props) {
  const { signOut } = useAuth();
  const [appealText, setAppealText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [appealSent, setAppealSent] = useState(false);

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  const primaryEnforcement = enforcements[0];
  const canAppeal = status !== 'banned' || enforcements.some(e => !(e as any).is_permanent);

  const handleAppeal = async () => {
    if (!primaryEnforcement || !appealText.trim()) return;
    setSubmitting(true);
    try {
      const engine = getAccountEnforcementEngine();
      await engine.appeal({
        enforcement_id: primaryEnforcement.id,
        appeal_reason: appealText.trim(),
      });
      setAppealSent(true);
      toast.success('Recurso enviado com sucesso. Você será notificado da decisão.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar recurso.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-4">
          <div className={`mx-auto w-16 h-16 rounded-full ${config.bgColor} flex items-center justify-center`}>
            <Icon className={`h-8 w-8 ${config.color}`} />
          </div>
          <CardTitle className="text-xl">{config.title}</CardTitle>
          <CardDescription>{config.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enforcement details */}
          {primaryEnforcement && (
            <div className="rounded-lg border p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Motivo</span>
                <Badge variant="outline">{primaryEnforcement.reason_category}</Badge>
              </div>
              <p className="text-foreground">{primaryEnforcement.reason}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Severidade: {primaryEnforcement.severity}</span>
                <span>{new Date(primaryEnforcement.enforced_at).toLocaleDateString('pt-BR')}</span>
              </div>
              {primaryEnforcement.expires_at && (
                <p className="text-xs text-muted-foreground">
                  Expira em: {new Date(primaryEnforcement.expires_at).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
          )}

          {/* Appeal form */}
          {canAppeal && !appealSent && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Enviar Recurso</h4>
              <Textarea
                placeholder="Descreva os motivos do seu recurso..."
                value={appealText}
                onChange={(e) => setAppealText(e.target.value)}
                rows={4}
              />
              <Button
                onClick={handleAppeal}
                disabled={!appealText.trim() || submitting}
                className="w-full"
              >
                {submitting ? 'Enviando...' : 'Submeter Recurso'}
              </Button>
            </div>
          )}

          {appealSent && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center text-sm">
              <p className="text-primary font-medium">Recurso enviado</p>
              <p className="text-muted-foreground mt-1">Acompanhe o status pelo e-mail cadastrado.</p>
            </div>
          )}

          <Button variant="outline" className="w-full" onClick={() => signOut()}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
