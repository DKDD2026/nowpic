import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { Coupon, issueDunkinCoupon, redeemCoupon } from '../lib/coupons';

// ─── QR code visual ───────────────────────────────────────────────────────────

function QrDisplay({ value }: { value: string }) {
  // Simple visual QR-like grid using the qr_code string as seed
  const size = 9;
  const cells: boolean[] = [];
  for (let i = 0; i < size * size; i++) {
    const charCode = value.charCodeAt(i % value.length);
    cells.push((charCode + i) % 3 !== 0);
  }
  // Fixed finder patterns (corners)
  const finderPositions = new Set<number>();
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      finderPositions.add(r * size + c);
      finderPositions.add(r * size + (size - 1 - c));
      finderPositions.add((size - 1 - r) * size + c);
    }
  }

  return (
    <div
      className="inline-grid p-3 rounded-xl"
      style={{
        gridTemplateColumns: `repeat(${size}, 1fr)`,
        gap: '2px',
        backgroundColor: '#ffffff',
        border: '2px solid #f59e0b44',
      }}
    >
      {cells.map((filled, i) => (
        <div
          key={i}
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '3px',
            backgroundColor: finderPositions.has(i) || filled ? '#1a1a1a' : '#f5f5f5',
          }}
        />
      ))}
    </div>
  );
}

// ─── Coupon number formatter ──────────────────────────────────────────────────

