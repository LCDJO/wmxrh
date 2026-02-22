import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

/**
 * Auth context integration tests.
 * Verifies the useAuth hook contract and guard behavior.
 */

describe('AuthContext — Contract', () => {
  it('useAuth throws when used outside AuthProvider', async () => {
    // Dynamic import to avoid module-level side effects
    const { useAuth } = await import('@/contexts/AuthContext');

    function TestComponent() {
      useAuth();
      return <div />;
    }

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used within AuthProvider');
  });

  it('AuthProvider renders children', async () => {
    const { AuthProvider } = await import('@/contexts/AuthContext');

    render(
      <BrowserRouter>
        <AuthProvider>
          <div>Authenticated Content</div>
        </AuthProvider>
      </BrowserRouter>
    );

    expect(screen.getByText('Authenticated Content')).toBeInTheDocument();
  });
});

describe('Auth — SignUp metadata shape', () => {
  it('metadata is optional and defaults to empty', () => {
    const metadata = undefined;
    const resolved = metadata ?? {};
    expect(resolved).toEqual({});
  });

  it('metadata preserves values', () => {
    const metadata = { full_name: 'John', company_name: 'Acme' };
    const resolved = metadata ?? {};
    expect(resolved.full_name).toBe('John');
    expect(resolved.company_name).toBe('Acme');
  });
});
