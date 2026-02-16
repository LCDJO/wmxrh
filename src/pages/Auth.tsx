/**
 * /auth/login — Unified SaaS Login
 * 
 * Detects user type after authentication:
 *   PlatformUser → /platform (SaaS admin panel)
 *   TenantUser   → / (tenant workspace)
 */
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { platformEvents } from '@/domains/platform/platform-events';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, Mail, Lock, ArrowRight, Loader2, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({ title: 'Erro de autenticação', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Check if user is a platform user
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: platformUser } = await supabase
        .from('platform_users')
        .select('id, role, status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (platformUser && platformUser.status === 'active') {
        platformEvents.userLoggedIn(user.id, user.email);
        navigate('/platform', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signUp(email, password);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Conta criada!', description: 'Verifique seu email para confirmar o cadastro.' });
      setMode('login');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Email enviado', description: 'Verifique sua caixa de entrada para redefinir a senha.' });
      setMode('login');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left — Premium branding panel */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(215,28%,12%)] via-[hsl(215,25%,16%)] to-[hsl(160,84%,15%)]" />

        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-10 w-full">
          <div>
            {/* Logo */}
            <div className="flex items-center gap-3 mb-20">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                <Shield className="h-5 w-5 text-[hsl(160,84%,55%)]" />
              </div>
              <span className="text-lg font-bold font-display text-white tracking-tight">
                RH Gestão
              </span>
            </div>

            {/* Hero text */}
            <div className="space-y-4 max-w-sm">
              <h1 className="text-[2.5rem] leading-[1.1] font-extrabold font-display text-white">
                Gestão de<br />
                pessoas<br />
                <span className="text-[hsl(160,84%,55%)]">simplificada.</span>
              </h1>
              <p className="text-white/50 text-base leading-relaxed">
                Plataforma completa para gerenciar colaboradores, folha de pagamento, compliance e muito mais.
              </p>
            </div>
          </div>

          {/* Bottom stats */}
          <div className="flex gap-8 pt-8 border-t border-white/10">
            <div>
              <p className="text-2xl font-bold text-white font-display">99.9%</p>
              <p className="text-xs text-white/40 mt-0.5">Uptime</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white font-display">256-bit</p>
              <p className="text-xs text-white/40 mt-0.5">Criptografia</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white font-display">LGPD</p>
              <p className="text-xs text-white/40 mt-0.5">Compliance</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-[380px] space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <span className="text-lg font-bold font-display text-foreground">RH Gestão</span>
          </div>

          {/* Header */}
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold font-display text-foreground">
              {mode === 'login' && 'Bem-vindo de volta'}
              {mode === 'signup' && 'Criar conta'}
              {mode === 'forgot' && 'Recuperar senha'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === 'login' && 'Entre com suas credenciais para acessar a plataforma.'}
              {mode === 'signup' && 'Preencha os dados abaixo para criar sua conta.'}
              {mode === 'forgot' && 'Informe seu email para receber o link de recuperação.'}
            </p>
          </div>

          {/* Login form */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="pl-10 h-11"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="pl-10 h-11"
                    required
                    minLength={6}
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={remember}
                    onCheckedChange={(v) => setRemember(v === true)}
                  />
                  <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                    Lembrar sessão
                  </Label>
                </div>
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Esqueceu a senha?
                </button>
              </div>

              <Button type="submit" className="w-full h-11 gap-2 font-semibold" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="text-center pt-2">
                <span className="text-sm text-muted-foreground">Não tem conta? </span>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-sm text-primary hover:text-primary/80 font-semibold transition-colors"
                >
                  Cadastrar-se
                </button>
              </div>
            </form>
          )}

          {/* Sign up form */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="signup-email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="pl-10 h-11"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signup-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="pl-10 h-11"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-11 gap-2 font-semibold" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar conta'}
              </Button>

              <div className="text-center pt-2">
                <span className="text-sm text-muted-foreground">Já tem conta? </span>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-sm text-primary hover:text-primary/80 font-semibold transition-colors"
                >
                  Entrar
                </button>
              </div>
            </form>
          )}

          {/* Forgot password form */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="pl-10 h-11"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-11 gap-2 font-semibold" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <>
                    <KeyRound className="h-4 w-4" />
                    Enviar link de recuperação
                  </>
                )}
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-sm text-primary hover:text-primary/80 font-semibold transition-colors"
                >
                  ← Voltar ao login
                </button>
              </div>
            </form>
          )}

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground/60 pt-4">
            © {new Date().getFullYear()} RH Gestão · Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
