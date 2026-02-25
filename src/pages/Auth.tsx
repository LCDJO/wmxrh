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
import { tenantStorage } from '@/lib/tenant-storage';
import { formatCnpj, isValidCnpj } from '@/lib/cnpj';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Shield, Mail, Lock, ArrowRight, Loader2, KeyRound, Building2, Crown, User, Phone, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';

type LoginIntent = 'platform' | 'tenant' | 'both';

interface TenantEntry {
  id: string;
  name: string;
  role: string;
}

interface DetectedIntent {
  intent: LoginIntent;
  platformRole?: string | null;
  tenants: TenantEntry[];
}

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyDocument, setCompanyDocument] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [cnpjError, setCnpjError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [detectedIntent, setDetectedIntent] = useState<DetectedIntent | null>(null);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /**
   * Detect login intent: PlatformUser, TenantUser, or Both.
   */
  const detectLoginIntent = async (userId: string, userEmail?: string | null): Promise<DetectedIntent> => {
    const [platformRes, tenantRes] = await Promise.all([
      supabase
        .from('platform_users')
        .select('id, role, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle(),
      supabase
        .from('tenant_memberships')
        .select('id, role, tenant_id, tenants(id, name)')
        .eq('user_id', userId)
        .limit(20),
    ]);

    const isPlatform = !!platformRes.data;
    const tenants: TenantEntry[] = (tenantRes.data ?? [])
      .filter((m: any) => m.tenants)
      .map((m: any) => ({
        id: m.tenants.id,
        name: m.tenants.name,
        role: m.role ?? 'member',
      }));
    const isTenant = tenants.length > 0;

    if (isPlatform) {
      identityIntelligence.setDetectedUserType('platform', 'db_lookup', platformRes.data?.role ?? null);
    } else if (isTenant) {
      identityIntelligence.setDetectedUserType('tenant', 'db_lookup');
    }

    if (isPlatform && isTenant) {
      return { intent: 'both', platformRole: platformRes.data?.role, tenants };
    }
    if (isPlatform) {
      return { intent: 'platform', platformRole: platformRes.data?.role, tenants: [] };
    }
    // Multiple tenants without platform → also show selector
    if (tenants.length > 1) {
      return { intent: 'both', tenants };
    }
    return { intent: 'tenant', tenants };
  };

  /**
   * Route based on detected intent.
   */
  const routeByIntent = (intent: DetectedIntent) => {
    // Check for pending redirect (e.g. display pairing QR flow)
    const pendingRedirect = sessionStorage.getItem('redirectAfterLogin');
    
    if (pendingRedirect) {
      sessionStorage.removeItem('redirectAfterLogin');
      // Still set tenant context if needed
      if (intent.intent === 'tenant' && intent.tenants.length === 1) {
        tenantStorage.set(intent.tenants[0].id);
      }
      
      navigate(pendingRedirect, { replace: true });
      return;
    }

    switch (intent.intent) {
      case 'platform':
        platformEvents.userLoggedIn('', email);
        navigate('/platform/dashboard', { replace: true });
        break;
      case 'tenant': {
        const lastCtx = identityIntelligence.contextMemory.getLastValidContext();
        if (lastCtx && intent.tenants.length === 1 && lastCtx.tenantId === intent.tenants[0]?.id) {
          tenantStorage.set(lastCtx.tenantId);
        } else if (intent.tenants.length === 1) {
          tenantStorage.set(intent.tenants[0].id);
        }
        navigate('/', { replace: true });
        break;
      }
      case 'both':
        setDetectedIntent(intent);
        setSelectorOpen(true);
        break;
    }
  };

  const handleSelectWorkspace = (choice: 'platform' | 'tenant', tenantId?: string) => {
    setSelectorOpen(false);

    // Check for pending redirect (e.g. display pairing QR flow)
    const pendingRedirect = sessionStorage.getItem('redirectAfterLogin');
    if (pendingRedirect) {
      sessionStorage.removeItem('redirectAfterLogin');
      if (tenantId) tenantStorage.set(tenantId);
      navigate(pendingRedirect, { replace: true });
      return;
    }

    if (choice === 'platform') {
      platformEvents.userLoggedIn('', email);
      navigate('/platform/dashboard', { replace: true });
    } else {
      if (tenantId) {
        tenantStorage.set(tenantId);
      }
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

    // Detect user intent via DB lookup (platform_users + tenant_memberships)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const intent = await detectLoginIntent(user.id, user.email);
      routeByIntent(intent);
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const cleanDoc = companyDocument.replace(/\D/g, '');
    if (!fullName.trim() || !companyName.trim() || !cleanDoc || !companyPhone.trim()) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha todos os campos para continuar.', variant: 'destructive' });
      setLoading(false);
      return;
    }

    if (cleanDoc.length !== 14 || !isValidCnpj(cleanDoc)) {
      toast({ title: 'CNPJ inválido', description: 'Informe um CNPJ válido com 14 dígitos.', variant: 'destructive' });
      setLoading(false);
      return;
    }

    const { error } = await signUp(email, password, {
      full_name: fullName.trim(),
      company_name: companyName.trim(),
      company_document: companyDocument.trim(),
      company_phone: companyPhone.trim(),
    });

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
            <form onSubmit={handleSignUp} className="space-y-4">
              {/* Personal info */}
              <div className="space-y-1.5">
                <Label htmlFor="signup-name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Nome completo *
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Seu nome completo"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="pl-10 h-11"
                    required
                    autoComplete="name"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signup-email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Email *
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
                  Senha *
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

              {/* Company info separator */}
              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Dados da Empresa
                </p>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-company" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Nome da empresa *
                    </Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                      <Input
                        id="signup-company"
                        type="text"
                        placeholder="Empresa ABC Ltda"
                        value={companyName}
                        onChange={e => setCompanyName(e.target.value)}
                        className="pl-10 h-11"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-cnpj" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        CNPJ *
                      </Label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                        <Input
                          id="signup-cnpj"
                          type="text"
                          placeholder="00.000.000/0000-00"
                          value={companyDocument}
                          onChange={e => {
                            const masked = formatCnpj(e.target.value);
                            setCompanyDocument(masked);
                            const digits = masked.replace(/\D/g, '');
                            if (digits.length === 14 && !isValidCnpj(digits)) {
                              setCnpjError('CNPJ inválido');
                            } else {
                              setCnpjError('');
                            }
                          }}
                          maxLength={18}
                          className={`pl-10 h-11 ${cnpjError ? 'border-destructive' : ''}`}
                          required
                        />
                        {cnpjError && <p className="text-xs text-destructive mt-1">{cnpjError}</p>}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signup-phone" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Telefone *
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                        <Input
                          id="signup-phone"
                          type="tel"
                          placeholder="(00) 00000-0000"
                          value={companyPhone}
                          onChange={e => setCompanyPhone(e.target.value)}
                          className="pl-10 h-11"
                          required
                        />
                      </div>
                    </div>
                  </div>
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

      {/* ═══ Workspace Selector Dialog ═══ */}
      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Escolha onde deseja entrar</DialogTitle>
            <DialogDescription>
              Sua conta possui acesso a múltiplos ambientes.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2.5 pt-2 max-h-[400px] overflow-y-auto">
            {/* Platform option (only if user is platform) */}
            {detectedIntent?.platformRole && (
              <button
                onClick={() => handleSelectWorkspace('platform')}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-purple-500/30 transition-all text-left group"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500 group-hover:bg-purple-500/15 transition-colors">
                  <Crown className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground text-sm">Plataforma SaaS</p>
                  <p className="text-xs text-muted-foreground truncate">
                    Painel administrativo
                    <span className="ml-1 text-purple-500">
                      · {detectedIntent.platformRole.replace('platform_', '').replace(/_/g, ' ')}
                    </span>
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </button>
            )}

            {/* Separator if both platform + tenants */}
            {detectedIntent?.platformRole && detectedIntent.tenants.length > 0 && (
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Tenants</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}

            {/* Individual tenant entries */}
            {detectedIntent?.tenants.map((tenant) => (
              <button
                key={tenant.id}
                onClick={() => handleSelectWorkspace('tenant', tenant.id)}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all text-left group"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground text-sm truncate">{tenant.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{tenant.role}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
