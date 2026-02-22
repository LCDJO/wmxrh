
-- ══════════════════════════════════════════════════════════
-- EVENT QUEUE MODEL — Kafka/Redis-inspired topic system
-- ══════════════════════════════════════════════════════════

-- ── Event Topics: Partitioned by tenant, ordered within tenant ──
CREATE TABLE IF NOT EXISTS public.tenant_event_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  topic text NOT NULL,
  event_type text NOT NULL,
  partition_key text NOT NULL,
  sequence_num bigint NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'platform',
  correlation_id uuid DEFAULT gen_random_uuid(),
  causation_id uuid,
  priority smallint NOT NULL DEFAULT 2,
  status text NOT NULL DEFAULT 'pending',
  retry_count smallint NOT NULL DEFAULT 0,
  max_retries smallint NOT NULL DEFAULT 3,
  next_retry_at timestamptz,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour')
);

-- Sequence generator per tenant+topic (ensures ordering within tenant)
CREATE SEQUENCE IF NOT EXISTS tenant_event_seq;

-- Auto-assign sequence number
CREATE OR REPLACE FUNCTION public.assign_event_sequence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.sequence_num := nextval('tenant_event_seq');
  NEW.partition_key := COALESCE(NEW.partition_key, NEW.tenant_id::text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_event_sequence
  BEFORE INSERT ON public.tenant_event_log
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_event_sequence();

-- Indexes for efficient consumption
CREATE INDEX idx_tenant_event_log_consume 
  ON public.tenant_event_log(tenant_id, topic, status, priority, sequence_num)
  WHERE status = 'pending';

CREATE INDEX idx_tenant_event_log_retry
  ON public.tenant_event_log(next_retry_at)
  WHERE status = 'retry' AND next_retry_at IS NOT NULL;

CREATE INDEX idx_tenant_event_log_correlation
  ON public.tenant_event_log(correlation_id);

CREATE INDEX idx_tenant_event_log_expires
  ON public.tenant_event_log(expires_at)
  WHERE status IN ('pending', 'retry');

-- ── Dead Letter Queue ──
CREATE TABLE IF NOT EXISTS public.tenant_event_dlq (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_event_id uuid REFERENCES public.tenant_event_log(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  topic text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  error_message text NOT NULL,
  error_stack text,
  retry_count smallint NOT NULL DEFAULT 0,
  failed_at timestamptz NOT NULL DEFAULT now(),
  reprocessed boolean NOT NULL DEFAULT false,
  reprocessed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenant_event_dlq_tenant 
  ON public.tenant_event_dlq(tenant_id, topic, created_at DESC)
  WHERE NOT reprocessed;

-- ── Event Consumer Offsets (track where each consumer is) ──
CREATE TABLE IF NOT EXISTS public.tenant_event_consumer_offsets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  consumer_group text NOT NULL,
  topic text NOT NULL,
  last_sequence_num bigint NOT NULL DEFAULT 0,
  last_consumed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, consumer_group, topic)
);

-- RLS: service-role only
ALTER TABLE public.tenant_event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_event_dlq ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_event_consumer_offsets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access to tenant_event_log"
  ON public.tenant_event_log FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "No direct client access to tenant_event_dlq"
  ON public.tenant_event_dlq FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "No direct client access to tenant_event_consumer_offsets"
  ON public.tenant_event_consumer_offsets FOR ALL USING (false) WITH CHECK (false);

-- Enable realtime on event log for WebSocket push
ALTER PUBLICATION supabase_realtime ADD TABLE public.tenant_event_log;

-- ── Retry scheduling function ──
CREATE OR REPLACE FUNCTION public.schedule_event_retry(
  p_event_id uuid,
  p_error_message text DEFAULT 'Unknown error'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retry_count smallint;
  v_max_retries smallint;
  v_backoff_seconds integer;
BEGIN
  SELECT retry_count, max_retries INTO v_retry_count, v_max_retries
  FROM public.tenant_event_log WHERE id = p_event_id;

  IF v_retry_count >= v_max_retries THEN
    -- Move to DLQ
    INSERT INTO public.tenant_event_dlq (original_event_id, tenant_id, topic, event_type, payload, metadata, error_message, retry_count)
    SELECT id, tenant_id, topic, event_type, payload, metadata, p_error_message, retry_count
    FROM public.tenant_event_log WHERE id = p_event_id;

    UPDATE public.tenant_event_log 
    SET status = 'dead_letter', error_message = p_error_message, processed_at = now()
    WHERE id = p_event_id;

    RETURN 'dead_letter';
  END IF;

  -- Exponential backoff: 5s, 25s, 125s
  v_backoff_seconds := POWER(5, v_retry_count + 1)::integer;

  UPDATE public.tenant_event_log
  SET status = 'retry',
      retry_count = retry_count + 1,
      next_retry_at = now() + (v_backoff_seconds || ' seconds')::interval,
      error_message = p_error_message
  WHERE id = p_event_id;

  RETURN 'retry_scheduled';
END;
$$;

-- ── Cleanup function for expired events ──
CREATE OR REPLACE FUNCTION public.cleanup_expired_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Move expired pending/retry events to DLQ
  INSERT INTO public.tenant_event_dlq (original_event_id, tenant_id, topic, event_type, payload, metadata, error_message, retry_count)
  SELECT id, tenant_id, topic, event_type, payload, metadata, 'Event expired before processing', retry_count
  FROM public.tenant_event_log
  WHERE expires_at < now() AND status IN ('pending', 'retry');

  -- Mark as expired
  UPDATE public.tenant_event_log
  SET status = 'expired', processed_at = now()
  WHERE expires_at < now() AND status IN ('pending', 'retry');

  -- Delete old processed/expired/dead_letter events (older than 24h)
  DELETE FROM public.tenant_event_log
  WHERE status IN ('processed', 'expired', 'dead_letter')
    AND processed_at < now() - interval '24 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;
