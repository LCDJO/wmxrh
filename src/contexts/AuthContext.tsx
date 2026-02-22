import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface SignUpMetadata {
  full_name?: string;
  company_name?: string;
  company_document?: string;
  company_phone?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: SignUpMetadata) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logger.debug('AuthProvider montado - inicializando autenticação');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      logger.info('Auth state changed', { event, userId: session?.user?.id });
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
