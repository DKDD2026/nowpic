import { Session } from '@supabase/supabase-js';

interface Props {
  session: Session | null;
  balance: number;
}

function getNickname(session: Session | null): string {
  return (
    session?.user?.user_metadata?.name ??
    session?.user?.user_metadata?.full_name ??
    session?.user?.user_metadata?.preferred_username ??
    session?.user?.email?.split('@')[0] ??
    '게스트'
  );
}

const timeMachineCards = [
  { place: '강남역 2번출구', when: '어제 18:00' },
  { place: '홍대 놀이터', when: '3일전' },
  { place: '마곡 던킨', when: '1주일전' },
];

const recentRequests = [
  { place: '강남역 2번 출구', time: '5분 전', status: '응답 완료' },
  { place: '홍대 놀이터', time: '12분 전', status: '진행 중' },
  { place: '이태원 세계음식거리', time: '28분 전', status: '응답 완료' },
];

export default function HomeTab({ session, balance }: Props) {
  const nickname = getNickname(session);

  return (
    <div className="px-5 pt-14 pb-6" style={{ backgroundColor: '#f9f7f2', minHeight: '100vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs mb-0.5" style={{ color: '#9ca3af' }}>안녕하세요</p>
          <h1 className="font-black text-2xl tracking-tight" style={{ color: '#0d0d0d' }}>{nickname}님</h1>
        </div>
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ backgroundColor: '#fef9ec', border: '1px solid #f59e0b66' }}
        >
          <span className="text-sm">💰</span>
          <span className="text-sm font-bold" style={{ color: '#f59e0b' }}>{balance} 코인</span>
        </div>
      </div>

      {/* Mission card */}
      <div
        className="rounded-3xl p-5 mb-5"
        style={{
          background: 'linear-gradient(135deg, #fff1f2, #ffe4e6)',
          border: '1px solid #fecdd3',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs">🔴</span>
          <span className="text-xs font-semibold" style={{ color: '#f43f5e' }}>지금 요청 가능</span>
        </div>
        <p className="font-bold text-base leading-snug mb-4" style={{ color: '#0d0d0d' }}>
          지금 그 장소,<br />직접 볼 수 없다면?
        </p>
        <button
          className="px-5 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-transform"
          style={{
            background: 'linear-gradient(135deg, #f43f5e, #fb7185)',
            color: 'white',
            boxShadow: '0 4px 16px rgba(244,63,94,0.3)',
          }}
        >
          사진 요청하기
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: '오늘 요청', value: '24' },
          { label: '응답률', value: '91%' },
          { label: '평균응답', value: '3분' },
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

      {/* AI 타임머신 */}
      <div className="mb-6">
        <h3 className="font-bold text-base mb-3" style={{ color: '#0d0d0d' }}>⏳ AI 타임머신</h3>
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {timeMachineCards.map(({ place, when }) => (
            <div
              key={place}
              className="flex-shrink-0 rounded-2xl p-4 w-44"
              style={{ backgroundColor: '#ffffff', border: '1px solid #ede8e0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
            >
              <p className="text-sm font-semibold leading-tight mb-1" style={{ color: '#0d0d0d' }}>{place}</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>{when}</p>
              <div
                className="mt-3 text-xs font-semibold px-2 py-1 rounded-lg inline-block"
                style={{ backgroundColor: '#eef2ff', color: '#6366f1' }}
              >
                AI 복원 보기
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent requests */}
      <h3 className="font-bold text-base mb-3" style={{ color: '#0d0d0d' }}>최근 요청</h3>
      <div className="space-y-3">
        {recentRequests.map(({ place, time, status }) => (
          <div
            key={place}
            className="flex items-center justify-between px-4 py-3 rounded-2xl"
            style={{ backgroundColor: '#ffffff', border: '1px solid #ede8e0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: '#0d0d0d' }}>{place}</p>
              <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{time}</p>
            </div>
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{
                backgroundColor: status === '응답 완료' ? '#f0fdf4' : '#fff1f2',
                color: status === '응답 완료' ? '#16a34a' : '#f43f5e',
                border: `1px solid ${status === '응답 완료' ? '#bbf7d0' : '#fecdd3'}`,
              }}
            >
              {status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
