import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Flag } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { submitReport } from '../../lib/abuse';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pin {
  id: string;
  place_name: string;
  question: string;
  reward_coin: number;
  status: string;
  curious_count: number;
  is_admin_pin: boolean;
  hidden: boolean;
  report_count: number;
  created_at: string;
}

interface Upload {
  id: string;
  pin_id: string;
  photo_url: string;
  submitted_at: string;
  report_count: number;
  pins?: { place_name: string } | null;
}

type FeedItem =
  | { kind: 'pin'; data: Pin; key: string }
  | { kind: 'upload'; data: Upload; key: string };

interface ReportTarget {
  id: string;
  type: 'pin' | 'upload';
  label: string;
}

interface Props {
  session: Session | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const REPORT_REASONS = ['허위 사진', '위치 불일치', '부적절한 내용', '스팸'];

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function isExpired(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() > 10 * 60 * 1000;
}

// ─── Long-press hook ──────────────────────────────────────────────────────────

function useLongPress(callback: () => void, ms = 600) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    timer.current = setTimeout(callback, ms);
  }, [callback, ms]);

  const cancel = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, []);

  return { onPointerDown: start, onPointerUp: cancel, onPointerLeave: cancel };
}

// ─── Pin card ─────────────────────────────────────────────────────────────────

function PinCard({
  pin,
  isNew,
  bouncing,
  heartBurst,
  onPeek,
  onReport,
}: {
  pin: Pin;
  isNew: boolean;
  bouncing: boolean;
  heartBurst: boolean;
  onPeek: () => void;
  onReport: () => void;
}) {
  const lp = useLongPress(onReport);
  const isCompleted = pin.status === 'completed';

  return (
    <div
      {...lp}
      className="rounded-2xl p-4 select-none"
      style={{
        backgroundColor: '#1a1a1a',
        border: `1px solid ${isNew ? '#f43f5e55' : '#2d2d2d'}`,
        boxShadow: isNew ? '0 0 0 2px #f43f5e22' : 'none',
        animation: isNew ? 'slideDown 0.35s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
        cursor: 'default',
        transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0 mr-2">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-bold text-sm truncate" style={{ color: '#f5f5f5' }}>
              {pin.is_admin_pin ? '👑 ' : ''}{pin.place_name}
            </p>
          </div>
          <p className="text-xs" style={{ color: '#6b7280' }}>
            {timeAgo(pin.created_at)}
          </p>
        </div>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
          style={{
            backgroundColor: isCompleted ? '#00ff8815' : '#f43f5e15',
            color: isCompleted ? '#00ff88' : '#f43f5e',
            border: `1px solid ${isCompleted ? '#00ff8833' : '#f43f5e33'}`,
          }}
        >
          {isCompleted ? '응답완료' : '진행중'}
        </span>
      </div>

      <p className="text-sm mb-3 leading-relaxed" style={{ color: '#d1d5db' }}>
        "{pin.question}"
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: '#1a1200', color: '#f59e0b', border: '1px solid #f59e0b33' }}
          >
            +{pin.reward_coin}코인
          </span>
          <span className="text-xs" style={{ color: '#6b7280' }}>
            👀 {pin.curious_count}
          </span>
        </div>
        <div className="relative">
          {heartBurst && (
            <>
              {['❤️', '❤️', '❤️'].map((h, i) => (
                <span
                  key={i}
                  className="absolute text-sm pointer-events-none select-none"
                  style={{
                    top: '-8px',
                    left: `${20 + i * 18}%`,
                    animation: 'heartPop 0.9s ease forwards',
                    animationDelay: `${i * 0.1}s`,
                    opacity: 0,
                  }}
                >{h}</span>
              ))}
            </>
          )}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onPeek(); }}
            className="px-4 py-2 rounded-xl text-xs font-bold"
            style={{
              background: bouncing
                ? 'linear-gradient(135deg, #f59e0b, #fbbf24)'
                : 'linear-gradient(135deg, #f43f5e, #fb7185)',
              color: 'white',
              transform: bouncing ? 'scale(1.12)' : 'scale(1)',
              transition: 'background 0.2s ease, transform 0.15s ease',
            }}
          >
            나도 기웃! 👍
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Upload card ──────────────────────────────────────────────────────────────

