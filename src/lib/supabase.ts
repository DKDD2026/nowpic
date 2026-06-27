import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ncvfxrqukmaxvwynjpzq.supabase.co';
const supabaseKey = 'ARCHIVED_BOLT_APP_DO_NOT_USE';
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    flowType: 'pkce',
  },
});
