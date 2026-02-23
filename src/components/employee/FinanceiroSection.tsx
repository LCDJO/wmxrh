/**
 * Financeiro Section — Ficha do Trabalhador
 *
 * Shows bank data and payment information from personal data.
 */
import { Badge } from '@/components/ui/badge';
import { Building2, CreditCard, Key } from 'lucide-react';
import type { EmployeePersonalData, EmployeeContract } from '@/domains/employee-master-record';

interface Props {
  personalData: EmployeePersonalData | null;
  currentContract: EmployeeContract | null;
}

const TIPO_CONTA_LABELS: Record<string, string> = {
  corrente: 'Conta Corrente',
  poupanca: 'Conta Poupança',
  salario: 'Conta Salário',
};

const FORMA_PAGAMENTO_LABELS: Record<string, string> = {
  deposito_bancario: 'Depósito Bancário',
  pix: 'PIX',
  cheque: 'Cheque',
  dinheiro: 'Dinheiro',
};

export function FinanceiroSection({ personalData, currentContract }: Props) {
  const hasBankData = personalData?.banco || personalData?.agencia || personalData?.conta;

  return (
    <div className="space-y-6">
      {/* Bank Data */}
      <div>
        <h4 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Dados Bancários
        </h4>
        {!hasBankData ? (
          <p className="text-sm text-muted-foreground">Dados bancários não cadastrados.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoItem label="Banco" value={personalData?.banco} />
            <InfoItem label="Agência" value={personalData?.agencia} />
            <InfoItem label="Conta" value={personalData?.conta} />
            <InfoItem label="Tipo de Conta" value={personalData?.tipo_conta ? TIPO_CONTA_LABELS[personalData.tipo_conta] || personalData.tipo_conta : null} />
            {personalData?.chave_pix && (
              <div className="flex items-start gap-2 col-span-2">
                <Key className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Chave PIX</p>
                  <p className="text-sm text-card-foreground">{personalData.chave_pix}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Info */}
      <div>
        <h4 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
          <CreditCard className="h-4 w-4" /> Forma de Pagamento
        </h4>
        {!currentContract ? (
          <p className="text-sm text-muted-foreground">Sem contrato ativo.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoItem
              label="Forma"
              value={currentContract.forma_pagamento ? FORMA_PAGAMENTO_LABELS[currentContract.forma_pagamento] || currentContract.forma_pagamento : null}
            />
            <InfoItem
              label="Tipo Salário"
              value={currentContract.tipo_salario === 'mensalista' ? 'Mensalista' : currentContract.tipo_salario === 'horista' ? 'Horista' : currentContract.tipo_salario}
            />
            <InfoItem
              label="Salário Base"
              value={currentContract.salario_base ? `R$ ${Number(currentContract.salario_base).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-card-foreground">{value || '—'}</p>
    </div>
  );
}
