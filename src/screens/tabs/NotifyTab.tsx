import { useState } from 'react';

interface Egg {
  id: number;
  emoji: string;
  label: string;
  sublabel: string;
  rarity: 'gold' | 'silver' | 'mystery';
  hatched: boolean;
  badge: string;
}

interface Badge {
  emoji: string;
  name: string;
  locked: boolean;
}

const BADGES: Badge[] = [
  { emoji: '🦊', name: '마곡 여우', locked: false },
  { emoji: '🐉', name: '전설의 용', locked: true },
  { emoji: '🦁', name: '지역 사자왕', locked: true },
  { emoji: '🌟', name: '개척자', locked: false },
  { emoji: '🔥', name: '핫스팟 헌터', locked: true },
  { emoji: '🍩', name: '던킨 마스터', locked: true },
];

const INITIAL_EGGS: Egg[] = [
  { id: 1, emoji: '🥚', label: '희귀 알', sublabel: '탭하여 부화', rarity: 'gold', hatched: false, badge: '🦊 마곡 여우' },
  { id: 2, emoji: '🥚', label: '일반 알', sublabel: '탭하여 부화', rarity: 'silver', hatched: false, badge: '🌟 개척자' },
  { id: 3, emoji: '🥚', label: '???', sublabel: '특정 장소에서 부화', rarity: 'mystery', hatched: false, badge: '🐉 전설의 용' },
];

const RARITY_COLORS = {
  gold:    { bg: '#fefce8', border: '#fde68a', text: '#b45309' },
  silver:  { bg: '#f9fafb', border: '#d1d5db', text: '#6b7280' },
  mystery: { bg: '#eef2ff', border: '#c7d2fe', text: '#6366f1' },
};

export default function NotifyTab() {
  const [eggs, setEggs] = useState<Egg[]>(INITIAL_EGGS);
  const [hatching, setHatching] = useState<number | null>(null);

  const tapEgg = (id: number) => {
    const egg = eggs.find((e) => e.id === id);
    if (!egg || egg.hatched || egg.rarity === 'mystery') return;
    setHatching(id);
    setTimeout(() => {
      setEggs((prev) => prev.map((e) => e.id === id ? { ...e, hatched: true } : e));
      setHatching(null);
    }, 1200);
  };

  return (
    <div className="px-5 pt-14 pb-6" style={{ backgroundColor: '#f9f7f2', minHeight: '100vh' }}>
      <h1 className="font-black text-2xl mb-6" style={{ color: '#0d0d0d' }}>🥚 나의 도감</h1>

      {/* Egg inventory */}
      <div className="flex gap-3 overflow-x-auto pb-3 mb-8" style={{ scrollbarWidth: 'none' }}>
        {eggs.map((egg) => {
          const colors = RARITY_COLORS[egg.rarity];
          const isHatching = hatching === egg.id;
          return (
            <button
              key={egg.id}
              onClick={() => tapEgg(egg.id)}
              className="flex-shrink-0 rounded-2xl p-4 w-32 text-center flex flex-col items-center"
              style={{
                backgroundColor: colors.bg,
                border: `2px solid ${colors.border}`,
                transform: isHatching ? 'scale(1.08)' : 'scale(1)',
                transition: 'transform 0.15s ease',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              {isHatching ? (
                <>
                  <span className="text-3xl mb-1 animate-spin" style={{ display: 'inline-block' }}>✨</span>
                  <p className="text-xs font-semibold" style={{ color: colors.text }}>부화 중...</p>
                </>
              ) : egg.hatched ? (
                <>
                  <span className="text-3xl mb-1">{egg.badge.split(' ')[0]}</span>
                  <p className="text-xs font-semibold" style={{ color: '#16a34a' }}>부화 완료!</p>
                  <p className="text-xs mt-0.5" style={{ color: colors.text }}>{egg.badge.split(' ').slice(1).join(' ')}</p>
                </>
              ) : (
                <>
                  <span
                    className="text-3xl mb-1"
                    style={{
                      display: 'inline-block',
                      animation: 'bounce 1.4s infinite',
                      animationDelay: `${egg.id * 0.2}s`,
                    }}
                  >{egg.emoji}</span>
                  <p className="text-xs font-bold mt-1" style={{ color: colors.text }}>{egg.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9ca3af', fontSize: '10px' }}>{egg.sublabel}</p>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Badge grid */}
      <h3 className="font-bold text-base mb-4" style={{ color: '#0d0d0d' }}>뱃지 컬렉션</h3>
      <div className="grid grid-cols-2 gap-3">
        {BADGES.map(({ emoji, name, locked }) => (
          <div
            key={name}
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{
              backgroundColor: locked ? '#f5f5f5' : '#fefce8',
              border: `1px solid ${locked ? '#e5e7eb' : '#fde68a'}`,
              opacity: locked ? 0.65 : 1,
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}
          >
            <span className="text-2xl" style={{ filter: locked ? 'grayscale(1)' : 'none' }}>
              {locked ? '🔒' : emoji}
            </span>
            <div>
              <p className="text-sm font-bold" style={{ color: locked ? '#9ca3af' : '#92400e' }}>
                {name}
              </p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                {locked ? 'LOCKED' : 'UNLOCKED'}
              </p>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
