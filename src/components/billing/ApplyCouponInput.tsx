/**
 * ApplyCouponInput — Tenant-facing coupon application widget
 *
 * Validates via CouponValidationService before applying.
 * Integrates with DiscountEngine to redeem on confirmation.
 */

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Ticket, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTenant } from '@/contexts/TenantContext';
import { createCouponValidationService, createDiscountEngine } from '@/domains/billing-core';
import type { Coupon } from '@/domains/billing-core';

interface ApplyCouponInputProps {
  /** Current plan ID for validation scope */
  planId?: string;
  /** Current billing cycle for validation scope */
  billingCycle?: string;
  /** Subtotal in BRL for discount preview */
  subtotalBrl?: number;
  /** Called after successful discount application */
  onApplied?: (result: { coupon: Coupon; discount_brl: number; final_amount_brl: number }) => void;
  /** If true, only validates without applying the discount */
  validateOnly?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const validator = createCouponValidationService();
const discountEngine = createDiscountEngine();

const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  percentage: 'Percentual',
  fixed_amount: 'Valor Fixo',
  free_months: 'Meses Grátis',
};

function formatDiscount(coupon: Coupon): string {
  if (coupon.discount_type === 'percentage') return `${coupon.discount_value}%`;
  if (coupon.discount_type === 'free_months') return `${coupon.discount_value} meses grátis`;
  return `R$ ${Number(coupon.discount_value).toFixed(2).replace('.', ',')}`;
}

export function ApplyCouponInput({
  planId,
  billingCycle,
  subtotalBrl,
  onApplied,
  validateOnly = false,
  className = '',
}: ApplyCouponInputProps) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? '';

  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [validatedCoupon, setValidatedCoupon] = useState<Coupon | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    if (!tenantId) {
      setError('Nenhum cliente ativo.');
      return;
    }

    setValidating(true);
    setError(null);
    setValidatedCoupon(null);

    try {
      const result = await validator.validate(trimmed, tenantId, planId, billingCycle);

      if (!result.valid) {
        setError(result.reason ?? 'Cupom inválido.');
        return;
      }

      setValidatedCoupon(result.coupon!);
      toast.success(`Cupom ${trimmed} válido!`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao validar cupom.');
    } finally {
      setValidating(false);
    }
  }, [code, tenantId, planId, billingCycle]);

  const handleApply = useCallback(async () => {
    if (!validatedCoupon || !tenantId) return;

    setApplying(true);
    try {
      const amount = subtotalBrl ?? 0;
      const result = await discountEngine.applyDiscount(
        validatedCoupon.code,
        tenantId,
        amount,
        planId,
        billingCycle,
      );

      if (!result.applied) {
        setError(result.reason ?? 'Não foi possível aplicar o desconto.');
        return;
      }

      toast.success(`Desconto de R$ ${result.discount_brl.toFixed(2).replace('.', ',')} aplicado!`);
      onApplied?.({
        coupon: result.coupon!,
        discount_brl: result.discount_brl,
        final_amount_brl: result.final_amount_brl,
      });

      // Reset
      setCode('');
      setValidatedCoupon(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao aplicar desconto.');
    } finally {
      setApplying(false);
    }
  }, [validatedCoupon, tenantId, subtotalBrl, planId, billingCycle, onApplied]);

  const handleClear = () => {
    setCode('');
    setValidatedCoupon(null);
    setError(null);
  };

  const isLoading = validating || applying;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Input row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={code}
            onChange={e => {
              setCode(e.target.value.toUpperCase());
              if (validatedCoupon) setValidatedCoupon(null);
              if (error) setError(null);
            }}
            placeholder="Código do cupom"
            className="pl-9 font-mono uppercase"
            maxLength={30}
            disabled={isLoading}
            onKeyDown={e => { if (e.key === 'Enter') handleValidate(); }}
          />
        </div>

        {!validatedCoupon ? (
          <Button
            variant="outline"
            onClick={handleValidate}
            disabled={!code.trim() || isLoading}
            className="min-w-[100px]"
          >
            {validating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Validar'
            )}
          </Button>
        ) : validateOnly ? (
          <Button variant="ghost" size="sm" onClick={handleClear}>
            Limpar
          </Button>
        ) : (
          <div className="flex gap-1.5">
            <Button
              onClick={handleApply}
              disabled={applying}
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[100px]"
            >
              {applying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Aplicar'
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleClear}>
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Validated coupon preview */}
      {validatedCoupon && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 p-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-semibold text-foreground text-sm">{validatedCoupon.code}</span>
              <Badge variant="outline" className="text-xs">
                {DISCOUNT_TYPE_LABELS[validatedCoupon.discount_type] ?? validatedCoupon.discount_type}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {validatedCoupon.name} — <span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatDiscount(validatedCoupon)}</span>
              {subtotalBrl != null && validatedCoupon.discount_type === 'percentage' && (
                <span className="ml-1">
                  (≈ R$ {(subtotalBrl * Number(validatedCoupon.discount_value) / 100).toFixed(2).replace('.', ',')})
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
