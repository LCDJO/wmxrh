/**
 * SiteNavbar — Platform-aware institutional site navigation.
 *
 * Integrates:
 *  - Platform Design System (semantic tokens)
 *  - Navigation Intelligence (site structure pages)
 *  - Identity Awareness (login state detection)
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { siteStructureManager } from '@/domains/platform-growth/site-structure-manager';
import { Menu, X, LogIn, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SiteNavbarProps {
  domain?: string;
}

export function SiteNavbar({ domain = 'default' }: SiteNavbarProps) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const structure = siteStructureManager.getOrCreate(domain);
  const visiblePages = structure.pages
    .filter(p => p.isVisible)
    .sort((a, b) => a.order - b.order);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo / Brand */}
        <Link to="/" className="text-xl font-bold text-foreground">
          {structure.name}
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {visiblePages.map(page => (
            <Link
              key={page.id}
              to={page.slug}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {page.title}
            </Link>
          ))}
        </div>

        {/* Identity-aware CTA */}
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Button asChild variant="default" size="sm">
              <Link to="/dashboard">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Painel
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth">
                  <LogIn className="mr-2 h-4 w-4" />
                  Entrar
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth?tab=signup">Começar Grátis</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent md:hidden"
          onClick={() => setMobileOpen(v => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border bg-background px-4 pb-4 pt-2 md:hidden">
          {visiblePages.map(page => (
            <Link
              key={page.id}
              to={page.slug}
              onClick={() => setMobileOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              {page.title}
            </Link>
          ))}
          <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
            {user ? (
              <Button asChild variant="default" size="sm" className="w-full">
                <Link to="/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Painel
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="w-full">
                  <Link to="/auth">Entrar</Link>
                </Button>
                <Button asChild size="sm" className="w-full">
                  <Link to="/auth?tab=signup">Começar Grátis</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
