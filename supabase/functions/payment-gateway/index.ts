import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckoutRequest {
  tenant_id: string;
  invoice_id: string;
  amount_cents: number;
  currency?: string;
  success_url: string;
  cancel_url: string;
}

interface WebhookRequest {
  provider: string;
  payload: Record<string, unknown>;
  signature?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // ── Webhook endpoint (no auth required) ──────────────────
    if (action === 'webhook') {
      return await handleWebhook(req, supabaseAdmin);
    }

    // ── Authenticated actions ────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json();

    switch (action) {
      case 'create-checkout':
        return await handleCreateCheckout(body as CheckoutRequest, supabaseAdmin);

      case 'get-config':
        return await handleGetConfig(body.tenant_id, supabaseAdmin);

      case 'save-config':
        return await handleSaveConfig(body, supabaseAdmin);

      case 'transactions':
        return await handleListTransactions(body.tenant_id, body.limit ?? 50, supabaseAdmin);

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error('[payment-gateway] Error:', err);
    return jsonResponse({ error: err.message ?? 'Internal error' }, 500);
  }
});

// ── Create Checkout Session ──────────────────────────────────────
async function handleCreateCheckout(body: CheckoutRequest, db: any) {
  const { tenant_id, invoice_id, amount_cents, currency = 'BRL', success_url, cancel_url } = body;

  // Get gateway config
  const config = await getGatewayConfig(tenant_id, db);
  if (!config?.is_active || !config.api_key_encrypted) {
    return jsonResponse({ error: 'Payment gateway not configured for this tenant' }, 400);
  }

  // Record pending transaction
  const { data: tx, error: txErr } = await db
    .from('payment_transactions')
    .insert({
      tenant_id,
      invoice_id,
      gateway_provider: config.provider,
      amount_cents,
      currency,
      status: 'pending',
    })
    .select()
    .single();

  if (txErr) throw new Error(`Failed to create transaction: ${txErr.message}`);

  // Provider-specific checkout
  if (config.provider === 'stripe') {
    const session = await createStripeCheckout(config.api_key_encrypted, {
      amount: amount_cents,
      currency: currency.toLowerCase(),
      success_url: `${success_url}?tx=${tx.id}`,
      cancel_url,
      metadata: { tenant_id, invoice_id, transaction_id: tx.id },
    });

    // Update transaction with session ID
    await db
      .from('payment_transactions')
      .update({ gateway_session_id: session.id, status: 'processing' })
      .eq('id', tx.id);

    return jsonResponse({ checkout_url: session.url, transaction_id: tx.id });
  }

  // Manual provider — just mark for manual processing
  return jsonResponse({ transaction_id: tx.id, status: 'pending_manual' });
}

// ── Webhook Handler ──────────────────────────────────────────────
async function handleWebhook(req: Request, db: any) {
  let body: WebhookRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const { provider, payload, signature } = body;

  if (provider === 'stripe') {
    return await handleStripeWebhook(payload, signature, db);
  }

  return jsonResponse({ error: `Unsupported provider: ${provider}` }, 400);
}

