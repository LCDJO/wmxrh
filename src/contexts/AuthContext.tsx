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
    
    // Listener reativo: captura login, logout, token_refreshed, etc.
    // Este listener é a fonte primária de verdade para o estado de auth.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      logger.info('Auth state changed', { event, userId: session?.user?.id });
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Restauração de sessão existente (ex: após refresh da página).
    // Necessário porque `onAuthStateChange` pode não disparar imediatamente
    // se o token ainda está válido e não houve mudança de estado.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        logger.info('Sessão existente recuperada', { userId: session.user.id });
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      logger.debug('AuthProvider desmontado');
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
  const signIn = async (email: string, password: string) => {
    logger.info('Tentativa de login', { email });
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      logger.error('Falha no login', { error: error.message, email });
    } else {
      logger.info('Login realizado com sucesso', { email });
    }
    
    return { error: error as Error | null };
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
