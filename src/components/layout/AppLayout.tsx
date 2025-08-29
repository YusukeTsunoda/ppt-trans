import AppNavigation from './AppNavigation';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-slate-50">
      {user && <AppNavigation user={user} />}
      <main className="animate-fadeIn">
        {children}
      </main>
    </div>
  );
}