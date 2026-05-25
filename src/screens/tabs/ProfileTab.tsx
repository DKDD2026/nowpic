import { Session } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';
import { CoinTxn, coinsExpiringSoon } from '../../lib/coins';
import { Coupon, loadCoupons } from '../../lib/coupons';
import DunkinCouponFlow from '../../components/DunkinCouponFlow';

interface Props {
  session: Session | null;
  onSignOut: () => void;
  balance: number;
  txns: CoinTxn[];
  txnsLoaded: boolean;
}

function getNickname(session: Session | null): string {
  const m = session?.user?.user_metadata;
  return (
    m?.name ??
    m?.full_name ??
    m?.preferred_username ??
    m?.kakao_name ??
    (m?.kakao_account as { profile?: { nickname?: string } } | undefined)?.profile?.nickname ??
    session?.user?.email?.split('@')[0] ??
    session?.user?.id?.slice(0, 8) ??
    '사용자'
  );
}

const MOCK_RANK = 347;
const TOTAL_FOUNDERS = 1000;
const progressPct = Math.round((MOCK_RANK / TOTAL_FOUNDERS) * 100);

function koreaDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function txnColors(txn: CoinTxn) {
  if (txn.status === 'expired') return { bg: '#f9fafb', border: '#e5e7eb', text: '#9ca3af', amount: '#9ca3af', sign: '' };
  if (txn.status === 'pending') return { bg: '#fffbeb', border: '#fde68a', text: '#92400e', amount: '#f59e0b', sign: '+' };
  if (txn.type === 'spend')  return { bg: '#fff1f2', border: '#fecdd3', text: '#0d0d0d', amount: '#f43f5e', sign: '-' };
  if (txn.type === 'refund') return { bg: '#f0fdf4', border: '#bbf7d0', text: '#0d0d0d', amount: '#16a34a', sign: '+' };
  return { bg: '#f0fdf4', border: '#bbf7d0', text: '#0d0d0d', amount: '#16a34a', sign: '+' };
}

function couponLabel(c: Coupon): string {
  if (c.coupon_type === 'dunkin_1plus1') return '🍩 던킨 도넛 1+1';
  if (c.coupon_type === 'dunkin_donut') return '🍩 던킨 도넛 교환권';
  if (c.coupon_type === 'starbucks_coffee') return '☕ 스타벅스 커피 교환권';
  return '🎟️ 쿠폰';
}

function koreaDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' });
}

