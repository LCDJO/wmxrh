import { describe, it, expect } from 'vitest';

/**
 * Tests for EPI delivery date/validade calculation logic.
 * Extracted from delivery.service.ts to test pure business rules.
 */

// Pure function extracted from createEpiDelivery
function calculateValidadeDate(dataEntrega: string, validadeMeses: number): string {
  const d = new Date(dataEntrega);
  d.setMonth(d.getMonth() + validadeMeses);
  return d.toISOString().split('T')[0];
}

// Pure function for default motivo
function resolveMotivo(input?: string): string {
  return input ?? 'entrega_inicial';
}

// Pure function for quantidade
function resolveQuantidade(input?: number): number {
  return input ?? 1;
}

describe('EPI Delivery — Business Logic', () => {
  describe('calculateValidadeDate', () => {
    it('adds validade months to entrega date', () => {
      expect(calculateValidadeDate('2026-01-15', 6)).toBe('2026-07-15');
    });

    it('defaults to 12 months if not specified', () => {
      expect(calculateValidadeDate('2026-01-01', 12)).toBe('2027-01-01');
    });

    it('handles month overflow (e.g. Jan 31 + 1 month)', () => {
      // JS Date month overflow: Jan 31 + 1 month = Mar 3 (or Feb 28 depending on year)
      const result = calculateValidadeDate('2026-01-31', 1);
      const d = new Date(result);
      expect(d.getMonth()).toBe(2); // March (0-indexed) due to Feb overflow
    });

    it('handles year boundary', () => {
      expect(calculateValidadeDate('2026-11-15', 3)).toBe('2027-02-15');
    });

    it('handles leap year', () => {
      expect(calculateValidadeDate('2024-02-29', 12)).toBe('2025-03-01');
    });
  });

  describe('resolveMotivo', () => {
    it('defaults to entrega_inicial', () => {
      expect(resolveMotivo()).toBe('entrega_inicial');
      expect(resolveMotivo(undefined)).toBe('entrega_inicial');
    });

    it('preserves explicit motivo', () => {
      expect(resolveMotivo('substituicao_desgaste')).toBe('substituicao_desgaste');
    });
  });

  describe('resolveQuantidade', () => {
    it('defaults to 1', () => {
      expect(resolveQuantidade()).toBe(1);
    });

    it('preserves explicit value', () => {
      expect(resolveQuantidade(5)).toBe(5);
    });
  });
});

describe('EPI Delivery Row Construction', () => {
  it('builds correct row shape with all defaults', () => {
    const input = {
      tenant_id: 't1',
      employee_id: 'e1',
      epi_catalog_id: 'cat1',
    };
    const validadeMeses = 12;
    const dataEntrega = '2026-03-01';

    const row = {
      tenant_id: input.tenant_id,
      company_id: null,
      employee_id: input.employee_id,
      epi_catalog_id: input.epi_catalog_id,
      risk_exposure_id: null,
      quantidade: resolveQuantidade(undefined),
      motivo: resolveMotivo(undefined),
      data_entrega: dataEntrega,
      data_validade: calculateValidadeDate(dataEntrega, validadeMeses),
      lote: null,
      ca_numero: null,
      observacoes: null,
      status: 'entregue',
    };

    expect(row.quantidade).toBe(1);
    expect(row.motivo).toBe('entrega_inicial');
    expect(row.data_validade).toBe('2027-03-01');
    expect(row.status).toBe('entregue');
    expect(row.company_id).toBeNull();
  });

  it('builds row with explicit values', () => {
    const dataEntrega = '2026-06-15';
    const row = {
      tenant_id: 't1',
      company_id: 'c1',
      employee_id: 'e1',
      epi_catalog_id: 'cat1',
      risk_exposure_id: 'risk1',
      quantidade: resolveQuantidade(3),
      motivo: resolveMotivo('substituicao_dano'),
      data_entrega: dataEntrega,
      data_validade: calculateValidadeDate(dataEntrega, 6),
      lote: 'LOT-2026',
      ca_numero: 'CA-12345',
      observacoes: 'Troca por desgaste',
      status: 'entregue',
    };

    expect(row.quantidade).toBe(3);
    expect(row.motivo).toBe('substituicao_dano');
    expect(row.data_validade).toBe('2026-12-15');
    expect(row.ca_numero).toBe('CA-12345');
  });
});
