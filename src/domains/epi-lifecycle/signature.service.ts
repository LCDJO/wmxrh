/**
 * EPI Signature Service
 *
 * Manages digital signatures for EPI deliveries — legal proof.
 */

import { supabase } from '@/integrations/supabase/client';
import type { EpiSignature, EpiSignatureInput } from './types';

const DEFAULT_TERMO =
  'Declaro ter recebido o EPI acima descrito, em perfeitas condições de uso, e comprometo-me a utilizá-lo corretamente conforme treinamento recebido.';

// ═══════════════════════════════════════════════════════
// CREATE SIGNATURE
// ═══════════════════════════════════════════════════════

export async function signEpiDelivery(input: EpiSignatureInput): Promise<EpiSignature> {
  // Generate content hash for legal proof
  const content = JSON.stringify({
    delivery_id: input.delivery_id,
    employee_id: input.employee_id,
    termo: input.termo_aceite ?? DEFAULT_TERMO,
    timestamp: new Date().toISOString(),
  });

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(content));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const row = {
    tenant_id: input.tenant_id,
    delivery_id: input.delivery_id,
    employee_id: input.employee_id,
    tipo_assinatura: input.tipo_assinatura ?? 'digital',
    assinatura_hash: hashHex,
    assinatura_data: input.assinatura_data ?? null,
    ip_address: input.ip_address ?? null,
    user_agent: input.user_agent ?? null,
    termo_aceite: input.termo_aceite ?? DEFAULT_TERMO,
  };

  const { data, error } = await supabase
    .from('epi_signatures' as any)
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(`Erro ao registrar assinatura: ${error.message}`);
  return data as unknown as EpiSignature;
}

// ═══════════════════════════════════════════════════════
// INVALIDATE SIGNATURE
// ═══════════════════════════════════════════════════════

export async function invalidateSignature(
  signatureId: string,
  motivo: string,
): Promise<void> {
  const { error } = await supabase
    .from('epi_signatures' as any)
    .update({
      is_valid: false,
      invalidado_em: new Date().toISOString(),
      motivo_invalidacao: motivo,
    } as any)
    .eq('id', signatureId);

  if (error) throw new Error(`Erro ao invalidar assinatura: ${error.message}`);
}

// ═══════════════════════════════════════════════════════
// GET SIGNATURES FOR DELIVERY
// ═══════════════════════════════════════════════════════

export async function getDeliverySignatures(deliveryId: string): Promise<EpiSignature[]> {
  const { data, error } = await supabase
    .from('epi_signatures' as any)
    .select('*')
    .eq('delivery_id', deliveryId)
    .order('assinado_em', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EpiSignature[];
}

// ═══════════════════════════════════════════════════════
// CHECK IF DELIVERY IS SIGNED
// ═══════════════════════════════════════════════════════

export async function isDeliverySigned(deliveryId: string): Promise<boolean> {
  const { data } = await supabase
    .from('epi_signatures' as any)
    .select('id')
    .eq('delivery_id', deliveryId)
    .eq('is_valid', true)
    .limit(1);

  return (data?.length ?? 0) > 0;
}