function formatCouponCode(qr: string): string {
  const code = qr.replace(/-/g, '').toUpperCase().slice(0, 16);
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}`;
}

function koreaTime22(): string {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  return `${today.slice(5).replace('-', '/')} 22:00`;
}

interface Props {
  session: Session;
  onClose: () => void;
}

type FlowStep = 'preview' | 'loading' | 'show' | 'staff' | 'done' | 'already_used';

export default function DunkinCouponFlow({ session, onClose }: Props) {
  const [step, setStep] = useState<FlowStep>('preview');
  const [coupon, setCoupon] = useState<Coupon | null>(null);

  const handleGetCoupon = async () => {
    setStep('loading');
    const result = await issueDunkinCoupon(session.user.id);
    if (!result.ok) {
      setStep(result.reason === 'already_used_today' ? 'already_used' : 'preview');
      return;
    }
    setCoupon(result.coupon);
    setStep('show');
  };

  const handleRedeem = async () => {
    if (!coupon) return;
    await redeemCoupon(coupon.id);
    setStep('done');
  };

  // ── Preview ──────────────────────────────────────────────────────────────────
  if (step === 'preview') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        onClick={onClose}
      >
        <div
          className="w-full rounded-t-3xl p-6"
          style={{ backgroundColor: '#161616', border: '1px solid #2d2d2d' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ backgroundColor: '#3d3d3d' }} />
          <div className="flex items-center justify-between mb-5">
            <p className="font-bold text-base" style={{ color: '#f5f5f5' }}>🍩 던킨도너츠 당일 한정</p>
            <button onClick={onClose} className="p-1.5 rounded-full" style={{ backgroundColor: '#2d2d2d' }}>
              <X size={16} color="#9ca3af" />
            </button>
          </div>

          {/* Coupon box */}
          <div
            className="rounded-3xl p-6 mb-5 text-center"
            style={{
              background: 'linear-gradient(135deg, #1a1200, #0d0900)',
              border: '2px solid #f59e0b',
              boxShadow: '0 0 30px rgba(245,158,11,0.2)',
            }}
          >
            <p className="text-4xl mb-3">🍩</p>
            <p className="font-black text-2xl mb-1" style={{ color: '#fbbf24' }}>도넛 1+1 쿠폰</p>
            <p className="text-sm mb-4" style={{ color: '#d97706' }}>당일 한정 스페셜 오퍼</p>
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
              style={{ backgroundColor: '#1a1a00', border: '1px solid #f59e0b44' }}
            >
              <span className="text-xs" style={{ color: '#f59e0b' }}>유효기간: 오늘 {koreaTime22()}까지</span>
            </div>
          </div>

          <button
            onClick={handleGetCoupon}
            className="w-full py-4 rounded-2xl font-black text-base active:scale-95 transition-transform mb-2"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
              color: '#1a0f00',
              boxShadow: '0 6px 24px rgba(245,158,11,0.4)',
            }}
          >
            내 쿠폰으로 받기 🎁
          </button>
          <p className="text-center text-xs" style={{ color: '#4b5563' }}>하루 1장 한정 · 당일 자정 자동 소멸</p>
        </div>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
        <div className="w-12 h-12 rounded-full border-3 animate-spin" style={{ borderColor: '#f59e0b33', borderTopColor: '#f59e0b', borderWidth: '3px' }} />
      </div>
    );
  }

  // ── Already used ─────────────────────────────────────────────────────────────
  if (step === 'already_used') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        onClick={onClose}
      >
        <div
          className="w-full rounded-t-3xl p-6 text-center"
          style={{ backgroundColor: '#161616', border: '1px solid #2d2d2d' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ backgroundColor: '#3d3d3d' }} />
          <p className="text-3xl mb-3">🍩</p>
          <p className="font-bold text-base mb-2" style={{ color: '#f5f5f5' }}>오늘은 이미 사용하셨어요!</p>
          <p className="text-sm mb-6" style={{ color: '#6b7280' }}>내일 다시 도전하세요</p>
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: '#1a0f00' }}
          >
            확인
          </button>
        </div>
      </div>
    );
  }

  // ── Show coupon ──────────────────────────────────────────────────────────────
  if (step === 'show' && coupon) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      >
        <div
          className="w-full rounded-t-3xl p-6"
          style={{ backgroundColor: '#161616', border: '1px solid #f59e0b55' }}
        >
          <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ backgroundColor: '#3d3d3d' }} />
          <div className="flex items-center justify-between mb-4">
            <p className="font-bold text-base" style={{ color: '#fbbf24' }}>🎟️ 내 쿠폰</p>
            <button onClick={onClose} className="p-1.5 rounded-full" style={{ backgroundColor: '#2d2d2d' }}>
              <X size={16} color="#9ca3af" />
            </button>
          </div>

          <div
            className="rounded-3xl p-5 mb-4 text-center"
            style={{ background: 'linear-gradient(135deg, #1a1200, #0d0900)', border: '2px solid #f59e0b' }}
          >
            <p className="font-black text-xl mb-1" style={{ color: '#fbbf24' }}>도넛 1+1 쿠폰</p>
            <p className="text-xs mb-4" style={{ color: '#d97706' }}>유효기간: 오늘 {koreaTime22()}까지</p>
            <div className="flex justify-center mb-3">
              <QrDisplay value={coupon.qr_code} />
            </div>
            <p className="text-xs font-mono tracking-wider" style={{ color: '#9ca3af' }}>
              {formatCouponCode(coupon.qr_code)}
            </p>
          </div>

          <button
            onClick={() => setStep('staff')}
            className="w-full py-4 rounded-2xl font-black text-base active:scale-95 transition-transform"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
              color: '#1a0f00',
              boxShadow: '0 6px 24px rgba(245,158,11,0.4)',
            }}
          >
            매장 직원에게 보여주기
          </button>
        </div>
      </div>
    );
  }

  // ── Staff full-screen ────────────────────────────────────────────────────────
  if (step === 'staff' && coupon) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-between py-12 px-6"
        style={{ backgroundColor: '#0d0900' }}
      >
        {/* Header */}
        <div className="text-center">
          <p className="font-black text-2xl" style={{ color: '#fbbf24' }}>도넛 1+1 쿠폰</p>
          <p className="text-sm mt-1" style={{ color: '#d97706' }}>던킨도너츠 당일 한정</p>
        </div>

        {/* QR */}
        <div className="flex flex-col items-center gap-6">
          <QrDisplay value={coupon.qr_code} />
          <div>
            <p className="text-center text-lg font-mono font-bold tracking-widest" style={{ color: '#fbbf24' }}>
              {formatCouponCode(coupon.qr_code)}
            </p>
            <p className="text-center text-xs mt-2" style={{ color: '#6b7280' }}>
              유효기간: 오늘 {koreaTime22()}까지
            </p>
          </div>
        </div>

        {/* Staff confirm */}
        <div className="w-full space-y-3">
          <button
            onClick={handleRedeem}
            className="w-full py-4 rounded-2xl font-black text-base active:scale-95 transition-transform"
            style={{
              background: 'linear-gradient(135deg, #16a34a, #22c55e)',
              color: 'white',
              boxShadow: '0 6px 24px rgba(22,163,74,0.4)',
            }}
          >
            직원 확인 완료 ✓
          </button>
          <button
            onClick={() => setStep('show')}
            className="w-full py-3 rounded-2xl font-bold text-sm"
            style={{ backgroundColor: '#1a1a1a', color: '#9ca3af', border: '1px solid #2d2d2d' }}
          >
            뒤로
          </button>
        </div>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
        style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
      >
        <div
          className="w-full max-w-sm rounded-3xl p-8 text-center"
          style={{ backgroundColor: '#161616', border: '1px solid #22c55e44' }}
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: '#052e16', border: '2px solid #22c55e' }}
          >
            <Check size={36} color="#22c55e" />
          </div>
          <p className="font-black text-xl mb-2" style={{ color: '#f5f5f5' }}>사용 완료!</p>
          <p className="text-2xl mb-4">🍩</p>
          <p className="text-sm mb-6" style={{ color: '#9ca3af' }}>맛있게 드세요</p>
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: '#1a0f00' }}
          >
            확인
          </button>
        </div>
      </div>
    );
  }

  return null;
}
