/**
 * MandatoryPolicyScreen — Full-screen blocker that requires policy acceptance.
 * Displayed when a tenant has pending mandatory policies.
 * No access to the system until all policies are explicitly accepted.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { getPlatformPolicyGovernanceEngine } from '@/domains/platform-policy-governance';
import type { PendingPolicy } from '@/domains/platform-policy-governance/types';
import { useTenant } from '@/contexts/TenantContext';

interface Props {
  pending: PendingPolicy[];
  onAccepted: () => void;
}

export function MandatoryPolicyScreen({ pending, onAccepted }: Props) {
  const { currentTenant } = useTenant();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const current = pending[currentIndex];
  if (!current) return null;

  const isLast = currentIndex === pending.length - 1;

  const handleAccept = async () => {
    if (!currentTenant?.id) return;
    setSubmitting(true);

    try {
      const engine = getPlatformPolicyGovernanceEngine();
      await engine.accept({
        policy_id: current.policy.id,
        policy_version_id: current.currentVersion.id,
        tenant_id: currentTenant.id,
        acceptance_method: 'click',
      });

      if (isLast) {
        toast.success('Todas as políticas foram aceitas.');
        onAccepted();
      } else {
        setCurrentIndex(i => i + 1);
        setChecked(false);
      }
    } catch (err) {
      toast.error('Erro ao registrar aceite. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl border-border shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <Shield className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl font-semibold text-foreground">
            Aceite Obrigatório de Política
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {pending.length > 1
              ? `Política ${currentIndex + 1} de ${pending.length} — Você precisa aceitar todas para continuar.`
              : 'Você precisa aceitar esta política para acessar o sistema.'}
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">{current.policy.name}</p>
              <p className="text-xs text-muted-foreground">
                Versão {current.currentVersion.version_number} • Vigência: {current.currentVersion.effective_from
                  ? new Date(current.currentVersion.effective_from).toLocaleDateString('pt-BR')
                  : 'Imediata'}
              </p>
            </div>
          </div>

          {current.graceDeadline && (
            <div className="flex items-center gap-2 rounded-md bg-warning/10 border border-warning/20 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <p className="text-xs text-warning">
                Prazo limite: {new Date(current.graceDeadline).toLocaleDateString('pt-BR')}
              </p>
            </div>
          )}

          <ScrollArea className="h-64 rounded-md border border-border bg-card p-4">
            <SafeHtml
              html={current.currentVersion.content_html}
              className="prose prose-sm max-w-none text-foreground"
            />
          </ScrollArea>

          <div className="flex items-start gap-3 pt-2">
            <Checkbox
              id="policy-accept"
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
            />
            <label htmlFor="policy-accept" className="text-sm text-foreground cursor-pointer leading-snug">
              Li e aceito integralmente os termos da política <strong>"{current.policy.name}"</strong> (v{current.currentVersion.version_number}).
            </label>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end">
          <Button
            onClick={handleAccept}
            disabled={!checked || submitting}
            className="min-w-[140px]"
          >
            {submitting ? 'Registrando...' : isLast ? 'Aceitar e Continuar' : 'Aceitar e Próxima'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
