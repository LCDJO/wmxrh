import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Mail, Lock, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = isSignUp 
      ? await signUp(email, password) 
      : await signIn(email, password);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else if (isSignUp) {
      toast({ title: 'Conta criada!', description: 'Verifique seu email para confirmar o cadastro.' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-sidebar items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl gradient-primary mb-8">
            <Users className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold font-display text-sidebar-primary-foreground mb-4">RH Gestão</h1>
          <p className="text-sidebar-foreground/70 text-lg leading-relaxed">
            Plataforma completa de gestão de recursos humanos. Multi-empresa, multi-grupo, com controle total.
          </p>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden flex items-center gap-3 justify-center mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
              <Users className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold font-display text-foreground">RH Gestão</h1>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold font-display text-foreground">
              {isSignUp ? 'Criar conta' : 'Entrar'}
            </h2>
            <p className="text-muted-foreground mt-2">
              {isSignUp ? 'Crie sua conta para começar' : 'Acesse sua plataforma de RH'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" required minLength={6} />
              </div>
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? 'Aguarde...' : isSignUp ? 'Criar conta' : 'Entrar'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-primary hover:underline font-medium"
            >
              {isSignUp ? 'Já tem conta? Entrar' : 'Não tem conta? Cadastrar-se'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
