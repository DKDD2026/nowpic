import { useRef, useState, useCallback, useEffect } from 'react';
import { X, MapPin, Camera, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isUserFlagged, runAbuseChecks, upsertUser } from '../lib/abuse';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pin {
  id: string;
  place_name: string;
  lat: number;
  lng: number;
  reward_coin: number;
}

interface Props {
  pin: Pin;
  session: Session;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'gps' | 'camera' | 'uploading' | 'success' | 'error';

// ─── Geo helpers ──────────────────────────────────────────────────────────────

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function kstTimestamp(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace('T', ' ').slice(0, 16).replace(' ', ' ').replace('-', '-').replace('-', '-') + ' KST';
}

// ─── Timestamp overlay ───────────────────────────────────────────────────────

async function addTimestampOverlay(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const label = `${kstTimestamp()} · NOWPIC`;
      const fontSize = Math.max(20, Math.round(canvas.width * 0.028));
      ctx.font = `bold ${fontSize}px monospace`;

      const padding = Math.round(fontSize * 0.6);
      const metrics = ctx.measureText(label);
      const boxW = metrics.width + padding * 2;
      const boxH = fontSize + padding * 1.2;
      const x = canvas.width - boxW - padding;
      const y = canvas.height - boxH - padding;

      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.roundRect(x, y, boxW, boxH, 6);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x + padding, y + fontSize * 0.85 + padding * 0.4);

      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.92);
    };
    img.src = url;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhotoUploadFlow({ pin, session, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('gps');
  const [errorMsg, setErrorMsg] = useState('');
  const [userGps, setUserGps] = useState<GeolocationCoordinates | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [flagged, setFlagged] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Step 1: GPS check ──────────────────────────────────────────────────────
  const checkGps = useCallback(() => {
    if (!navigator.geolocation) {
      setErrorMsg('이 기기에서 위치 정보를 사용할 수 없습니다.');
      setStep('error');
      return;
    }
    setStep('gps');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (accuracy > 100) {
          setErrorMsg('정확한 위치에서 촬영해주세요 📍');
          setStep('error');
          return;
        }
        const dist = haversineMeters(latitude, longitude, pin.lat, pin.lng);
        if (dist > 200) {
          setErrorMsg(
            `현장에서만 촬영 가능합니다. 핀 위치 200m 이내로 이동해주세요\n(현재 거리: ${Math.round(dist)}m)`
          );
          setStep('error');
          return;
        }
        setUserGps(pos.coords);
        setStep('camera');
        // Trigger camera immediately
        fileInputRef.current?.click();
      },
      (err) => {
        const msgs: Record<number, string> = {
          1: '위치 권한이 필요합니다. 브라우저 설정에서 허용해주세요.',
          2: '위치를 가져올 수 없습니다. 다시 시도해주세요.',
          3: '위치 요청 시간이 초과됐습니다. 다시 시도해주세요.',
        };
        setErrorMsg(msgs[err.code] ?? '위치 오류가 발생했습니다.');
        setStep('error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [pin.lat, pin.lng]);

  // Auto-start GPS check when component mounts
  useEffect(() => { checkGps(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 2: File chosen ────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setPendingFile(file);
    // Reset input so user can re-capture
    e.target.value = '';
  };

  // ── Step 3 + 4: Upload ─────────────────────────────────────────────────────
  const upload = async () => {
    if (!pendingFile || !userGps) return;
    setStep('uploading');

    try {
      const uid = session.user.id;
      const capturedAt = new Date().toISOString();

      // 0. Ensure user row exists
      await upsertUser(
        uid,
        session.user.email ?? '',
        session.user.user_metadata?.name ?? session.user.user_metadata?.full_name ?? '',
        session.user.user_metadata?.avatar_url ?? ''
      );

      // 1. Add timestamp watermark
      const watermarked = await addTimestampOverlay(pendingFile);

      // 2. Upload to storage
      const path = `${uid}/${pin.id}/${Date.now()}.jpg`;
      const { error: storageErr } = await supabase.storage
        .from('pin-photos')
        .upload(path, watermarked, { contentType: 'image/jpeg', upsert: false });
      if (storageErr) throw new Error(storageErr.message);

      const { data: urlData } = supabase.storage.from('pin-photos').getPublicUrl(path);
      const photoUrl = urlData.publicUrl;

      // 3. Insert upload record
      await supabase.from('uploads').insert({
        pin_id: pin.id,
        user_id: uid,
        photo_url: photoUrl,
        gps_lat: userGps.latitude,
        gps_lng: userGps.longitude,
        gps_accuracy: userGps.accuracy,
        captured_at: capturedAt,
        device_os: navigator.userAgent.slice(0, 200),
      });

      // 4. Mark pin completed
      await supabase.from('pins').update({ status: 'completed' }).eq('id', pin.id);

      // 5. Abuse checks (non-blocking)
      const abuseFlags = await runAbuseChecks(uid, userGps.latitude, userGps.longitude, capturedAt);
      const nowFlagged = abuseFlags.length > 0 || await isUserFlagged(uid);

      // 6. Coin reward — hold as pending if user is flagged
      const coinStatus = nowFlagged ? 'pending' : 'paid';
      await supabase.from('coin_txns').insert({
        user_id: uid,
        type: 'earn',
        amount: pin.reward_coin,
        reason: '사진 미션 완료',
        status: coinStatus,
      });

      setFlagged(nowFlagged);
      setStep('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '업로드 중 오류가 발생했습니다.');
      setStep('error');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
    >
      {/* Hidden camera input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <div
        className="w-full rounded-t-3xl p-6"
        style={{ backgroundColor: '#ffffff', border: '1px solid #ede8e0', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Handle + header */}
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ backgroundColor: '#e5e7eb' }} />

        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-base" style={{ color: '#0d0d0d' }}>
            📸 사진 인증하기
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full"
            style={{ backgroundColor: '#f3f4f6' }}
          >
            <X size={16} color="#6b7280" />
          </button>
        </div>

        {/* Pin info */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-5"
          style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}
        >
          <MapPin size={14} color="#f43f5e" />
          <span className="text-sm font-semibold" style={{ color: '#0d0d0d' }}>{pin.place_name}</span>
          <span className="ml-auto text-xs font-bold" style={{ color: '#f59e0b' }}>+{pin.reward_coin}코인</span>
        </div>

        {/* ── GPS checking ── */}
        {step === 'gps' && (
          <div className="text-center py-6">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#f0fdf4', border: '2px solid #bbf7d0' }}
            >
              <MapPin size={28} color="#16a34a" />
            </div>
            <p className="font-bold text-base mb-2" style={{ color: '#0d0d0d' }}>위치 확인 중...</p>
            <p className="text-xs mb-6" style={{ color: '#9ca3af' }}>핀 위치 200m 이내에서만 촬영 가능합니다</p>
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: '#bbf7d0', borderTopColor: '#16a34a' }} />
              <span className="text-sm" style={{ color: '#6b7280' }}>GPS 신호 수신 중...</span>
            </div>
          </div>
        )}

        {/* ── Camera ready ── */}
        {step === 'camera' && !preview && (
          <div className="text-center py-6">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#fff1f2', border: '2px solid #fecdd3' }}
            >
              <Camera size={28} color="#f43f5e" />
            </div>
            <p className="font-bold text-base mb-2" style={{ color: '#0d0d0d' }}>카메라를 열어주세요</p>
            <p className="text-xs mb-6" style={{ color: '#9ca3af' }}>현장 사진을 직접 촬영해주세요</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-transform"
              style={{
                background: 'linear-gradient(135deg, #f43f5e, #fb7185)',
                color: 'white',
                boxShadow: '0 4px 16px rgba(244,63,94,0.3)',
              }}
            >
              카메라 열기 📷
            </button>
          </div>
        )}

        {/* ── Preview + confirm ── */}
        {step === 'camera' && preview && (
          <div>
            <div className="relative rounded-2xl overflow-hidden mb-4" style={{ border: '2px solid #e5e7eb' }}>
              <img src={preview} alt="preview" className="w-full object-cover" style={{ maxHeight: '300px' }} />
              <div
                className="absolute bottom-2 right-2 px-2 py-1 rounded text-xs font-bold"
                style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: '#ffffff', fontFamily: 'monospace' }}
              >
                {kstTimestamp()} · NOWPIC
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setPreview(null); setPendingFile(null); fileInputRef.current?.click(); }}
                className="flex-1 py-3 rounded-2xl font-bold text-sm active:scale-95 transition-transform"
                style={{ backgroundColor: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' }}
              >
                다시 찍기
              </button>
              <button
                onClick={upload}
                className="flex-1 py-3 rounded-2xl font-bold text-sm active:scale-95 transition-transform"
                style={{
                  background: 'linear-gradient(135deg, #f43f5e, #fb7185)',
                  color: 'white',
                  boxShadow: '0 4px 16px rgba(244,63,94,0.3)',
                }}
              >
                업로드 ✓
              </button>
            </div>
          </div>
        )}

        {/* ── Uploading ── */}
        {step === 'uploading' && (
          <div className="text-center py-8">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#fefce8', border: '2px solid #fde68a' }}
            >
              <Loader size={28} color="#f59e0b" className="animate-spin" />
            </div>
            <p className="font-bold text-base mb-1" style={{ color: '#0d0d0d' }}>업로드 중...</p>
            <p className="text-xs" style={{ color: '#9ca3af' }}>잠시만 기다려주세요</p>
          </div>
        )}

        {/* ── Success ── */}
        {step === 'success' && (
          <div className="text-center py-6">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#f0fdf4', border: '2px solid #bbf7d0' }}
            >
              <CheckCircle size={28} color="#16a34a" />
            </div>
            <p className="font-bold text-lg mb-1" style={{ color: '#0d0d0d' }}>
              📸 사진 인증 완료!
            </p>
            {flagged ? (
              <>
                <p className="text-sm mb-4" style={{ color: '#f59e0b' }}>코인 지급 보류 중</p>
                <div
                  className="rounded-2xl px-4 py-3 mb-5 text-xs leading-relaxed"
                  style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}
                >
                  계정 검토 중입니다. 코인 지급이 보류됩니다.
                </div>
              </>
            ) : (
              <>
                <p className="text-sm mb-4" style={{ color: '#16a34a' }}>
                  +{pin.reward_coin}코인 지급 예정
                </p>
                <div
                  className="rounded-2xl px-4 py-3 mb-5 text-xs"
                  style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a' }}
                >
                  코인은 정식 출시 후 사용 가능합니다 🎉
                </div>
              </>
            )}
            <button
              onClick={() => { onSuccess(); onClose(); }}
              className="w-full py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-transform"
              style={{
                background: 'linear-gradient(135deg, #f43f5e, #fb7185)',
                color: 'white',
                boxShadow: '0 4px 16px rgba(244,63,94,0.3)',
              }}
            >
              확인
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {step === 'error' && (
          <div className="text-center py-6">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#fff1f2', border: '2px solid #fecdd3' }}
            >
              <AlertCircle size={28} color="#f43f5e" />
            </div>
            <p className="font-bold text-base mb-2" style={{ color: '#0d0d0d' }}>오류가 발생했습니다</p>
            <p
              className="text-sm mb-6 whitespace-pre-line leading-relaxed"
              style={{ color: '#6b7280' }}
            >
              {errorMsg}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl font-bold text-sm"
                style={{ backgroundColor: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' }}
              >
                닫기
              </button>
              <button
                onClick={() => { setErrorMsg(''); setStep('gps'); checkGps(); }}
                className="flex-1 py-3 rounded-2xl font-bold text-sm active:scale-95 transition-transform"
                style={{
                  background: 'linear-gradient(135deg, #f43f5e, #fb7185)',
                  color: 'white',
                }}
              >
                다시 시도
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
