import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoinTxn {
  id: string;
  user_id: string;
  type: 'earn' | 'spend' | 'refund';
  amount: number;
  reason: string;
  status: 'paid' | 'pending' | 'expired';
  created_at: string;
  expires_at: string;
}

// ─── Korea date string (YYYY-MM-DD) ──────────────────────────────────────────

export function koreaDateStr(date = new Date()): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

// ─── Compute balance from txn list ───────────────────────────────────────────

export function computeBalance(txns: CoinTxn[]): number {
  return txns.reduce((sum, t) => {
    if (t.status !== 'paid') return sum;
    if (t.type === 'earn' || t.type === 'refund') return sum + t.amount;
    if (t.type === 'spend') return sum - t.amount;
    return sum;
  }, 0);
}

// ─── Today's earned coins (Korea time) ───────────────────────────────────────

export function todayEarned(txns: CoinTxn[]): number {
  const today = koreaDateStr();
  return txns.reduce((sum, t) => {
    if (t.type !== 'earn') return sum;
    if (t.status !== 'paid') return sum;
    const txnDate = new Date(t.created_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    return txnDate === today ? sum + t.amount : sum;
  }, 0);
}

// ─── Load all txns for a user ─────────────────────────────────────────────────

export async function loadTxns(userId: string): Promise<CoinTxn[]> {
  const { data } = await supabase
    .from('coin_txns')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []) as CoinTxn[];
}

// ─── Expire stale coins ───────────────────────────────────────────────────────

export async function expireStaleCoins(userId: string): Promise<void> {
  await supabase
    .from('coin_txns')
    .update({ status: 'expired' })
    .eq('user_id', userId)
    .eq('status', 'paid')
    .eq('type', 'earn')
    .lt('expires_at', new Date().toISOString());
}

// ─── Welcome bonus (idempotent) ───────────────────────────────────────────────

export async function giveWelcomeBonus(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('coin_txns')
    .select('id')
    .eq('user_id', userId)
    .eq('reason', '가입 환영 보너스')
    .maybeSingle();
  if (data) return false;
  await supabase.from('coin_txns').insert({
    user_id: userId,
    type: 'earn',
    amount: 100,
    reason: '가입 환영 보너스',
    status: 'paid',
  });
  return true;
}

// ─── Daily check-in ───────────────────────────────────────────────────────────

interface CheckInResult {
  given: boolean;
  amount: number;
  consecutiveDays: number;
}

export async function doDailyCheckIn(userId: string): Promise<CheckInResult> {
  const today = koreaDateStr();
  const yesterday = koreaDateStr(new Date(Date.now() - 86400000));

  // Check if already checked in today
  const { data: todayRow } = await supabase
    .from('coin_txns')
    .select('id')
    .eq('user_id', userId)
    .eq('reason', '일일 출석 체크')
    .gte('created_at', `${today}T00:00:00+09:00`)
    .lt('created_at', `${today}T23:59:59+09:00`)
    .maybeSingle();

  if (todayRow) return { given: false, amount: 0, consecutiveDays: 0 };

  // Count consecutive days
  const { data: recentCheckins } = await supabase
    .from('coin_txns')
    .select('created_at')
    .eq('user_id', userId)
    .eq('reason', '일일 출석 체크')
    .order('created_at', { ascending: false })
    .limit(6);

  let consecutive = 1;
  if (recentCheckins && recentCheckins.length > 0) {
    const lastDate = new Date(recentCheckins[0].created_at)
      .toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    if (lastDate === yesterday) {
      consecutive = recentCheckins.length + 1;
      // Walk back to verify true streak
      let checkDate = yesterday;
      for (const row of recentCheckins) {
        const d = new Date(row.created_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
        if (d !== checkDate) { break; }
        checkDate = koreaDateStr(new Date(new Date(row.created_at).getTime() - 86400000));
      }
    } else {
      consecutive = 1;
    }
  }

  // Day 7 bonus
  const base = 5;
  const bonus = consecutive % 7 === 0 ? 20 : 0;
  const total = base + bonus;

  await supabase.from('coin_txns').insert({
    user_id: userId,
    type: 'earn',
    amount: total,
    reason: '일일 출석 체크',
    status: 'paid',
  });

  return { given: true, amount: total, consecutiveDays: consecutive };
}

// ─── Add earn txn with daily cap ─────────────────────────────────────────────

export async function earnCoins(
  userId: string,
  amount: number,
  reason: string,
  currentTxns: CoinTxn[]
): Promise<'paid' | 'pending'> {
  const earned = todayEarned(currentTxns);
  const status: 'paid' | 'pending' = earned + amount > 200 ? 'pending' : 'paid';
  await supabase.from('coin_txns').insert({
    user_id: userId,
    type: 'earn',
    amount,
    reason,
    status,
  });
  return status;
}

// ─── Spend coins ─────────────────────────────────────────────────────────────

export async function spendCoins(
  userId: string,
  amount: number,
  reason: string
): Promise<void> {
  await supabase.from('coin_txns').insert({
    user_id: userId,
    type: 'spend',
    amount,
    reason,
    status: 'paid',
  });
}

// ─── Coins expiring within 7 days ────────────────────────────────────────────

export function coinsExpiringSoon(txns: CoinTxn[]): number {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return txns
    .filter(
      (t) =>
        t.type === 'earn' &&
        t.status === 'paid' &&
        new Date(t.expires_at).getTime() - now <= sevenDaysMs &&
        new Date(t.expires_at).getTime() > now
    )
    .reduce((s, t) => s + t.amount, 0);
}
