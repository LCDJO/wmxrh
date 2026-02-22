/**
 * ErrorBoundary — Componente React de classe que captura erros de renderização.
 *
 * Responsabilidades:
 *   1. Capturar erros não tratados durante o render de componentes filhos
 *   2. Exibir UI de fallback amigável em vez de tela branca
 *   3. Registrar o erro no AppErrorStore para visibilidade no PlatformLogs
 *   4. Permitir recuperação via "Tentar novamente" ou reload completo
 *
 * Posicionamento no App.tsx (dois níveis):
 *   - ErrorBoundary externo (raiz): captura erros fatais que comprometem toda a app
 *   - ErrorBoundary interno (dentro do PlatformShell): captura erros de rota/página
 *     sem derrubar a shell de navegação
 *
 * Decisões de design:
 *   - Usa class component (obrigatório — getDerivedStateFromError e componentDidCatch
 *     não têm equivalente em hooks).
 *   - O fallback customizável via prop permite UX diferente por contexto
 *     (ex: fallback mínimo na raiz vs fallback com navegação dentro da shell).
 *   - "Tentar novamente" reseta o estado de erro, re-renderizando children.
 *     Se o erro persistir, o boundary captura novamente automaticamente.
 *
 * @see pushAppError — registra o erro para exibição no PlatformLogs
 * @see UnhandledRejectionGuard — captura erros async não tratados (complementar)
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pushAppError } from '@/lib/app-error-store';

interface Props {
  children: ReactNode;
  /** UI customizada para exibir no lugar dos children quando há erro */
  fallback?: ReactNode;
}

interface State {
  /** Flag indicando que um erro foi capturado */
  hasError: boolean;
  /** Referência ao objeto Error para exibição da mensagem */
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /**
   * Método estático chamado pelo React quando um erro ocorre durante render.
   * Retorna o novo state que será aplicado (hasError: true).
   * Executado durante a fase de render — NÃO pode ter side effects.
   */
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /**
   * Callback chamado após o erro ser capturado.
   * Executado durante a fase de commit — PODE ter side effects.
   *
   * @param error     - O erro que foi lançado
   * @param errorInfo - Informações adicionais do React (componentStack)
   *
   * Registra o erro no AppErrorStore para que apareça na aba
   * "Erros de Aplicação" do PlatformLogs.
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
    pushAppError({
      source: 'error_boundary',
      message: error.message,
      stack: error.stack ?? undefined,
      componentStack: errorInfo.componentStack ?? undefined,
    });
  }

  /**
   * Reseta o estado de erro, permitindo re-renderização dos children.
   * Se o children ainda lançar erro, o boundary captura novamente.
   */
  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Se um fallback customizado foi fornecido, usá-lo
      if (this.props.fallback) return this.props.fallback;

      // Fallback padrão: mensagem amigável + botões de recuperação
      return (
        <div className="min-h-[300px] flex items-center justify-center p-8">
          <div className="text-center space-y-4 max-w-md">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold text-foreground">
              Algo deu errado
            </h2>
            <p className="text-sm text-muted-foreground">
              Ocorreu um erro inesperado. Tente recarregar a seção.
            </p>
            {/* Exibe a mensagem do erro para ajudar no diagnóstico */}
            {this.state.error && (
              <pre className="text-xs text-muted-foreground bg-muted p-3 rounded-md overflow-auto max-h-32 text-left">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-2 justify-center">
              {/* Reseta o boundary — tenta re-renderizar os children */}
              <Button variant="outline" size="sm" onClick={this.handleReset}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Tentar novamente
              </Button>
              {/* Reload completo da página — última alternativa */}
              <Button variant="default" size="sm" onClick={() => window.location.reload()}>
                Recarregar página
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
