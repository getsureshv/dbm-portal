'use client';

import { LayoutDashboard, FolderOpen, Compass, MessageSquare, LogOut, Loader2, Building2, Search, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useAuth } from '../../lib/auth-context';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  const navItems = useMemo(() => {
    const role = user?.role;

    if (role === 'PROVIDER') {
      return [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/opportunities', label: 'Opportunities', icon: Search },
        { href: '/chat', label: 'Chat', icon: MessageSquare },
        { href: '/profile', label: 'Profile', icon: Building2 },
      ];
    }

    // OWNER (default)
    return [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/projects', label: 'Projects', icon: Briefcase },
      { href: '/discovery', label: 'Discovery', icon: Compass },
      { href: '/chat', label: 'Chat', icon: MessageSquare },
      { href: '/profile', label: 'Profile', icon: Building2 },
    ];
  }, [user?.role]);

  const isActive = (href: string) => pathname.startsWith(href);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-navy via-navy-dark to-navy-light">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  // AuthContext handles redirect to /login if no user
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-navy via-navy-dark to-navy-light">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  const initials = user.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : user.email[0].toUpperCase();

  const displayName = user.name || user.email;

  return (
    <div className="flex h-screen bg-gradient-to-br from-navy via-navy-dark to-navy-light">
      {/* Sidebar */}
      <aside className="w-64 bg-navy border-r border-white/10 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-white">DBM</span>
            <span className="text-xs text-gold font-semibold">BETA</span>
          </div>
          <p className="text-xs text-white/60 mt-1">Construction Portal</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  active
                    ? 'bg-gold/20 text-gold border border-gold/30'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="px-4 py-2">
            <p className="text-xs text-white/60">Logged in as</p>
            <p className="text-sm font-medium text-white mt-1 truncate">{displayName}</p>
            {user.role && (
              <p className="text-xs text-gold/70 mt-0.5">{user.role}</p>
            )}
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white transition-colors text-sm"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-navy/80 border-b border-white/10 px-8 py-4 flex items-center justify-between">
          <div></div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center">
              <span className="text-gold font-semibold text-sm">{initials}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
