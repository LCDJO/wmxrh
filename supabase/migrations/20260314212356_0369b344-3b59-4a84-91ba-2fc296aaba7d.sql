
-- Create the introspect_public_schema function for System Atlas
CREATE OR REPLACE FUNCTION public.introspect_public_schema()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH tables_cte AS (
    SELECT 
      t.table_name,
      t.table_type,
      (
        SELECT jsonb_agg(jsonb_build_object(
          'column_name', c.column_name,
          'data_type', c.data_type,
          'udt_name', c.udt_name,
          'is_nullable', c.is_nullable,
          'column_default', c.column_default,
          'ordinal_position', c.ordinal_position
        ) ORDER BY c.ordinal_position)
        FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = t.table_name
      ) AS columns,
      (
        SELECT jsonb_agg(jsonb_build_object(
          'constraint_name', tc.constraint_name,
          'constraint_type', tc.constraint_type
        ))
        FROM information_schema.table_constraints tc
        WHERE tc.table_schema = 'public' AND tc.table_name = t.table_name
          AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      ) AS constraints
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  ),
  fk_cte AS (
    SELECT jsonb_agg(jsonb_build_object(
      'constraint_name', tc.constraint_name,
      'source_table', kcu.table_name,
      'source_column', kcu.column_name,
      'target_table', ccu.table_name,
      'target_column', ccu.column_name
    )) AS fks
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  ),
  pk_cte AS (
    SELECT jsonb_agg(jsonb_build_object(
      'table_name', kcu.table_name,
      'column_name', kcu.column_name
    )) AS pks
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
  ),
  idx_cte AS (
    SELECT jsonb_agg(jsonb_build_object(
      'table_name', t.relname,
      'index_name', i.relname,
      'column_name', a.attname,
      'is_unique', ix.indisunique
    )) AS indexes
    FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    WHERE n.nspname = 'public'
  )
  SELECT jsonb_build_object(
    'tables', (SELECT jsonb_agg(jsonb_build_object(
      'table_name', tc.table_name,
      'table_type', tc.table_type,
      'columns', COALESCE(tc.columns, '[]'::jsonb),
      'constraints', COALESCE(tc.constraints, '[]'::jsonb)
    )) FROM tables_cte tc),
    'foreign_keys', COALESCE((SELECT fks FROM fk_cte), '[]'::jsonb),
    'primary_keys', COALESCE((SELECT pks FROM pk_cte), '[]'::jsonb),
    'indexes', COALESCE((SELECT indexes FROM idx_cte), '[]'::jsonb),
    'generated_at', now()
  ) INTO result;

  RETURN result;
END;
$$;
