/**
 * AuthContext — Contexto global de autenticação da aplicação.
 *
 * Responsabilidades:
 *   1. Gerenciar o estado de autenticação (user, session, loading)
 *   2. Escutar mudanças de sessão via `onAuthStateChange` (login, logout, token refresh)
 *   3. Expor métodos de signUp, signIn e signOut para toda a árvore React
 *
 * Fluxo de inicialização:
 *   - Monta o listener `onAuthStateChange` para reagir a eventos em tempo real
 *   - Chama `getSession()` para restaurar sessão existente (ex: tab refresh)
 *   - Ambos atualizam `user`, `session` e `loading`
 *
 * Decisões de design:
 *   - `loading` inicia como `true` e só vira `false` após a primeira verificação de sessão.
 *     Isso evita flicker de tela de login quando o usuário já está autenticado.
 *   - `emailRedirectTo` aponta para `window.location.origin` para suportar
 *     diferentes ambientes (preview, produção) sem config manual.
 *   - Metadata opcional no signUp (`full_name`, `company_name`, etc.) é usada
 *     pelo TenantProvider para self-registration automática do tenant.
 *
 * @see TenantContext — consome `user` para resolver tenant/membership
 * @see ScopeContext — consome `user` para resolver roles efetivas
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Metadata adicional enviada no cadastro (signUp).
 * Esses campos são persistidos em `auth.users.raw_user_meta_data`
 * e utilizados pelo TenantProvider para auto-criar o tenant na primeira sessão.
 */
interface SignUpMetadata {
  full_name?: string;
  company_name?: string;
  company_document?: string;
  company_phone?: string;
}

/**
 * Contrato público do AuthContext.
 *
 * @property user     - Objeto User do Supabase (null se não autenticado)
 * @property session  - Sessão ativa contendo tokens JWT (null se não autenticado)
 * @property loading  - `true` até a primeira verificação de sessão completar
 * @property signUp   - Cria conta com email/senha e metadata opcional
 * @property signIn   - Autentica com email/senha
 * @property signOut  - Encerra a sessão e limpa tokens
 */
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: SignUpMetadata) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider — Wrapper que inicializa e distribui o estado de autenticação.
 *
 * Deve envolver toda a árvore de componentes que precisam de acesso ao usuário.
 * No App.tsx, fica dentro do BrowserRouter e acima do TenantProvider.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logger.debug('AuthProvider montado - inicializando autenticação');
    
    let initialized = false;

    // Listener reativo: fonte ÚNICA de verdade para o estado de auth.
    // Captura login, logout, token_refreshed, etc.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.info('Auth state changed', { event, userId: session?.user?.id });
      initialized = true;

      // ── LOGIN BLOCKER on session restore / token refresh ──
      if (session?.user?.id && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        const { data: pu } = await supabase
          .from('platform_users')
          .select('account_status')
          .eq('user_id', session.user.id)
          .maybeSingle();

        const status = (pu as any)?.account_status;
        if (status === 'banned' || status === 'suspended') {
          logger.warn('Sessão revogada — conta bloqueada', { userId: session.user.id, status });
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
      }

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Fallback: se o listener não disparar em 500ms (sessão existente sem mudança),
    // força a restauração via getSession(). Evita duplo setState.
    const fallbackTimer = setTimeout(() => {
      if (!initialized) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!initialized) {
            if (session) {
              logger.info('Sessão restaurada via fallback', { userId: session.user.id });
            }
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
          }
        });
      }
    }, 500);

    return () => {
      logger.debug('AuthProvider desmontado');
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Registra novo usuário com email e senha.
   *
   * @param email    - Email do usuário
   * @param password - Senha (mínimo definido pelo backend)
   * @param metadata - Dados adicionais salvos em `raw_user_meta_data`
   * @returns Objeto com `error` (null se sucesso)
   *
   * Nota: O usuário precisa confirmar o email antes de poder fazer login
   * (a menos que auto-confirm esteja habilitado no backend).
   */
  const signUp = async (email: string, password: string, metadata?: SignUpMetadata) => {
    logger.info('Tentativa de cadastro', { email, hasMetadata: !!metadata });
    
    const { error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: metadata ?? {},
      }
    });
    
    if (error) {
      logger.error('Falha no cadastro', { error: error.message, email });
    } else {
      logger.info('Cadastro realizado com sucesso', { email });
    }
    
    return { error: error as Error | null };
  };

  /**
   * Autentica usuário existente com email e senha.
   * Em caso de sucesso, `onAuthStateChange` atualiza automaticamente o estado.
   */
  /**
   * Verifica se o tenant/user está banido ou suspenso.
   * Retorna o status bloqueado ou null se livre.
   */
  async function checkAccountBlocked(userId: string): Promise<string | null> {
    // Check platform_users status
    const { data: pu } = await supabase
      .from('platform_users')
      .select('account_status')
      .eq('user_id', userId)
      .maybeSingle();

    const puStatus = (pu as any)?.account_status;
    if (puStatus === 'banned' || puStatus === 'suspended') return puStatus;

    // Check tenant membership → tenant account_status
    const { data: membership } = await supabase
      .from('tenant_memberships')
      .select('tenant_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (membership?.tenant_id) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('account_status')
        .eq('id', membership.tenant_id)
        .maybeSingle();

      const tStatus = (tenant as any)?.account_status;
      if (tStatus === 'banned' || tStatus === 'suspended') return tStatus;
    }

    return null;
  }

  const signIn = async (email: string, password: string) => {
    logger.info('Tentativa de login', { email });
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      logger.error('Falha no login', { error: error.message, email });
      return { error: error as Error | null };
    }

    // ── LOGIN BLOCKER: verificar account_status antes de emitir sessão ──
    const userId = data.user?.id;
    if (userId) {
      const blockedStatus = await checkAccountBlocked(userId);
      if (blockedStatus) {
        logger.warn('Login bloqueado — conta com status restritivo', { email, status: blockedStatus });
        // Revogar sessão imediatamente
        await supabase.auth.signOut();
        const msg = blockedStatus === 'banned'
          ? 'Sua conta foi banida. Entre em contato com o suporte.'
          : 'Sua conta está suspensa. Entre em contato com o suporte.';
        return { error: new Error(msg) };
      }
    }

    logger.info('Login realizado com sucesso', { email });
    return { error: null };
  };

  /**
   * Encerra a sessão do usuário.
   * Limpa tokens locais e invalida o refresh token no servidor.
   */
  const signOut = async () => {
    logger.info('Usuário fazendo logout', { userId: user?.id });
    await supabase.auth.signOut();
    logger.info('Logout realizado com sucesso');
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook para consumir o AuthContext.
 * Lança erro se usado fora do AuthProvider (fail-fast para bugs de composição).
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
