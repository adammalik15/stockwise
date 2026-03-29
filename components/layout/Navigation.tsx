'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Star, Briefcase, BarChart2, Compass, LogOut, TrendingUp, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/watchlist', label: 'Watchlist', icon: Star },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { href: '/portfolio-analysis', label: 'Analysis', icon: BarChart2 },
  { href: '/discover', label: 'Discover', icon: Compass },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  const NavContent = () => (
    <>
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-accent-green flex items-center justify-center">
          <TrendingUp size={16} className="text-surface" />
        </div>
        <span className="font-bold text-white text-lg">StockWise</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)}
              className={"flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group " +
                (active ? 'bg-accent-green/10 text-accent-green' : 'text-secondary hover:bg-surface-2 hover:text-white')}>
              <Icon size={17} className={active ? 'text-accent-green' : 'text-muted group-hover:text-white'} />
              {label}
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-green" />}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-border">
        <p className="px-3 text-[10px] text-muted mb-2">Prices delayed ~15 min. Not financial advice.</p>
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-secondary hover:bg-surface-2 hover:text-white transition-all duration-150 group">
          <LogOut size={17} className="text-muted group-hover:text-white" /> Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden lg:flex flex-col w-56 bg-surface-1 border-r border-border h-screen sticky top-0 shrink-0">
        <NavContent />
      </aside>
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-surface-1 border-b border-border sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent-green flex items-center justify-center">
            <TrendingUp size={14} className="text-surface" />
          </div>
          <span className="font-bold text-white">StockWise</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1.5 rounded-lg hover:bg-surface-2 text-secondary">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-surface-1 border-r border-border flex flex-col h-full"><NavContent /></div>
          <div className="flex-1 bg-black/60" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  );
}
