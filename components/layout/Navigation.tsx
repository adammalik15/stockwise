'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Star, Briefcase, BarChart2,
  Compass, LogOut, TrendingUp, Menu, X, Settings,
  Target, Newspaper, CalendarDays, Zap, LineChart, BookOpen,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const NAV_GROUPS = [
  {
    label: 'Portfolio',
    items: [
      { href: '/dashboard',          label: 'Dashboard',    icon: LayoutDashboard },
      { href: '/watchlist',          label: 'Watchlist',    icon: Star            },
      { href: '/portfolio',          label: 'Portfolio',    icon: Briefcase       },
      { href: '/portfolio-analysis', label: 'Analysis',     icon: BarChart2       },
      { href: '/goals',              label: 'My Goals',     icon: Target          },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/stock-intelligence', label: 'Stock Intel',  icon: LineChart       },
      { href: '/news-intelligence',  label: 'News Intel',   icon: Newspaper       },
      { href: '/earnings',           label: 'Earnings',     icon: CalendarDays    },
      { href: '/trading-agent',      label: 'Trade Agent',  icon: Zap             },
    ],
  },
  {
    label: 'Explore',
    items: [
      { href: '/discover',           label: 'Discover',     icon: Compass         },
      { href: '/learn',              label: 'Learn',        icon: BookOpen        },
      { href: '/settings',           label: 'Settings',     icon: Settings        },
    ],
  },
];

export default function Navigation() {
  const pathname    = usePathname();
  const router      = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail,  setUserEmail]  = useState<string | null>(null);

  useEffect(() => {
    async function getUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setUserEmail(user.email);
    }
    getUser();
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  const displayName = userEmail
    ? userEmail.split('@')[0].charAt(0).toUpperCase() + userEmail.split('@')[0].slice(1)
    : null;

  const NavLinks = () => (
    <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
      {NAV_GROUPS.map(group => (
        <div key={group.label}>
          <p className="px-3 text-[10px] font-semibold text-muted uppercase tracking-widest mb-1">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                    active
                      ? 'bg-accent-green/10 text-accent-green'
                      : 'text-secondary hover:bg-surface-2 hover:text-white'
                  }`}
                >
                  <Icon size={16} className={active ? 'text-accent-green shrink-0' : 'text-muted group-hover:text-white shrink-0'} />
                  <span>{label}</span>
                  {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-green shrink-0" />}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <aside className="hidden lg:flex flex-col w-56 bg-surface-1 border-r border-border h-screen sticky top-0 shrink-0">
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border shrink-0">
          <div className="w-8 h-8 rounded-lg bg-accent-green flex items-center justify-center shrink-0">
            <TrendingUp size={16} className="text-surface" />
          </div>
          <div>
            <span className="font-bold text-white text-lg leading-none">Ziqron</span>
            <p className="text-[10px] text-muted mt-0.5">Invest with Intention</p>
          </div>
        </div>

        {displayName && (
          <div className="mx-3 mt-3 p-3 rounded-xl bg-surface-2 border border-border flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-full bg-accent-green/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-accent-green">{displayName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{displayName}</p>
              <p className="text-[10px] text-muted truncate">{userEmail}</p>
            </div>
          </div>
        )}

        <NavLinks />

        <div className="px-3 py-4 border-t border-border shrink-0">
          <p className="px-3 text-[10px] text-muted mb-2 leading-relaxed">Prices delayed ~15 min. Not financial advice.</p>
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-secondary hover:bg-surface-2 hover:text-white transition-all">
            <LogOut size={16} className="text-muted shrink-0" /> Sign Out
          </button>
        </div>
      </aside>

      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-surface-1 border-b border-border sticky top-0 z-40 w-full">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent-green flex items-center justify-center shrink-0">
            <TrendingUp size={14} className="text-surface" />
          </div>
          <span className="font-bold text-white text-sm">Ziqron</span>
        </div>
        <div className="flex items-center gap-2">
          {displayName && (
            <div className="w-7 h-7 rounded-full bg-accent-green/20 flex items-center justify-center">
              <span className="text-[11px] font-bold text-accent-green">{displayName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <button onClick={() => setMobileOpen(prev => !prev)} className="p-2 rounded-lg bg-surface-2 text-white" aria-label="Toggle menu">
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/70 z-40" onClick={() => setMobileOpen(false)} />
          <div className="lg:hidden fixed top-0 left-0 h-full w-72 bg-surface-1 border-r border-border z-50 flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-accent-green flex items-center justify-center">
                  <TrendingUp size={14} className="text-surface" />
                </div>
                <span className="font-bold text-white">Ziqron</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg bg-surface-2 text-white"><X size={16} /></button>
            </div>
            {displayName && (
              <div className="mx-3 mt-3 p-3 rounded-xl bg-surface-2 border border-border flex items-center gap-2.5 shrink-0">
                <div className="w-9 h-9 rounded-full bg-accent-green/20 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-accent-green">{displayName.charAt(0).toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                  <p className="text-[10px] text-muted truncate">{userEmail}</p>
                </div>
              </div>
            )}
            <NavLinks />
            <div className="px-3 py-4 border-t border-border shrink-0">
              <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-secondary hover:bg-surface-2 hover:text-white transition-all">
                <LogOut size={17} className="shrink-0" /> Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
