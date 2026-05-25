import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import LoginScreen from './screens/LoginScreen';
import MainLayout from './screens/MainLayout';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f9f7f2' }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: '#f43f5e33', borderTopColor: '#f43f5e' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f9f7f2' }}>
      {session ? <MainLayout session={session} onSignOut={handleSignOut} /> : <LoginScreen />}
    </div>
  );
}