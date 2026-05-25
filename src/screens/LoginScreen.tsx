import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1));
      const access_token = params.get('access_token') || '';
      const refresh_token = params.get('refresh_token') || '';
      if (access_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(() => {
          window.location.replace('/');
        });
      }
      return;
    }
    setLoading(false);
  }, []);

  const handleKakaoLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError('');

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (oauthError) {
      setError('카카오 로그인에 실패했습니다. 다시 시도해주세요.');
      setLoading(false);
    }
    // On success the browser redirects to Kakao — spinner stays visible during navigation
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#0d0d0d' }}
    >
      {/* Logo */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
        style={{ background: 'linear-gradient(135deg, #f43f5e, #fb7185)' }}
      >
        <span className="text-white font-black text-3xl select-none">N</span>
      </div>

      <h1 className="text-white font-black text-3xl tracking-widest mb-2">NOWPIC</h1>

      <p className="text-sm mb-10" style={{ color: '#6b7280' }}>
        실시간 위치 사진 요청 플랫폼
      </p>

      <h2 className="text-white font-bold text-2xl text-center leading-snug mb-3">
        지금 그 장소,<br />직접 볼 수 없다면?
      </h2>

      <p className="text-sm text-center mb-8" style={{ color: '#9ca3af' }}>
        근처에 있는 누군가가 대신 찍어드립니다
      </p>

      <div className="flex gap-2 mb-12 flex-wrap justify-center">
        {['실시간 요청', '위치 기반', '빠른 응답'].map((badge) => (
          <span
            key={badge}
            className="text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ backgroundColor: '#1f1f1f', color: '#f43f5e', border: '1px solid #2d2d2d' }}
          >
            {badge}
          </span>
        ))}
      </div>

      <button
        onClick={handleKakaoLogin}
        disabled={loading}
        className="w-full max-w-xs font-bold text-base py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95"
        style={{
          backgroundColor: '#FEE500',
          color: '#191919',
          boxShadow: '0 4px 24px rgba(254,229,0,0.25)',
          transition: 'transform 0.1s ease, box-shadow 0.2s ease',
          opacity: loading ? 0.8 : 1,
        }}
      >
        {loading ? (
          <div
            className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{ borderColor: '#19191944', borderTopColor: '#191919' }}
          />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3C6.477 3 2 6.589 2 11c0 2.818 1.764 5.294 4.42 6.778L5.5 21l4.03-2.165C10.32 19.26 11.148 19.4 12 19.4c5.523 0 10-3.589 10-8.4S17.523 3 12 3z"
              fill="#191919"
            />
          </svg>
        )}
        {loading ? '카카오 연결 중...' : '카카오로 시작하기'}
      </button>

      {error && (
        <p className="text-xs mt-4 text-center" style={{ color: '#f43f5e' }}>{error}</p>
      )}

      <p className="text-xs mt-8 text-center leading-relaxed" style={{ color: '#4b5563' }}>
        로그인 시 서비스 이용약관 및 개인정보처리방침에<br />동의하게 됩니다
      </p>
    </div>
  );
}
