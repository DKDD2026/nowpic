import { supabase } from './supabase';
import { koreaDateStr } from './coins';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Coupon {
  id: string;
  user_id: string;
  coupon_type: string;
  qr_code: string;
  status: 'active' | 'used' | 'expired';
  issued_at: string;
  expires_at: string | null;
  redeemed_at: string | null;
  store_name: string;
}

// ─── Korea midnight (today 22:00 KST used as end-of-day) ─────────────────────

function todayExpiresAt(): string {
  const today = koreaDateStr();
  // 22:00 KST = 13:00 UTC
  return `${today}T13:00:00.000Z`;
}

// ─── Issue a coupon (1 per day per user) ─────────────────────────────────────

export type IssueResult =
  | { ok: true; coupon: Coupon }
  | { ok: false; reason: 'already_used_today' | 'error' };

export async function issueDunkinCoupon(userId: string): Promise<IssueResult> {
  const today = koreaDateStr();

  // Check if already issued today
  const { data: existing } = await supabase
    .from('coupons')
    .select('*')
    .eq('user_id', userId)
    .eq('coupon_type', 'dunkin_1plus1')
    .gte('issued_at', `${today}T00:00:00+09:00`)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'used') return { ok: false, reason: 'already_used_today' };
    // Already issued but not used — return existing
    return { ok: true, coupon: existing as Coupon };
  }

  const { data, error } = await supabase
    .from('coupons')
    .insert({
      user_id: userId,
      coupon_type: 'dunkin_1plus1',
      status: 'active',
      expires_at: todayExpiresAt(),
      store_name: '던킨도너츠',
    })
    .select()
    .single();

  if (error || !data) return { ok: false, reason: 'error' };
  return { ok: true, coupon: data as Coupon };
}

// ─── Redeem coupon ────────────────────────────────────────────────────────────

export async function redeemCoupon(couponId: string): Promise<void> {
  await supabase
    .from('coupons')
    .update({ status: 'used', redeemed_at: new Date().toISOString() })
    .eq('id', couponId);
}

// ─── Load user coupons ────────────────────────────────────────────────────────

export async function loadCoupons(userId: string): Promise<Coupon[]> {
  const { data } = await supabase
    .from('coupons')
    .select('*')
    .eq('user_id', userId)
    .order('issued_at', { ascending: false });
  return (data ?? []) as Coupon[];
}

// ─── Auto-refund expired pins ─────────────────────────────────────────────────

export interface RefundResult {
  pinId: string;
  userId: string;
  amount: number;
}

export async function runAutoRefund(): Promise<RefundResult[]> {
  // Find open pins that have expired
  const { data: expiredPins } = await supabase
    .from('pins')
    .select('id, user_id, reward_coin')
    .eq('status', 'open')
    .not('expires_at', 'is', null)
    .lt('expires_at', new Date().toISOString());

  if (!expiredPins || expiredPins.length === 0) return [];

  const results: RefundResult[] = [];

  for (const pin of expiredPins) {
    if (!pin.user_id) continue;

    // Insert refund coin txn
    await supabase.from('coin_txns').insert({
      user_id: pin.user_id,
      type: 'refund',
      amount: 20,
      reason: '30분 미응답 자동 환불',
      status: 'paid',
    });

    // Mark pin as expired
    await supabase.from('pins').update({ status: 'expired' }).eq('id', pin.id);

    results.push({ pinId: pin.id, userId: pin.user_id, amount: 20 });
  }

  return results;
}
