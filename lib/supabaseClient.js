import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://beqdsovyyhqbwwsvqebv.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable__zdrrfM2NwYF96oX_8zlug_aI_KKdW0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);