async function handleStripeWebhook(payload: Record<string, unknown>, _signature: string | undefined, db: any) {
  const eventType = payload.type as string;
  const data = (payload.data as any)?.object;

  if (!data) return jsonResponse({ received: true });

  const tenantId = data.metadata?.tenant_id;
  const invoiceId = data.metadata?.invoice_id;
  const transactionId = data.metadata?.transaction_id;

  if (!tenantId) {
    console.warn('[payment-gateway] Webhook missing tenant_id in metadata');
    return jsonResponse({ received: true });
  }

  switch (eventType) {
    case 'checkout.session.completed':
    case 'payment_intent.succeeded': {
      // Update transaction
      if (transactionId) {
        await db
          .from('payment_transactions')
          .update({
            status: 'succeeded',
            gateway_transaction_id: data.payment_intent ?? data.id,
            payment_method: data.payment_method_types?.[0] ?? 'card',
            webhook_payload: payload,
          })
          .eq('id', transactionId);
      }

      // Update invoice status
      if (invoiceId) {
        await db
          .from('invoices')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', invoiceId);
      }

      // Record in financial ledger
      const amountBrl = (data.amount_total ?? data.amount ?? 0) / 100;
      await db.from('platform_financial_entries').insert({
        tenant_id: tenantId,
        entry_type: 'payment',
        amount: amountBrl,
        currency: 'BRL',
        description: `Pagamento gateway ${data.payment_intent ?? data.id}`,
        invoice_id: invoiceId,
      });

      // Update tenant paid_until based on billing cycle
      const { data: tenantPlan } = await db
        .from('tenant_plans')
        .select('id, billing_cycle, paid_until')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'past_due', 'trial'])
        .maybeSingle();

      if (tenantPlan) {
        const baseDate = tenantPlan.paid_until && new Date(tenantPlan.paid_until) > new Date()
          ? new Date(tenantPlan.paid_until)
          : new Date();
        const paidUntil = new Date(baseDate);
        if (tenantPlan.billing_cycle === 'yearly') {
          paidUntil.setFullYear(paidUntil.getFullYear() + 1);
        } else if (tenantPlan.billing_cycle === 'quarterly') {
          paidUntil.setMonth(paidUntil.getMonth() + 3);
        } else {
          paidUntil.setMonth(paidUntil.getMonth() + 1);
        }

        await db
          .from('tenant_plans')
          .update({
            paid_until: paidUntil.toISOString(),
            status: 'active',
            failed_payment_count: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tenantPlan.id);
      }

      // Log PaymentConfirmed event
      await db.from('audit_logs').insert({
        tenant_id: tenantId,
        entity_type: 'payment',
        entity_id: transactionId ?? data.id,
        action: 'payment_confirmed',
        metadata: {
          invoice_id: invoiceId,
          amount: amountBrl,
          payment_method: data.payment_method_types?.[0] ?? 'card',
        },
      });

      break;
    }

    case 'charge.refunded': {
      if (transactionId) {
        await db
          .from('payment_transactions')
          .update({ status: 'refunded', webhook_payload: payload })
          .eq('id', transactionId);
      }

      const refundAmount = (data.amount_refunded ?? 0) / 100;
      await db.from('platform_financial_entries').insert({
        tenant_id: tenantId,
        entry_type: 'refund',
        amount: refundAmount,
        currency: 'BRL',
        description: `Reembolso gateway ${data.id}`,
        invoice_id: invoiceId,
      });
      break;
    }

    case 'invoice.payment_failed': {
      if (transactionId) {
        await db
          .from('payment_transactions')
          .update({
            status: 'failed',
            error_message: data.last_payment_error?.message ?? 'Payment failed',
            webhook_payload: payload,
          })
          .eq('id', transactionId);
      }

      if (invoiceId) {
        await db.from('invoices').update({ status: 'overdue' }).eq('id', invoiceId);
      }

      await db
        .from('tenant_plans')
        .update({ status: 'past_due' })
        .eq('tenant_id', tenantId);
      break;
    }
  }

  return jsonResponse({ received: true, event: eventType });
}

// ── Stripe Checkout ──────────────────────────────────────────────
async function createStripeCheckout(
  apiKey: string,
  opts: { amount: number; currency: string; success_url: string; cancel_url: string; metadata: Record<string, string> },
) {
  const params = new URLSearchParams();
  params.set('payment_method_types[]', 'card');
  params.set('mode', 'payment');
  params.set('line_items[0][price_data][currency]', opts.currency);
  params.set('line_items[0][price_data][product_data][name]', 'Assinatura Plataforma');
  params.set('line_items[0][price_data][unit_amount]', String(opts.amount));
  params.set('line_items[0][quantity]', '1');
  params.set('success_url', opts.success_url);
  params.set('cancel_url', opts.cancel_url);
  for (const [k, v] of Object.entries(opts.metadata)) {
    params.set(`metadata[${k}]`, v);
  }

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Stripe error: ${err.error?.message ?? res.statusText}`);
  }

  return await res.json();
}

// ── Config helpers ───────────────────────────────────────────────
async function getGatewayConfig(tenantId: string, db: any) {
  const { data } = await db
    .from('payment_gateway_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .single();
  return data;
}

async function handleGetConfig(tenantId: string, db: any) {
  const { data } = await db
    .from('payment_gateway_configs')
    .select('id, tenant_id, provider, environment, is_active, metadata, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return jsonResponse({
    config: data
      ? { ...data, has_api_key: !!data.id }
      : null,
  });
}

async function handleSaveConfig(body: any, db: any) {
  const { tenant_id, provider, environment, api_key, webhook_secret, is_active } = body;

  const upsertData: Record<string, unknown> = {
    tenant_id,
    provider: provider ?? 'stripe',
    environment: environment ?? 'sandbox',
    is_active: is_active ?? false,
    updated_at: new Date().toISOString(),
  };

  if (api_key) upsertData.api_key_encrypted = api_key; // In production, encrypt via vault
  if (webhook_secret) upsertData.webhook_secret_encrypted = webhook_secret;

  const { data, error } = await db
    .from('payment_gateway_configs')
    .upsert(upsertData, { onConflict: 'tenant_id,provider' })
    .select('id, tenant_id, provider, environment, is_active')
    .single();

  if (error) throw new Error(`Failed to save config: ${error.message}`);
  return jsonResponse({ config: data });
}

async function handleListTransactions(tenantId: string, limit: number, db: any) {
  const { data } = await db
    .from('payment_transactions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return jsonResponse({ transactions: data ?? [] });
}

// ── Utils ────────────────────────────────────────────────────────
function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
