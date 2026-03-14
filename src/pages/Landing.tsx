import { Link } from "react-router-dom";
import {
  Users, FileText, ShieldCheck, Truck, BarChart3,
  Zap, Building2, CheckCircle2, ArrowRight, Brain,
  ClipboardList, HardHat, Globe2, Lock, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Data ─────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: Users,
    title: "Gestão de Pessoas",
    description: "Controle total do ciclo de vida do colaborador: admissão, férias, promoções e desligamento.",
  },
  {
    icon: FileText,
    title: "Folha de Pagamento",
    description: "Simulação e processamento de folha com cálculo automático de encargos e verbas trabalhistas.",
  },
  {
    icon: ShieldCheck,
    title: "eSocial & Conformidade",
    description: "Geração e envio automático de eventos eSocial, LGPD, NR e PCMSO totalmente integrados.",
  },
  {
    icon: HardHat,
    title: "Segurança do Trabalho",
    description: "Gestão completa de EPIs, laudos, NRs e controle de conformidade ocupacional.",
  },
  {
    icon: Truck,
    title: "Gestão de Frota",
    description: "Rastreamento GPS em tempo real via Traccar, análise de comportamento e conformidade de motoristas.",
  },
  {
    icon: Brain,
    title: "Inteligência Estratégica",
    description: "Dashboards executivos com IA para decisões de RH baseadas em dados e predições de risco.",
  },
  {
    icon: Zap,
    title: "Automação de Processos",
    description: "Workflow designer visual para automatizar fluxos de RH sem necessidade de código.",
  },
  {
    icon: ClipboardList,
    title: "Acordos & Documentos",
    description: "Gestão de contratos digitais com assinatura eletrônica integrada (Autentique, ClickSign, Zapsign).",
  },
];

const stats = [
  { value: "100%", label: "Conformidade eSocial" },
  { value: "LGPD", label: "Totalmente adequado" },
  { value: "Multi", label: "Empresas por tenant" },
  { value: "Real-time", label: "Dados ao vivo" },
];

const compliance = [
  { label: "eSocial", desc: "Geração e transmissão automática de todos os eventos" },
  { label: "LGPD", desc: "Gestão de consentimentos, anonimização e relatórios de conformidade" },
  { label: "NR-01 a NR-36", desc: "Controle de laudos, treinamentos e conformidade por NR" },
  { label: "PCMSO", desc: "Gestão de exames e saúde ocupacional integrada" },
  { label: "PCCS", desc: "Conservação auditiva e plano de cargos e salários" },
  { label: "CIPA", desc: "Controle de eleições, atas e conformidade de comissão" },
];

// ─── Subcomponents ────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Building2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">WMX RH</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Funcionalidades</a>
          <a href="#compliance" className="hover:text-foreground transition-colors">Conformidade</a>
          <a href="#sobre" className="hover:text-foreground transition-colors">Sobre</a>
        </nav>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/auth/login">Entrar</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/auth/login">Começar agora <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="pt-32 pb-24 px-6">
      <div className="max-w-4xl mx-auto text-center space-y-6">
        <Badge variant="secondary" className="text-xs px-3 py-1">
          Plataforma completa de RH para empresas brasileiras
        </Badge>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
          Gestão de RH inteligente,{" "}
          <span className="text-primary">100% em conformidade</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Da admissão ao desligamento, passando por eSocial, folha de pagamento, segurança do trabalho
          e inteligência estratégica — tudo em uma única plataforma.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button size="lg" asChild>
            <Link to="/auth/login">
              Acessar plataforma <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#features">Ver funcionalidades</a>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="py-12 border-y bg-muted/30">
      <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="text-3xl font-bold text-primary">{s.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14 space-y-3">
          <Badge variant="outline">Módulos</Badge>
          <h2 className="text-3xl md:text-4xl font-bold">Tudo que o RH moderno precisa</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Módulos integrados que cobrem desde a operação diária até a estratégia de pessoas.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-xl border bg-card p-6 space-y-3 hover:shadow-md transition-shadow"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Compliance() {
  return (
    <section id="compliance" className="py-24 px-6 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14 space-y-3">
          <Badge variant="outline">Conformidade</Badge>
          <h2 className="text-3xl md:text-4xl font-bold">Segurança jurídica em cada processo</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Desenhado para o mercado brasileiro com suporte nativo a todas as exigências regulatórias.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {compliance.map(({ label, desc }) => (
            <div key={label} className="flex gap-3 rounded-xl border bg-card p-5">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-sm">{label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Highlights() {
  return (
    <section id="sobre" className="py-24 px-6">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <Badge variant="outline">Plataforma</Badge>
          <h2 className="text-3xl md:text-4xl font-bold leading-tight">
            Multi-empresa, multi-usuário, tempo real
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Gerencie múltiplas empresas em um único painel com isolamento total de dados,
            controle granular de permissões e atualizações em tempo real via Supabase Realtime.
          </p>
          <ul className="space-y-3">
            {[
              "Controle de acesso por roles e permissões",
              "SSO, SAML e autenticação federada",
              "Workflow designer visual sem código",
              "Integrações com Telegram, GPS e assinatura digital",
              "Dashboards executivos com IA generativa",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm">
                <Star className="h-4 w-4 text-primary shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: Globe2, label: "Multi-tenant" },
            { icon: Lock, label: "Segurança LGPD" },
            { icon: BarChart3, label: "Analytics em tempo real" },
            { icon: Zap, label: "Automações com IA" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="rounded-xl border bg-card p-6 flex flex-col items-center justify-center gap-3 text-center aspect-square"
            >
              <Icon className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-24 px-6 bg-primary text-primary-foreground">
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <h2 className="text-3xl md:text-4xl font-bold">
          Pronto para modernizar o RH da sua empresa?
        </h2>
        <p className="text-primary-foreground/80 text-lg">
          Acesse agora e descubra como a WMX RH pode transformar a gestão de pessoas da sua organização.
        </p>
        <Button size="lg" variant="secondary" asChild>
          <Link to="/auth/login">
            Acessar a plataforma <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t py-10 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
            <Building2 className="h-3 w-3 text-primary-foreground" />
          </div>
          <span className="font-medium text-foreground">WMX RH</span>
        </div>
        <p>© {new Date().getFullYear()} WMX RH. Plataforma de Gestão de Recursos Humanos.</p>
        <Link to="/auth/login" className="hover:text-foreground transition-colors">
          Entrar na plataforma
        </Link>
      </div>
    </footer>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <Features />
        <Compliance />
        <Highlights />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
