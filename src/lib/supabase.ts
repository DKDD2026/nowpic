import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ncvfxrqukmaxvwynjpzq.supabase.co';
const supabaseKey = 'sb_publishable_33xlxfDKg_hbNZhJ5SlIMA_N1fl0COa';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    flowType: 'pkce',
  },
});