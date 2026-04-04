import Navigation from '@/components/layout/Navigation';
import SessionGuard from '@/components/SessionGuard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-surface">
      <SessionGuard />
      <Navigation />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}