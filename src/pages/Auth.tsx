/**
 * /auth/login — Unified SaaS Login
 * 
 * Login Intent Detection:
 *   PlatformUser only  → /platform/dashboard
 *   TenantUser only    → / (tenant workspace)
 *   Both               → Workspace Selector dialog
 */
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { platformEvents } from '@/domains/platform/platform-events';
import { identityIntelligence } from '@/domains/security/kernel/identity-intelligence';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Shield, Mail, Lock, ArrowRight, Loader2, KeyRound, Building2, Crown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

type LoginIntent = 'platform' | 'tenant' | 'both';

interface DetectedIntent {
  intent: LoginIntent;
  platformRole?: string | null;
  tenantCount: number;
}

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [detectedIntent, setDetectedIntent] = useState<DetectedIntent | null>(null);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  /**
   * Detect login intent: PlatformUser, TenantUser, or Both.
   */
  const detectLoginIntent = async (userId: string, userEmail?: string | null): Promise<DetectedIntent> => {
    // Parallel lookups: platform_users + tenant_memberships
    const [platformRes, tenantRes] = await Promise.all([
      supabase
        .from('platform_users')
        .select('id, role, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle(),
      supabase
        .from('tenant_memberships')
        .select('id')
        .eq('user_id', userId)
        .limit(5),
    ]);

    const isPlatform = !!platformRes.data;
    const tenantCount = tenantRes.data?.length ?? 0;
    const isTenant = tenantCount > 0;

    // Feed the LoginIntentDetector
    if (isPlatform) {
      identityIntelligence.setDetectedUserType(
        isTenant ? 'platform' : 'platform',
        'db_lookup',
        platformRes.data?.role ?? null,
      );
    } else if (isTenant) {
      identityIntelligence.setDetectedUserType('tenant', 'db_lookup');
    }

    if (isPlatform && isTenant) {
      return { intent: 'both', platformRole: platformRes.data?.role, tenantCount };
    }
    if (isPlatform) {
      return { intent: 'platform', platformRole: platformRes.data?.role, tenantCount: 0 };
    }
    return { intent: 'tenant', tenantCount };
  };

  /**
   * Route based on detected intent.
   */
  const routeByIntent = (intent: DetectedIntent) => {
    switch (intent.intent) {
      case 'platform':
        platformEvents.userLoggedIn('', email);
        navigate('/platform/dashboard', { replace: true });
        break;
      case 'tenant':
        navigate('/', { replace: true });
        break;
      case 'both':
        // Show workspace selector
        setDetectedIntent(intent);
        setSelectorOpen(true);
        break;
    }
  };

  const handleSelectWorkspace = (choice: 'platform' | 'tenant') => {
    setSelectorOpen(false);
    if (choice === 'platform') {
      platformEvents.userLoggedIn('', email);
      navigate('/platform/dashboard', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);
    if (error) {
      toast({ title: 'Erro de autenticação', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Step 1: Try JWT-level detection
    const { data: { session } } = await supabase.auth.getSession();
    const jwtDetection = identityIntelligence.detectUserTypeFromJwt(session?.access_token);

    // Step 2: If JWT didn't resolve, do DB lookup
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      if (jwtDetection.detectedType !== 'unknown') {
        // JWT resolved — but still check for dual identity
        const intent = await detectLoginIntent(user.id, user.email);
        routeByIntent(intent);
      } else {
        // Fallback: DB lookup
        const intent = await detectLoginIntent(user.id, user.email);
        routeByIntent(intent);
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

      {/* ═══ Workspace Selector Dialog (dual-identity users) ═══ */}
      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Selecionar Workspace</DialogTitle>
            <DialogDescription>
              Sua conta possui acesso a múltiplos ambientes. Escolha onde deseja entrar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 pt-2">
            {/* Platform option */}
            <button
              onClick={() => handleSelectWorkspace('platform')}
              className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all text-left group"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500 group-hover:bg-purple-500/15 transition-colors">
                <Crown className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">Modo Plataforma</p>
                <p className="text-sm text-muted-foreground truncate">
                  Painel administrativo SaaS
                  {detectedIntent?.platformRole && (
                    <span className="ml-1 text-xs text-purple-500">
                      · {detectedIntent.platformRole.replace('platform_', '').replace('_', ' ')}
                    </span>
                  )}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>

            {/* Tenant option */}
            <button
              onClick={() => handleSelectWorkspace('tenant')}
              className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all text-left group"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">Workspace Tenant</p>
                <p className="text-sm text-muted-foreground">
                  Área operacional
                  {detectedIntent?.tenantCount && detectedIntent.tenantCount > 0 && (
                    <span className="ml-1 text-xs text-primary">
                      · {detectedIntent.tenantCount} {detectedIntent.tenantCount === 1 ? 'tenant' : 'tenants'}
                    </span>
                  )}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
