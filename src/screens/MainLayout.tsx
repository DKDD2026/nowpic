import { useState, useEffect, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { Home, Compass, Camera, Bell, User } from 'lucide-react';
import HomeTab from './tabs/HomeTab';
import ExploreTab from './tabs/ExploreTab';
import RequestTab from './tabs/RequestTab';
import NotifyTab from './tabs/NotifyTab';
import ProfileTab from './tabs/ProfileTab';
import Toast, { useToast } from '../components/Toast';
import {
  CoinTxn,
  loadTxns,
  expireStaleCoins,
  giveWelcomeBonus,
  doDailyCheckIn,
  computeBalance,
  coinsExpiringSoon,
} from '../lib/coins';
import { runAutoRefund } from '../lib/coupons';

interface Props {
  session: Session | null;
  onSignOut: () => void;
}

const TABS = [
  { id: 'home',    label: '홈',      Icon: Home },
  { id: 'explore', label: '기웃기웃', Icon: Compass },
  { id: 'request', label: '요청하기', Icon: Camera },
  { id: 'notify',  label: '도감',    Icon: Bell },
  { id: 'profile', label: '마이',    Icon: User },
] as const;

type TabId = typeof TABS[number]['id'];

export default function MainLayout({ session, onSignOut }: Props) {
  const [active, setActive] = useState<TabId>('home');
  const [txns, setTxns] = useState<CoinTxn[]>([]);
  const [txnsLoaded, setTxnsLoaded] = useState(false);
  const { messages, show, dismiss } = useToast();

  const userId = session?.user?.id;

  const refreshTxns = useCallback(async () => {
    if (!userId) return;
    const data = await loadTxns(userId);
    setTxns(data);
    setTxnsLoaded(true);
  }, [userId]);

  // Startup coin logic — runs once when user is known
  useEffect(() => {
    if (!userId) return;

    (async () => {
      // 1. Expire stale coins
      await expireStaleCoins(userId);

      // 2. Welcome bonus (idempotent)
      const welcomed = await giveWelcomeBonus(userId);
      if (welcomed) show('🎉 가입 환영 보너스 +100코인 지급!', 'success');

      // 3. Daily check-in
      const checkin = await doDailyCheckIn(userId);
      if (checkin.given) {
        const msg = checkin.consecutiveDays % 7 === 0
          ? `출석 체크! +${checkin.amount}코인 🎉 (7일 연속 보너스!)`
          : `출석 체크! +${checkin.amount}코인 🎉`;
        show(msg, 'success');
      }

      // 4. Refresh txns
      const fresh = await loadTxns(userId);
      setTxns(fresh);
      setTxnsLoaded(true);

      // 5. Expiry warning
      const expiring = coinsExpiringSoon(fresh);
      if (expiring > 0) show(`⚠️ ${expiring}코인이 7일 후 소멸됩니다`, 'warning');
    })();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const balance = computeBalance(txns);

  // Auto-refund: poll every 5 minutes
  useEffect(() => {
    if (!userId) return;

    const check = async () => {
      const refunds = await runAutoRefund();
      const mine = refunds.filter((r) => r.userId === userId);
      if (mine.length > 0) {
        show(`⏰ 30분 내 응답이 없어 20코인이 환불되었습니다`, 'info');
        refreshTxns();
      }
    };

    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f9f7f2' }}>
      <Toast messages={messages} onDismiss={dismiss} />

      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: '72px' }}
      >
        <div key={active} style={{ animation: 'fadeIn 0.18s ease' }}>
          {active === 'home'    && <HomeTab session={session} balance={balance} />}
          {active === 'explore' && <ExploreTab session={session} />}
          {active === 'request' && (
            <RequestTab
              session={session}
              balance={balance}
              onCoinsChanged={refreshTxns}
              showToast={show}
            />
          )}
          {active === 'notify'  && <NotifyTab />}
          {active === 'profile' && (
            <ProfileTab
              session={session}
              onSignOut={onSignOut}
              balance={balance}
              txns={txns}
              txnsLoaded={txnsLoaded}
            />
          )}
        </div>
      </div>

      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 flex items-center justify-around"
        style={{
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderTop: '1px solid #e5e3de',
          backdropFilter: 'blur(16px)',
          height: '72px',
          zIndex: 30,
        }}
      >
        {TABS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => setActive(id)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full active:scale-90 transition-transform"
              style={{ color: isActive ? '#f43f5e' : '#9ca3af' }}
            >
              {id === 'request' ? (
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-0.5"
                  style={{
                    background: 'linear-gradient(135deg, #f43f5e, #fb7185)',
                    boxShadow: '0 4px 20px rgba(244,63,94,0.45)',
                    marginTop: '-18px',
                  }}
                >
                  <Icon size={24} color="white" />
                </div>
              ) : (
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
              )}
              <span style={{ fontSize: '10px', fontWeight: isActive ? 700 : 500 }}>{label}</span>
            </button>
          );
        })}
      </nav>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
