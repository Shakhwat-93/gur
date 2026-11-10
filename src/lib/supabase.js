import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://moefihwqvhdzvqjqmoja.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vZWZpaHdxdmhkenZxanFtb2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NjM1MzMsImV4cCI6MjEwODQzOTUzM30.ec6Ej5ioMRxyAe2vuCZtPyC5oulZkJE-41TyLLbzVPY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

export default supabase;