export default function ProfileTab({ session, onSignOut, balance, txns, txnsLoaded }: Props) {
  const nickname = getNickname(session);
  const avatarUrl = session?.user?.user_metadata?.avatar_url as string | undefined;
  const expiringSoon = coinsExpiringSoon(txns);
  const missionCount = txns.filter((t) => t.reason === '사진 미션 완료').length;
  const uploadCount  = txns.filter((t) => t.reason === '사진 미션 완료').length;

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponsLoaded, setCouponsLoaded] = useState(false);
  const [showCouponQr, setShowCouponQr] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    loadCoupons(session.user.id).then((data) => { setCoupons(data); setCouponsLoaded(true); });
  }, [session?.user?.id]);

  return (
    <div className="px-5 pt-14 pb-6" style={{ backgroundColor: '#f9f7f2', minHeight: '100vh' }}>
      {/* Expiry warning banner */}
      {expiringSoon > 0 && (
        <div
          className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-2 text-sm font-semibold"
          style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}
        >
          <span>⚠️</span>
          <span>{expiringSoon}코인이 7일 후 소멸됩니다</span>
        </div>
      )}

      {/* Profile card */}
      <div
        className="rounded-3xl p-5 mb-5 flex items-center gap-4"
        style={{ backgroundColor: '#ffffff', border: '1px solid #ede8e0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={nickname} className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #f43f5e, #fb7185)' }}
          >
            <span className="text-white font-black text-2xl select-none">
              {nickname.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-lg truncate" style={{ color: '#0d0d0d' }}>{nickname}</p>
          <p className="text-xs truncate mt-0.5" style={{ color: '#9ca3af' }}>
            {session?.user?.email ?? '가상 세션'}
          </p>
          <div
            className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-bold"
            style={{ backgroundColor: '#fefce8', color: '#b45309', border: '1px solid #fde68a' }}
          >
            🏆 마곡 개척자
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="text-xs font-semibold px-3 py-2 rounded-xl flex-shrink-0"
          style={{ backgroundColor: '#fff1f2', color: '#f43f5e', border: '1px solid #fecdd3' }}
        >
          로그아웃
        </button>
      </div>

      {/* Founder 1000 */}
      <div
        className="rounded-3xl p-5 mb-5"
        style={{
          background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
          border: '2px solid #fde68a',
          boxShadow: '0 2px 8px rgba(245,158,11,0.1)',
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-bold" style={{ color: '#92400e' }}>🏅 Founder 1000</p>
          <p className="text-sm font-black" style={{ color: '#b45309' }}>
            {MOCK_RANK}등 / {TOTAL_FOUNDERS}명
          </p>
        </div>
        <div
          className="w-full h-3 rounded-full mb-3 overflow-hidden"
          style={{ backgroundColor: '#fde68a' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
              boxShadow: '0 0 8px rgba(245,158,11,0.4)',
            }}
          />
        </div>
        <p className="text-xs" style={{ color: '#b45309' }}>
          정식 출시 시 코인 2배 + 닉네임 금테
        </p>
      </div>

      {/* Coin balance */}
      <div
        className="rounded-2xl px-5 py-4 mb-5 flex items-center gap-3"
        style={{ backgroundColor: '#ffffff', border: '1px solid #ede8e0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
      >
        <span className="text-2xl">💰</span>
        <div className="flex-1">
          <p className="font-bold text-lg" style={{ color: '#0d0d0d' }}>{balance} 코인</p>
          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>정식 출시 후 사용 가능</p>
        </div>
        {expiringSoon > 0 && (
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}
          >
            ⚠️ {expiringSoon}만료예정
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: '참여 미션', value: String(missionCount) },
          { label: '업로드', value: String(uploadCount) },
          { label: '코인', value: String(balance) },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-2xl p-4 text-center"
            style={{ backgroundColor: '#ffffff', border: '1px solid #ede8e0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
          >
            <p className="font-black text-xl" style={{ color: '#0d0d0d' }}>{value}</p>
            <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Coupon wallet */}
      <h3 className="font-bold text-base mb-3" style={{ color: '#0d0d0d' }}>🎟️ 쿠폰 지갑</h3>
      {!couponsLoaded ? (
        <div className="flex items-center justify-center py-6 mb-5">
          <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: '#fde68a', borderTopColor: '#f59e0b' }} />
        </div>
      ) : coupons.length === 0 ? (
        <div
          className="rounded-2xl px-5 py-5 text-center mb-5"
          style={{ backgroundColor: '#ffffff', border: '1px solid #ede8e0' }}
        >
          <p className="text-xs" style={{ color: '#9ca3af' }}>아직 쿠폰이 없어요. 미션을 완료해보세요!</p>
        </div>
      ) : (
        <div className="space-y-2 mb-5">
          {coupons.map((c) => {
            const isActive = c.status === 'active';
            const isUsed = c.status === 'used';
            return (
              <div
                key={c.id}
                className="flex items-center justify-between px-4 py-3 rounded-2xl"
                onClick={() => isActive && session && setShowCouponQr(true)}
                style={{
                  backgroundColor: isActive ? '#1a1200' : '#f9fafb',
                  border: `1px solid ${isActive ? '#f59e0b' : '#e5e7eb'}`,
                  opacity: isUsed ? 0.6 : 1,
                  cursor: isActive ? 'pointer' : 'default',
                }}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-semibold"
                    style={{
                      color: isActive ? '#fbbf24' : '#9ca3af',
                      textDecoration: isUsed ? 'line-through' : 'none',
                    }}
                  >
                    {couponLabel(c)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                    {isUsed
                      ? `사용완료 · ${c.redeemed_at ? koreaDateShort(c.redeemed_at) : ''}`
                      : c.expires_at
                      ? `만료: 오늘 22:00`
                      : `발급: ${koreaDateShort(c.issued_at)}`}
                  </p>
                </div>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full ml-3 flex-shrink-0"
                  style={{
                    backgroundColor: isActive ? '#f59e0b22' : '#f3f4f6',
                    color: isActive ? '#f59e0b' : '#9ca3af',
                    border: `1px solid ${isActive ? '#f59e0b44' : '#e5e7eb'}`,
                  }}
                >
                  {c.status === 'active' ? '사용가능' : c.status === 'used' ? '사용완료' : '만료'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {showCouponQr && session && (
        <DunkinCouponFlow
          session={session}
          onClose={() => { setShowCouponQr(false); loadCoupons(session.user.id).then(setCoupons); }}
        />
      )}

      {/* Coin history */}
      <h3 className="font-bold text-base mb-3" style={{ color: '#0d0d0d' }}>💳 코인 내역</h3>
      {!txnsLoaded ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#fde68a', borderTopColor: '#f59e0b' }} />
        </div>
      ) : txns.length === 0 ? (
        <div
          className="rounded-2xl px-5 py-6 text-center"
          style={{ backgroundColor: '#ffffff', border: '1px solid #ede8e0' }}
        >
          <p className="text-xs" style={{ color: '#9ca3af' }}>아직 코인 내역이 없어요</p>
        </div>
      ) : (
        <div className="space-y-2">
          {txns.slice(0, 30).map((txn) => {
            const c = txnColors(txn);
            return (
              <div
                key={txn.id}
                className="flex items-center justify-between px-4 py-3 rounded-2xl"
                style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: c.text }}>{txn.reason}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{koreaDate(txn.created_at)}</p>
                </div>
                <div className="flex flex-col items-end ml-3 flex-shrink-0">
                  <span className="text-sm font-black" style={{ color: c.amount }}>
                    {c.sign}{txn.amount}
                  </span>
                  {txn.status === 'pending' && (
                    <span className="text-xs" style={{ color: '#f59e0b' }}>지급예정</span>
                  )}
                  {txn.status === 'expired' && (
                    <span className="text-xs" style={{ color: '#9ca3af' }}>소멸</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
