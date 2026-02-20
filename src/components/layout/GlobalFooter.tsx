import { Shield, FileText, Headphones, Cpu } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const currentYear = new Date().getFullYear();

export function GlobalFooter() {
  return (
    <footer className="border-t border-border bg-card text-card-foreground">
      <div className="mx-auto max-w-[1600px] px-8 py-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* ── 1. Institucional ── */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground tracking-wide uppercase">
              Institucional
            </h4>
            <p className="text-sm font-medium text-foreground">PeopleOS</p>
            <p className="text-xs text-muted-foreground">
              © {currentYear} — Todos os direitos reservados.
            </p>
            <p className="text-xs text-muted-foreground">
              CNPJ: 00.000.000/0001-00
            </p>
          </div>

          {/* ── 2. Compliance & Segurança ── */}
          <div className="space-y-3">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground tracking-wide uppercase">
              <Shield className="h-3.5 w-3.5 text-primary" />
              Compliance
            </h4>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li>✔ CLT — Consolidação das Leis do Trabalho</li>
              <li>✔ Normas Regulamentadoras (NR)</li>
              <li>✔ eSocial — Leiautes S-2.5+</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              Regulatório atualizado até{' '}
              <span className="font-medium text-foreground">Fev/2026</span>
            </p>
          </div>

          {/* ── 3. Suporte ── */}
          <div className="space-y-3">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground tracking-wide uppercase">
              <Headphones className="h-3.5 w-3.5 text-primary" />
              Suporte
            </h4>
            <ul className="space-y-1.5 text-xs">
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  Central de Ajuda
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  Documentação Técnica
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  Política de Privacidade
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  Termos de Uso
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  Contato
                </a>
              </li>
            </ul>
          </div>

          {/* ── 4. Técnico ── */}
          <div className="space-y-3">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground tracking-wide uppercase">
              <Cpu className="h-3.5 w-3.5 text-primary" />
              Técnico
            </h4>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li>
                Versão:{' '}
                <span className="font-mono font-medium text-foreground">2.8.0</span>
              </li>
              <li>
                Ambiente:{' '}
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Produção
                </span>
              </li>
              <li>Última atualização legislativa: Fev/2026</li>
              <li className="flex items-center gap-1.5">
                Integração Gov:
                <span className="inline-flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-primary font-medium">Online</span>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-6" />

        <p className="text-center text-[11px] text-muted-foreground">
          Plataforma de Compliance Trabalhista e SST — Uso restrito a usuários autorizados.
        </p>
      </div>
    </footer>
  );
}