function UploadCard({
  upload,
  isNew,
  onReport,
}: {
  upload: Upload;
  isNew: boolean;
  onReport: () => void;
}) {
  const lp = useLongPress(onReport);
  const expired = isExpired(upload.submitted_at);

  return (
    <div
      {...lp}
      className="rounded-2xl overflow-hidden select-none"
      style={{
        backgroundColor: '#1a1a1a',
        border: `1px solid ${isNew ? '#00ff8833' : '#2d2d2d'}`,
        animation: isNew ? 'slideDown 0.35s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
        cursor: 'default',
      }}
    >
      {/* Photo */}
      <div className="relative" style={{ aspectRatio: '16/9', overflow: 'hidden' }}>
        <img
          src={upload.photo_url}
          alt="upload"
          className="w-full h-full object-cover"
          style={{ filter: expired ? 'blur(12px) brightness(0.4)' : 'none', transition: 'filter 0.3s' }}
        />
        {expired && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold" style={{ color: '#9ca3af' }}>만료된 사진입니다</span>
          </div>
        )}
        {!expired && (
          <div
            className="absolute bottom-2 right-2 px-2 py-1 rounded text-xs font-bold"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#ffffff', fontFamily: 'monospace' }}
          >
            NOWPIC
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold" style={{ color: '#f5f5f5' }}>
            📸 {upload.pins?.place_name ?? '현장 사진'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{timeAgo(upload.submitted_at)}</p>
        </div>
        <span
          className="text-xs px-2.5 py-1 rounded-full font-semibold"
          style={{
            backgroundColor: '#00ff8815',
            color: '#00ff88',
            border: '1px solid #00ff8833',
          }}
        >
          ✅ 인증
        </span>
      </div>
    </div>
  );
}

// ─── Report sheet ─────────────────────────────────────────────────────────────

function ReportSheet({
  target,
  onClose,
  onSubmit,
}: {
  target: ReportTarget;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    await onSubmit(selected);
    setDone(true);
    setSubmitting(false);
    setTimeout(onClose, 1200);
  };

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

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flag size={16} color="#f43f5e" />
            <p className="font-bold text-base" style={{ color: '#f5f5f5' }}>신고하기</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full" style={{ backgroundColor: '#2d2d2d' }}>
            <X size={16} color="#9ca3af" />
          </button>
        </div>

        <p className="text-xs mb-4" style={{ color: '#6b7280' }}>
          {target.label}
        </p>

        {done ? (
          <div
            className="py-4 text-center rounded-2xl"
            style={{ backgroundColor: '#00ff8815', color: '#00ff88', border: '1px solid #00ff8833' }}
          >
            <p className="font-bold">신고가 접수되었습니다</p>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-5">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setSelected(r)}
                  className="w-full px-4 py-3 rounded-xl text-left text-sm font-semibold transition-colors"
                  style={{
                    backgroundColor: selected === r ? '#2d0010' : '#1a1a1a',
                    color: selected === r ? '#f43f5e' : '#d1d5db',
                    border: `1px solid ${selected === r ? '#f43f5e55' : '#2d2d2d'}`,
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              onClick={handleSubmit}
              disabled={!selected || submitting}
              className="w-full py-3.5 rounded-2xl font-bold text-sm transition-opacity"
              style={{
                background: 'linear-gradient(135deg, #f43f5e, #fb7185)',
                color: 'white',
                opacity: !selected || submitting ? 0.5 : 1,
              }}
            >
              {submitting ? '처리 중...' : '신고 제출'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ExploreTab({ session }: Props) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [bouncing, setBouncing] = useState<string | null>(null);
  const [heartBurst, setHeartBurst] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [{ data: pins }, { data: uploads }] = await Promise.all([
        supabase
          .from('pins')
          .select('*')
          .eq('hidden', false)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('uploads')
          .select('*, pins(place_name)')
          .order('submitted_at', { ascending: false })
          .limit(20),
      ]);

      const pinItems: FeedItem[] = (pins ?? []).map((p) => ({ kind: 'pin', data: p as Pin, key: `pin-${p.id}` }));
      const uploadItems: FeedItem[] = (uploads ?? []).map((u) => ({ kind: 'upload', data: u as Upload, key: `upload-${u.id}` }));

      // Merge and sort by time descending
      const merged = [...pinItems, ...uploadItems].sort((a, b) => {
        const aTime = a.kind === 'pin' ? a.data.created_at : a.data.submitted_at;
        const bTime = b.kind === 'pin' ? b.data.created_at : b.data.submitted_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      setFeed(merged);
      setLoading(false);
    })();
  }, []);

  // ── Realtime subscriptions ──────────────────────────────────────────────────
  useEffect(() => {
    const pinChannel = supabase
      .channel('explore-pins')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pins' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const p = payload.new as Pin;
            if (p.hidden) return;
            const item: FeedItem = { kind: 'pin', data: p, key: `pin-${p.id}` };
            setFeed((prev) => [item, ...prev]);
            setNewIds((prev) => { const s = new Set(prev); s.add(item.key); return s; });
            setTimeout(() => setNewIds((prev) => { const s = new Set(prev); s.delete(item.key); return s; }), 2000);
          }
          if (payload.eventType === 'UPDATE') {
            const p = payload.new as Pin;
            setFeed((prev) =>
              p.hidden
                ? prev.filter((i) => !(i.kind === 'pin' && i.data.id === p.id))
                : prev.map((i) =>
                    i.kind === 'pin' && i.data.id === p.id
                      ? { ...i, data: p }
                      : i
                  )
            );
          }
        }
      )
      .subscribe();

    const uploadChannel = supabase
      .channel('explore-uploads')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'uploads' },
        async (payload) => {
          const u = payload.new as Upload;
          // Fetch join data
          const { data: pinRow } = await supabase
            .from('pins')
            .select('place_name')
            .eq('id', u.pin_id)
            .maybeSingle();
          const enriched: Upload = { ...u, pins: pinRow };
          const item: FeedItem = { kind: 'upload', data: enriched, key: `upload-${u.id}` };
          setFeed((prev) => [item, ...prev]);
          setNewIds((prev) => { const s = new Set(prev); s.add(item.key); return s; });
          setTimeout(() => setNewIds((prev) => { const s = new Set(prev); s.delete(item.key); return s; }), 2000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(pinChannel);
      supabase.removeChannel(uploadChannel);
    };
  }, []);

  // ── Peek (curious) ──────────────────────────────────────────────────────────
  const handlePeek = async (pinId: string, key: string) => {
    setBouncing(key);
    setHeartBurst(key);
    setTimeout(() => setBouncing(null), 400);
    setTimeout(() => setHeartBurst(null), 900);
    setFeed((prev) =>
      prev.map((i) =>
        i.kind === 'pin' && i.data.id === pinId
          ? { ...i, data: { ...i.data, curious_count: i.data.curious_count + 1 } }
          : i
      )
    );
    await supabase.rpc('increment_curious', { pin_id: pinId }).catch(() => {
      supabase
        .from('pins')
        .select('curious_count')
        .eq('id', pinId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            supabase.from('pins').update({ curious_count: (data.curious_count ?? 0) + 1 }).eq('id', pinId);
          }
        });
    });
  };

  // ── Report ──────────────────────────────────────────────────────────────────
  const handleReport = async (reason: string) => {
    if (!reportTarget || !session?.user?.id) return;
    await submitReport(session.user.id, reportTarget.id, reportTarget.type, reason);
    // If pin hidden after report, remove from feed
    if (reportTarget.type === 'pin') {
      setFeed((prev) => prev.filter((i) => !(i.kind === 'pin' && i.data.id === reportTarget.id && (i.data.report_count + 1) >= 5)));
    }
  };

  return (
    <div className="pb-6" style={{ backgroundColor: '#0d0d0d', minHeight: '100vh' }}>
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="font-black text-2xl" style={{ color: '#f5f5f5' }}>기웃기웃 🔍</h1>
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: '#00ff88' }}
            />
            <span className="text-xs font-semibold" style={{ color: '#00ff88' }}>실시간</span>
          </div>
        </div>
      </div>

      {/* Pioneer banner */}
      <div className="px-5 mb-4">
        <div
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{
            background: 'linear-gradient(135deg, #1a1500, #0f0e00)',
            border: '1px solid #f59e0b44',
          }}
        >
          <span className="text-xl mt-0.5">🗺️</span>
          <div className="flex-1">
            <p className="text-sm font-bold mb-1" style={{ color: '#fbbf24' }}>미개척지 발견!</p>
            <p className="text-xs leading-relaxed mb-3" style={{ color: '#d97706' }}>
              이 지역 첫 번째 개척자가 되세요!
            </p>
            <button
              className="px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: '#1a0f00' }}
            >
              개척자 도전하기
            </button>
          </div>
        </div>
      </div>

      {/* Hint */}
      <p className="px-5 text-xs mb-4" style={{ color: '#4b5563' }}>
        길게 눌러서 신고할 수 있어요
      </p>

      {/* Feed */}
      <div className="px-5 space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl p-4 animate-pulse"
              style={{ backgroundColor: '#1a1a1a', height: '120px' }}
            />
          ))
        ) : feed.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: '#4b5563' }}>아직 요청이 없어요</p>
          </div>
        ) : (
          feed.map((item) => {
            const isNew = newIds.has(item.key);
            if (item.kind === 'pin') {
              return (
                <PinCard
                  key={item.key}
                  pin={item.data}
                  isNew={isNew}
                  bouncing={bouncing === item.key}
                  heartBurst={heartBurst === item.key}
                  onPeek={() => handlePeek(item.data.id, item.key)}
                  onReport={() => setReportTarget({ id: item.data.id, type: 'pin', label: item.data.place_name })}
                />
              );
            }
            return (
              <UploadCard
                key={item.key}
                upload={item.data}
                isNew={isNew}
                onReport={() => setReportTarget({ id: item.data.id, type: 'upload', label: '업로드된 사진' })}
              />
            );
          })
        )}
      </div>

      {/* Report sheet */}
      {reportTarget && (
        <ReportSheet
          target={reportTarget}
          onClose={() => setReportTarget(null)}
          onSubmit={handleReport}
        />
      )}

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes heartPop {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          60%  { opacity: 1; transform: translateY(-22px) scale(1.3); }
          100% { opacity: 0; transform: translateY(-36px) scale(0.8); }
        }
      `}</style>
    </div>
  );
}
