/**
 * Payroll Item Catalog Service
 * Manages rubricas (proventos/descontos) with eSocial codes.
 */

import { supabase } from '@/integrations/supabase/client';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import type { QueryScope } from '@/domains/shared/scoped-query';
import type { PayrollItemCatalog, CreatePayrollItemCatalogDTO } from '@/domains/shared/types';

export const payrollCatalogService = {
  async list(scope: QueryScope) {
    const q = applyScope(
      supabase.from('payroll_item_catalog').select('*'),
      scope,
      { skipScopeFilter: true }
    ).order('code');
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as PayrollItemCatalog[];
  },

  async create(dto: CreatePayrollItemCatalogDTO, scope: QueryScope) {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('payroll_item_catalog').insert(secured).select().single();
    if (error) throw error;
    return data as PayrollItemCatalog;
  },
};
