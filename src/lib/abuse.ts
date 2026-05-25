import { supabase } from './supabase';

// ─── Haversine distance (metres) ─────────────────────────────────────────────

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

// ─── Upsert user row (idempotent) ────────────────────────────────────────────

export async function upsertUser(userId: string, email: string, nickname: string, profileImg: string): Promise<void> {
  await supabase.from('users').upsert({
    id: userId,
    email,
    nickname,
    profile_img: profileImg,
  }, { onConflict: 'id', ignoreDuplicates: true });
}

// ─── Check if user is flagged ────────────────────────────────────────────────

export async function isUserFlagged(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('flagged')
    .eq('id', userId)
    .maybeSingle();
  return data?.flagged === true;
}

// ─── Flag user with reason (idempotent per reason) ────────────────────────────

async function flagUser(userId: string, reason: string): Promise<void> {
  // Append reason to flag_reasons array and set flagged=true
  await supabase.rpc('append_flag_reason', { uid: userId, new_reason: reason }).catch(() => {
    // Fallback if RPC not available: direct update
    supabase.from('users')
      .update({ flagged: true })
      .eq('id', userId);
  });
  await supabase
    .from('users')
    .update({ flagged: true })
    .eq('id', userId);
}

// ─── Run abuse checks after a new upload ─────────────────────────────────────

export async function runAbuseChecks(
  userId: string,
  newLat: number,
  newLng: number,
  capturedAt: string
): Promise<string[]> {
  const triggered: string[] = [];

  // Fetch this user's uploads in the last 24h
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentUploads } = await supabase
    .from('uploads')
    .select('gps_lat, gps_lng, captured_at')
    .eq('user_id', userId)
    .gte('captured_at', since24h)
    .order('captured_at', { ascending: false });

  const uploads = recentUploads ?? [];

  // ── 1. Same-location spam: 3+ uploads within 24h within 10m ────────────────
  const nearbyCount = uploads.filter(
    (u) => u.gps_lat != null && haversineM(newLat, newLng, u.gps_lat, u.gps_lng) <= 10
  ).length;
  if (nearbyCount >= 3) {
    triggered.push('same_location_spam');
    await flagUser(userId, 'same_location_spam');
  }

  // ── 2. Too-fast movement: >1km apart within 10 minutes ─────────────────────
  const tenMinMs = 10 * 60 * 1000;
  const newTime = new Date(capturedAt).getTime();
  const tooFast = uploads.some((u) => {
    if (u.gps_lat == null) return false;
    const timeDiff = Math.abs(newTime - new Date(u.captured_at).getTime());
    if (timeDiff > tenMinMs) return false;
    const dist = haversineM(newLat, newLng, u.gps_lat, u.gps_lng);
    return dist > 1000;
  });
  if (tooFast) {
    triggered.push('too_fast_move');
    await flagUser(userId, 'too_fast_move');
  }

  // ── 3. Report target: 3+ reports received in 7 days ──────────────────────
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('target_id', userId)
    .gte('created_at', since7d);
  if ((count ?? 0) >= 3) {
    triggered.push('report_target');
    await flagUser(userId, 'report_target');
  }

  return triggered;
}

// ─── Submit a report ──────────────────────────────────────────────────────────

export async function submitReport(
  reporterId: string,
  targetId: string,
  targetType: 'pin' | 'upload',
  reason: string
): Promise<void> {
  await supabase.from('reports').insert({
    reporter_id: reporterId,
    target_id: targetId,
    target_type: targetType,
    reason,
  });

  // Increment report_count on the target
  if (targetType === 'pin') {
    const { data: pin } = await supabase
      .from('pins')
      .select('report_count')
      .eq('id', targetId)
      .maybeSingle();
    if (pin) {
      const newCount = (pin.report_count ?? 0) + 1;
      await supabase
        .from('pins')
        .update({ report_count: newCount, hidden: newCount >= 5 })
        .eq('id', targetId);
    }
  } else {
    const { data: upload } = await supabase
      .from('uploads')
      .select('report_count, user_id')
      .eq('id', targetId)
      .maybeSingle();
    if (upload) {
      const newCount = (upload.report_count ?? 0) + 1;
      await supabase
        .from('uploads')
        .update({ report_count: newCount })
        .eq('id', targetId);

      // Flag upload owner if 3+ reports in 7 days
      if (upload.user_id) {
        const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from('reports')
          .select('id', { count: 'exact', head: true })
          .eq('target_id', upload.user_id)
          .gte('created_at', since7d);
        if ((count ?? 0) >= 3) {
          await flagUser(upload.user_id, 'report_target');
        }
      }
    }
  }
}
