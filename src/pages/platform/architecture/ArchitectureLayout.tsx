/**
 * Architecture Intelligence Center — Layout with sidebar navigation
 */
import { Outlet, useLocation } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { Boxes, Server, Shield, Briefcase, GitBranch, Activity, BookOpen } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'SaaS Core', path: '/platform/structure/architecture/saas-core', icon: Server, description: 'Módulos de infraestrutura SaaS' },
  { label: 'Tenant Modules', path: '/platform/structure/architecture/tenant-modules', icon: Briefcase, description: 'Módulos de domínio RH' },
  { label: 'Dependency Graph', path: '/platform/structure/architecture/dependency-graph', icon: GitBranch, description: 'Grafo de dependências entre módulos' },
  { label: 'Health Monitor', path: '/platform/structure/architecture/health-monitor', icon: Activity, description: 'Monitoramento integrado' },
  { label: 'Documentation', path: '/platform/structure/architecture/documentation', icon: BookOpen, description: 'Documentação viva e changelog' },
];

export default function ArchitectureLayout() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Architecture Intelligence Center</h1>
          <p className="text-sm text-muted-foreground">Visão arquitetural, dependências, eventos, monitoramento e documentação viva</p>
        </div>
      </div>

      {/* Sub-navigation */}
      <nav className="flex gap-2 border-b border-border pb-0">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground border-b-2 border-transparent transition-colors hover:text-foreground hover:bg-accent/5 -mb-[1px]"
            activeClassName="text-primary border-primary"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
