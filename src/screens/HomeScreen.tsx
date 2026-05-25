import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface Props {
  isMock?: boolean;
  onMockLogout?: () => void;
}

export default function HomeScreen({ isMock, onMockLogout }: Props) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!isMock) {
      supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
    }
  }, [isMock]);

  const handleSignOut = async () => {
    if (isMock && onMockLogout) {
      onMockLogout();
      return;
    }
    await supabase.auth.signOut();
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 gap-6"
      style={{ backgroundColor: '#0d0d0d' }}
    >
      {isMock && (
        <div
          className="px-4 py-1.5 rounded-full text-xs font-bold tracking-widest"
          style={{ background: '#fbbf2422', color: '#fbbf24', border: '1px solid #fbbf2444' }}
        >
          MOCK SESSION
        </div>
      )}

      {!isMock && (
        <div
          className="px-6 py-2 rounded-full text-sm font-bold tracking-widest"
          style={{ background: '#00ff8822', color: '#00ff88', border: '1px solid #00ff8844' }}
        >
          LOGIN SUCCESS
        </div>
      )}

      <div
        className="w-20 h-20 rounded-full flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #f43f5e, #fb7185)' }}
      >
        <span className="text-white font-black text-3xl select-none">N</span>
      </div>

      <h1 className="text-white font-black text-3xl tracking-widest">NOWPIC</h1>

      <div
        className="w-full max-w-sm rounded-2xl p-4 text-xs font-mono space-y-1"
        style={{ background: '#1a1a1a', border: '1px solid #2d2d2d', color: '#9ca3af' }}
      >
        <div style={{ color: isMock ? '#fbbf24' : '#00ff88', marginBottom: 8, fontWeight: 'bold' }}>
          {isMock ? 'mock bypass active' : 'session detected — redirect success — navigating to app'}
        </div>
        {isMock ? (
          <div><span style={{ color: '#f43f5e' }}>mode:</span> 개발용 가상 세션 (실제 인증 없음)</div>
        ) : (
          <>
            <div><span style={{ color: '#f43f5e' }}>email:</span> {session?.user?.email ?? '—'}</div>
            <div><span style={{ color: '#f43f5e' }}>id:</span> {session?.user?.id?.slice(0, 16) ?? '—'}…</div>
            <div><span style={{ color: '#f43f5e' }}>provider:</span> {session?.user?.app_metadata?.provider ?? '—'}</div>
            <div><span style={{ color: '#f43f5e' }}>expires:</span> {session?.expires_at ? new Date(session.expires_at * 1000).toLocaleTimeString() : '—'}</div>
          </>
        )}
      </div>

      {/* Placeholder tabs — 5 main tabs for app development */}
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ border: '1px solid #2d2d2d' }}
      >
        {['홈', '탐색', '요청하기', '알림', '프로필'].map((tab, i) => (
          <div
            key={tab}
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors"
            style={{
              borderBottom: i < 4 ? '1px solid #1f1f1f' : undefined,
              color: i === 0 ? '#f43f5e' : '#6b7280',
              background: '#1a1a1a',
            }}
          >
            <span style={{ color: i === 0 ? '#f43f5e' : '#374151' }}>●</span>
            {tab}
          </div>
        ))}
      </div>

      <button
        onClick={handleSignOut}
        className="px-6 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ background: '#1f1f1f', color: '#f43f5e', border: '1px solid #2d2d2d' }}
      >
        {isMock ? '로그인 화면으로' : '로그아웃'}
      </button>
    </div>
  );
}
