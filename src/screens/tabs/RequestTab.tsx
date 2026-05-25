import { useState, useEffect, useCallback } from 'react';
import { X, Plus, MapPin, Clock } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { spendCoins } from '../../lib/coins';
import PhotoUploadFlow from '../../components/PhotoUploadFlow';
import DunkinCouponFlow from '../../components/DunkinCouponFlow';
import { ToastMessage } from '../../components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pin {
  id: string;
  user_id: string | null;
  pin_type: string;
  is_admin_pin: boolean;
  place_name: string;
  question: string;
  lat: number;
  lng: number;
  status: string;
  urgency: string;
  reward_coin: number;
  curious_count: number;
  expires_at: string | null;
  created_at: string;
}

type SheetMode = null | 'choose' | 'existing' | 'temporary';
type ModalPin = Pin | null;

interface Props {
  session: Session | null;
  balance: number;
  onCoinsChanged: () => void;
  showToast: (text: string, type?: ToastMessage['type']) => void;
}

// ─── Map coordinate helpers ───────────────────────────────────────────────────

const MAP_CENTER = { lat: 37.5588, lng: 126.8374 };
const MAP_SPAN   = { lat: 0.012,  lng: 0.018 };

function latLngToPercent(lat: number, lng: number) {
  const x = ((lng - MAP_CENTER.lng) / MAP_SPAN.lng + 0.5) * 100;
  const y = (0.5 - (lat - MAP_CENTER.lat) / MAP_SPAN.lat) * 100;
  return { x: Math.max(4, Math.min(96, x)), y: Math.max(4, Math.min(96, y)) };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function expiresLabel(iso: string | null): string {
  if (!iso) return '';
  const diff = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  if (diff <= 0) return '만료됨';
  if (diff < 60) return `${diff}초 후 만료`;
  return `${Math.floor(diff / 60)}분 후 만료`;
}

function koreaTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── RequestTab ───────────────────────────────────────────────────────────────

export default function RequestTab({ session, balance, onCoinsChanged, showToast }: Props) {
  const [pins, setPins] = useState<Pin[]>([]);
  const [loadingPins, setLoadingPins] = useState(true);
  const [selectedPin, setSelectedPin] = useState<ModalPin>(null);
  const [uploadingPin, setUploadingPin] = useState<Pin | null>(null);
  const [showCouponFor, setShowCouponFor] = useState<Pin | null>(null);
  const [sheet, setSheet] = useState<SheetMode>(null);

  const loadPins = useCallback(async () => {
    const { data } = await supabase
      .from('pins')
      .select('*')
      .neq('status', 'expired')
      .order('created_at', { ascending: false });
    setPins(data ?? []);
    setLoadingPins(false);
  }, []);

  useEffect(() => { loadPins(); }, [loadPins]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPins((prev) => prev.filter((p) => {
        if (!p.expires_at) return true;
        return new Date(p.expires_at).getTime() > Date.now();
      }));
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  function pinColor(pin: Pin) {
    if (pin.is_admin_pin) return { dot: '#f59e0b', glow: 'rgba(245,158,11,0.5)', ring: '#f59e0b66' };
    if (pin.status === 'completed') return { dot: '#00ff88', glow: 'rgba(0,255,136,0.4)', ring: '#00ff8844' };
    if (pin.urgency === 'hot' || pin.urgency === 'urgent') return { dot: '#f43f5e', glow: 'rgba(244,63,94,0.5)', ring: '#f43f5e66' };
    return { dot: '#60a5fa', glow: 'rgba(96,165,250,0.4)', ring: '#60a5fa44' };
  }

  const openPins = pins.filter((p) => p.status === 'open').length;

  return (
    <div className="relative" style={{ height: 'calc(100vh - 72px)', backgroundColor: '#f9f7f2', overflow: 'hidden' }}>
      {/* Map */}
      <div className="relative w-full h-full" style={{ backgroundColor: '#e8f0e4' }}>
        {/* Grid lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.7 }}>
          {Array.from({ length: 24 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={`${(i / 24) * 100}%`} x2="100%" y2={`${(i / 24) * 100}%`}
              stroke="#c8d8c0" strokeWidth="1" />
          ))}
          {Array.from({ length: 24 }).map((_, i) => (
            <line key={`v${i}`} x1={`${(i / 24) * 100}%`} y1="0" x2={`${(i / 24) * 100}%`} y2="100%"
              stroke="#c8d8c0" strokeWidth="1" />
          ))}
          <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#b8ccb0" strokeWidth="6" />
          <line x1="0" y1="56%" x2="100%" y2="56%" stroke="#b8ccb0" strokeWidth="6" />
          <line x1="22%" y1="0" x2="36%" y2="100%" stroke="#c4d4bc" strokeWidth="4" />
          <line x1="64%" y1="0" x2="78%" y2="100%" stroke="#c4d4bc" strokeWidth="4" />
          <line x1="0" y1="28%" x2="100%" y2="32%" stroke="#c8d8c0" strokeWidth="3" />
          <line x1="0" y1="74%" x2="100%" y2="78%" stroke="#c8d8c0" strokeWidth="3" />
        </svg>

        {/* Station marker */}
        <div className="absolute" style={{ top: '56%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 5 }}>
          <div className="flex flex-col items-center gap-1">
            <div
              className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"
              style={{ backgroundColor: '#ffffffcc', color: '#4338ca', border: '1px solid #a5b4fc' }}
            >
              📍 마곡역
            </div>
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#818cf8', boxShadow: '0 0 10px #818cf8' }} />
          </div>
        </div>

        {/* Pins */}
        {!loadingPins && pins.map((pin) => {
          const { x, y } = latLngToPercent(pin.lat, pin.lng);
          const colors = pinColor(pin);
          const isPulsing = pin.status === 'open' && pin.urgency !== 'normal';
          return (
            <button
              key={pin.id}
              onClick={() => setSelectedPin(pin)}
              className="absolute flex flex-col items-center gap-0.5"
              style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)', zIndex: 10 }}
            >
              <div
                className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap max-w-28 truncate"
                style={{ backgroundColor: '#ffffffdd', color: colors.dot, border: `1px solid ${colors.ring}` }}
              >
                {pin.is_admin_pin ? '👑 ' : ''}{pin.place_name}
              </div>
              <div className="relative flex items-center justify-center w-5 h-5">
                {isPulsing && (
                  <div className="absolute w-5 h-5 rounded-full animate-ping"
                    style={{ backgroundColor: colors.dot, opacity: 0.4 }} />
                )}
                <div className="w-3.5 h-3.5 rounded-full relative z-10"
                  style={{ backgroundColor: colors.dot, boxShadow: `0 0 10px ${colors.glow}` }} />
              </div>
            </button>
          );
        })}

        {/* Top count */}
        <div
          className="absolute top-5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
          style={{ backgroundColor: '#ffffffee', color: '#4338ca', border: '1px solid #c7d2fe', zIndex: 10 }}
        >
          {loadingPins ? '로딩 중...' : `지도에 ${openPins}개의 요청이 있어요`}
        </div>

        {/* Legend */}
        <div
          className="absolute bottom-4 left-4 rounded-xl p-2.5 text-xs space-y-1.5"
          style={{ backgroundColor: '#ffffffee', border: '1px solid #e5e7eb', zIndex: 10 }}
        >
          <div className="flex items-center gap-1.5"><span>👑</span><span style={{ color: '#6b7280' }}>관리자 핀</span></div>
          <div className="flex items-center gap-1.5"><span>🔴</span><span style={{ color: '#6b7280' }}>진행중</span></div>
          <div className="flex items-center gap-1.5"><span>✅</span><span style={{ color: '#6b7280' }}>완료</span></div>
        </div>

        {/* Add button */}
        <button
          onClick={() => setSheet('choose')}
          className="absolute flex items-center justify-center active:scale-90 transition-transform"
          style={{
            bottom: '24px', right: '20px', zIndex: 20,
            width: '52px', height: '52px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #f43f5e, #fb7185)',
            boxShadow: '0 6px 24px rgba(244,63,94,0.5)',
          }}
        >
          <Plus size={26} color="white" strokeWidth={2.5} />
        </button>
      </div>

      {/* Pin detail modal */}
      {selectedPin && (
        <PinDetailModal
          pin={selectedPin}
          onClose={() => setSelectedPin(null)}
          onStartUpload={(pin) => { setSelectedPin(null); setUploadingPin(pin); }}
          onShowCoupon={(pin) => { setSelectedPin(null); setShowCouponFor(pin); }}
          onCuriousClick={async () => {
            await supabase
              .from('pins')
              .update({ curious_count: selectedPin.curious_count + 1 })
              .eq('id', selectedPin.id);
            setPins((prev) =>
              prev.map((p) => p.id === selectedPin.id ? { ...p, curious_count: p.curious_count + 1 } : p)
            );
            setSelectedPin((p) => p ? { ...p, curious_count: p.curious_count + 1 } : p);
          }}
        />
      )}

      {/* Photo upload flow */}
      {uploadingPin && session && (
        <PhotoUploadFlow
          pin={uploadingPin}
          session={session}
          onClose={() => setUploadingPin(null)}
          onSuccess={() => {
            setPins((prev) =>
              prev.map((p) => p.id === uploadingPin.id ? { ...p, status: 'completed' } : p)
            );
          }}
        />
      )}

      {/* Dunkin coupon flow */}
      {showCouponFor && session && (
        <DunkinCouponFlow
          session={session}
          onClose={() => setShowCouponFor(null)}
        />
      )}

      {/* Creation sheet */}
      {sheet && (
        <CreationSheet
          mode={sheet}
          session={session}
          balance={balance}
          onClose={() => setSheet(null)}
          onModeChange={setSheet}
          onCreated={() => { setSheet(null); loadPins(); onCoinsChanged(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ─── PinDetailModal ───────────────────────────────────────────────────────────

function PinDetailModal({ pin, onClose, onStartUpload, onShowCoupon, onCuriousClick }: {
  pin: Pin;
  onClose: () => void;
  onStartUpload: (pin: Pin) => void;
  onShowCoupon: (pin: Pin) => void;
  onCuriousClick: () => void;
}) {
  const isDunkin = pin.place_name.includes('던킨');

  return (
    <div
      className="fixed inset-0 z-40 flex items-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl p-6"
        style={{ backgroundColor: '#ffffff', border: '1px solid #ede8e0' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{pin.is_admin_pin ? '👑' : pin.urgency === 'hot' ? '🔥' : '📍'}</span>
            <div>
              <p className="font-bold text-base" style={{ color: '#0d0d0d' }}>{pin.place_name}</p>
              <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{koreaTimeLabel(pin.created_at)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full" style={{ backgroundColor: '#f3f4f6' }}>
            <X size={16} color="#6b7280" />
          </button>
        </div>

        <p className="text-sm mb-4" style={{ color: '#4b5563' }}>"{pin.question}"</p>

        <div
          className="flex items-center justify-center gap-2 py-3 rounded-xl mb-4"
          style={{ backgroundColor: '#fefce8', border: '1px solid #fde68a' }}
        >
          <span className="text-2xl font-black" style={{ color: '#f59e0b' }}>+{pin.reward_coin}</span>
          <span className="text-sm font-bold" style={{ color: '#f59e0b' }}>코인</span>
        </div>

        {pin.expires_at && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4 text-xs"
            style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', color: '#f43f5e' }}
          >
            <Clock size={12} />
            {expiresLabel(pin.expires_at)}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <span className="text-xs" style={{ color: '#9ca3af' }}>👀 {pin.curious_count}명이 궁금해요</span>
          <span
            className="text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{
              backgroundColor: pin.status === 'completed' ? '#f0fdf4' : '#fff1f2',
              color: pin.status === 'completed' ? '#16a34a' : '#f43f5e',
              border: `1px solid ${pin.status === 'completed' ? '#bbf7d0' : '#fecdd3'}`,
            }}
          >
            {pin.status === 'completed' ? '응답완료' : '진행중'}
          </span>
        </div>

        {isDunkin ? (
          <div className="space-y-3">
            <div
              className="rounded-2xl p-4 text-center"
              style={{ background: 'linear-gradient(135deg, #1a1200, #0d0900)', border: '2px solid #f59e0b' }}
            >
              <p className="text-2xl mb-1">🍩</p>
              <p className="font-black text-base" style={{ color: '#fbbf24' }}>도넛 1+1 쿠폰</p>
              <p className="text-xs mt-1" style={{ color: '#d97706' }}>당일 한정 · 오늘 22:00까지</p>
            </div>
            <button
              onClick={() => onShowCoupon(pin)}
              className="w-full py-3.5 rounded-2xl font-black text-sm active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: '#1a0f00', boxShadow: '0 4px 20px rgba(245,158,11,0.4)' }}
            >
              내 쿠폰으로 받기 🎁
            </button>
            <button
              onClick={onCuriousClick}
              className="w-full py-3 rounded-2xl font-bold text-sm active:scale-95 transition-transform"
              style={{ backgroundColor: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' }}
            >
              나도 궁금 👀
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={onCuriousClick}
              className="flex-1 py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-transform"
              style={{ backgroundColor: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' }}
            >
              나도 궁금 👀
            </button>
            <button
              onClick={() => onStartUpload(pin)}
              className="flex-1 py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-transform"
              style={{
                background: 'linear-gradient(135deg, #f43f5e, #fb7185)',
                color: 'white',
                boxShadow: '0 4px 20px rgba(244,63,94,0.3)',
              }}
            >
              사진 인증하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CreationSheet ────────────────────────────────────────────────────────────

function CreationSheet({ mode, session, balance, onClose, onModeChange, onCreated, showToast }: {
  mode: SheetMode;
  session: Session | null;
  balance: number;
  onClose: () => void;
  onModeChange: (m: SheetMode) => void;
  onCreated: () => void;
  showToast: (text: string, type?: ToastMessage['type']) => void;
}) {
  const [placeName, setPlaceName] = useState('');
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!placeName.trim() || !question.trim()) { setError('장소명과 질문을 입력해주세요.'); return; }
    if (!session?.user?.id) { setError('로그인이 필요합니다.'); return; }
    if (balance < 20) { setError('코인이 부족합니다. 미션을 완료하고 코인을 모아보세요!'); return; }

    setSubmitting(true);
    setError('');

    const isTemp = mode === 'temporary';
    const expiresAt = isTemp ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null;

    await spendCoins(session.user.id, 20, '핀 요청');

    const { error: dbError } = await supabase.from('pins').insert({
      user_id: session.user.id,
      pin_type: isTemp ? 'temporary' : 'existing',
      is_admin_pin: false,
      place_name: placeName.trim(),
      question: question.trim(),
      lat: MAP_CENTER.lat + (Math.random() - 0.5) * MAP_SPAN.lat * 0.6,
      lng: MAP_CENTER.lng + (Math.random() - 0.5) * MAP_SPAN.lng * 0.6,
      status: 'open',
      urgency: 'normal',
      reward_coin: 20,
      expires_at: expiresAt,
    });

    setSubmitting(false);
    if (dbError) { setError('저장 실패. 다시 시도해주세요.'); return; }
    showToast('핀 요청 완료! -20코인', 'info');
    onCreated();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl p-6"
        style={{ backgroundColor: '#ffffff', border: '1px solid #ede8e0' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ backgroundColor: '#e5e7eb' }} />

        {mode === 'choose' && (
          <>
            <p className="font-bold text-base mb-4" style={{ color: '#0d0d0d' }}>핀 유형 선택</p>
            <div className="space-y-3">
              <button
                onClick={() => onModeChange('existing')}
                className="w-full px-4 py-4 rounded-2xl text-left active:scale-98 transition-transform"
                style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}
              >
                <div className="flex items-center gap-3">
                  <MapPin size={20} color="#3b82f6" />
                  <div>
                    <p className="font-semibold text-sm" style={{ color: '#0d0d0d' }}>📍 기존 장소 핀</p>
                    <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>등록된 장소에 질문 남기기 · 20코인</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => onModeChange('temporary')}
                className="w-full px-4 py-4 rounded-2xl text-left active:scale-98 transition-transform"
                style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}
              >
                <div className="flex items-center gap-3">
                  <Clock size={20} color="#f59e0b" />
                  <div>
                    <p className="font-semibold text-sm" style={{ color: '#0d0d0d' }}>📌 임시 현장 핀</p>
                    <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>30분 후 자동 삭제 · 20코인</p>
                  </div>
                </div>
              </button>
            </div>
          </>
        )}

        {(mode === 'existing' || mode === 'temporary') && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => onModeChange('choose')}
                className="p-1.5 rounded-full"
                style={{ backgroundColor: '#f3f4f6' }}
              >
                <X size={14} color="#6b7280" />
              </button>
              <p className="font-bold text-base" style={{ color: '#0d0d0d' }}>
                {mode === 'existing' ? '📍 기존 장소 핀' : '📌 임시 현장 핀'}
              </p>
            </div>

            {mode === 'temporary' && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4 text-xs"
                style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', color: '#f43f5e' }}
              >
                <Clock size={12} />
                30분 후 자동 삭제됩니다
              </div>
            )}

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#6b7280' }}>
                  {mode === 'existing' ? '장소 검색' : '현장 이름'}
                </label>
                <input
                  value={placeName}
                  onChange={(e) => setPlaceName(e.target.value)}
                  placeholder={mode === 'existing' ? '예: 마곡역 스타벅스' : '예: 이 골목 편의점'}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', color: '#0d0d0d', caretColor: '#f43f5e' }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#6b7280' }}>질문</label>
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="예: 지금 자리 있어요?"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', color: '#0d0d0d', caretColor: '#f43f5e' }}
                />
              </div>
            </div>

            <div
              className="flex items-center gap-1.5 mb-4 px-3 py-2 rounded-xl w-fit"
              style={{ backgroundColor: '#fefce8', border: '1px solid #fde68a' }}
            >
              <span className="text-sm">💰</span>
              <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>20코인 차감</span>
            </div>

            {error && <p className="text-xs mb-3" style={{ color: '#f43f5e' }}>{error}</p>}

            <button
              onClick={submit}
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-transform"
              style={{
                background: submitting ? '#f3f4f6' : 'linear-gradient(135deg, #f43f5e, #fb7185)',
                color: submitting ? '#9ca3af' : 'white',
                boxShadow: submitting ? 'none' : '0 4px 20px rgba(244,63,94,0.4)',
              }}
            >
              {submitting ? '등록 중...' : '요청하기'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
