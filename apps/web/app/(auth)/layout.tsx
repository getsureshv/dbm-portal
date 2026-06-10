'use client';

import {
  LayoutDashboard,
  FolderOpen,
  Compass,
  MessageSquare,
  LogOut,
  Loader2,
  Building2,
  Search,
  Briefcase,
  Bell,
  ChevronDown,
  Scale,
  Menu,
  X,
  Shield,
  Users,
  KeyRound,
  ClipboardCheck,
  ScrollText,
  Wand2,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState, useRef, useEffect } from 'react';
import { useAuth } from '../../lib/auth-context';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading, logout, firebaseReady } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close the mobile drawer whenever the route changes (e.g. after tapping a nav item).
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Prevent body scroll while the mobile drawer is open.
  useEffect(() => {
    if (mobileNavOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileNavOpen]);

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const navItems = useMemo(() => {
    const role = user?.role;

    if (role === 'ADMIN') {
      return [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/projects', label: 'Projects', icon: Briefcase },
        { href: '/permits', label: 'Permits & Codes', icon: Scale },
        { href: '/chat', label: 'Chat', icon: MessageSquare },
        { href: '/profile', label: 'Profile', icon: Building2 },
      ];
    }

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
      { href: '/permits', label: 'Permits & Codes', icon: Scale },
      { href: '/discovery', label: 'Discovery', icon: Compass },
      { href: '/chat', label: 'Chat', icon: MessageSquare },
      { href: '/profile', label: 'Profile', icon: Building2 },
    ];
  }, [user?.role]);

  // Admin-only access-management section (PR8). Rendered as a separate nav group.
  const adminNavItems = useMemo(() => {
    if (user?.role !== 'ADMIN') return [];
    return [
      { href: '/admin/personas', label: 'Personas', icon: Shield },
      { href: '/admin/users', label: 'User Access', icon: Users },
      { href: '/admin/record-access', label: 'Record Access', icon: KeyRound },
      { href: '/admin/approvals', label: 'Approvals', icon: ClipboardCheck },
      { href: '/admin/audit', label: 'Audit Log', icon: ScrollText },
      // Dev Login tool — only shown when Firebase is NOT configured (i.e. local/dev,
      // never on the production portal that external users test against).
      ...(!firebaseReady
        ? [{ href: '/admin/dev-login', label: 'Dev Login', icon: Wand2 }]
        : []),
    ];
  }, [user?.role, firebaseReady]);

  const isActive = (href: string) => pathname.startsWith(href);

  // Public access for /discovery and the city-integration demo:
  // render minimal public chrome instead of redirecting. We do NOT gate these
  // routes on the auth loading state because they don't require a user.
  const isPublicJurisdictionPath =
    /^\/projects\/[^/]+\/jurisdiction(\/|$)/.test(pathname);
  const isPublicDiscoveryPath = pathname.startsWith('/discovery');
  const isPublicPath = isPublicJurisdictionPath || isPublicDiscoveryPath;

  // Show loading while checking auth — but skip the gate for public paths.
  if (loading && !isPublicPath) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-amber-600" size={32} />
      </div>
    );
  }

  // Render public chrome for unauthenticated visitors on public paths.
  const isPublicJurisdiction = !user && isPublicJurisdictionPath;
  const isPublicDiscovery =
    (!user && isPublicDiscoveryPath) || isPublicJurisdiction;
  if (isPublicDiscovery) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center">
              <span className="text-gold font-bold text-sm">D</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-gray-900 tracking-tight">DBM</span>
              <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">Beta</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-gray-700 hover:text-gray-900 px-3 py-2 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/onboarding"
              className="text-sm font-semibold bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors"
            >
              Sign up
            </Link>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-slate-50">{children}</main>
      </div>
    );
  }

  // AuthContext handles redirect to /login if no user
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-amber-600" size={32} />
      </div>
    );
  }

  const initials = user.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : user.email[0].toUpperCase();

  const displayName = user.name || user.email;

  const roleBadgeLabel =
    user.role === 'PROVIDER' ? 'Provider' : user.role === 'ADMIN' ? 'Admin' : 'Owner';

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Mobile drawer backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-gray-900/50 lg:hidden"
          aria-hidden="true"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/*
        Sidebar.
        - Desktop (lg+): static, pinned 256px column.
        - Mobile: fixed off-canvas drawer that slides in over the content.
      */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 max-w-[80%] bg-white border-r border-gray-200 flex flex-col shrink-0 transform transition-transform duration-300 ease-in-out lg:static lg:z-auto lg:max-w-none lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Mobile-only close button */}
        <button
          onClick={() => setMobileNavOpen(false)}
          className="lg:hidden absolute top-4 right-3 p-2 text-gray-400 hover:text-gray-600 rounded-lg"
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center">
              <span className="text-gold font-bold text-sm">D</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-gray-900 tracking-tight">DBM</span>
              <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">Beta</span>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-1 ml-10">Construction Portal</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-amber-50 text-amber-700 border-l-[3px] border-l-amber-500 pl-[9px]'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={20} className={active ? 'text-amber-600' : 'text-gray-400'} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {adminNavItems.length > 0 && (
            <div className="pt-4 mt-2 border-t border-gray-100">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Administration
              </p>
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? 'bg-amber-50 text-amber-700 border-l-[3px] border-l-amber-500 pl-[9px]'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon size={20} className={active ? 'text-amber-600' : 'text-gray-400'} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        {/* User section at bottom */}
        <div className="px-3 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 rounded-full bg-navy flex items-center justify-center shrink-0">
              <span className="text-gold font-semibold text-xs">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
              <span className="inline-block mt-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                {roleBadgeLabel}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 mt-1 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-sm"
          >
            <LogOut size={16} />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
          {/* Left: hamburger (mobile) + breadcrumb / page context */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            {/* Compact brand on mobile so the bar isn't empty */}
            <Link href="/dashboard" className="lg:hidden flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-lg bg-navy flex items-center justify-center">
                <span className="text-gold font-bold text-xs">D</span>
              </div>
              <span className="text-base font-bold text-gray-900 tracking-tight">DBM</span>
            </Link>
          </div>

          {/* Right: notifications + user avatar */}
          <div className="flex items-center gap-3">
            {/* Notification bell */}
            <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
              <Bell size={20} />
              {/* Notification dot */}
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-200" />

            {/* User avatar dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center">
                  <span className="text-gold font-semibold text-xs">{initials}</span>
                </div>
                <ChevronDown size={14} className="text-gray-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Your Profile
                  </Link>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  );
}
