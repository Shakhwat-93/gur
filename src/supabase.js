import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://moefihwqvhdzvqjqmoja.supabase.co'
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vZWZpaHdxdmhkenZxanFtb2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NjM1MzMsImV4cCI6MjEwODQzOTUzM30.ec6Ej5ioMRxyAe2vuCZtPyC5oulZkJE-41TyLLbzVPY'

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

/**
 * Submits a new customer order to Supabase
 * @param {Object} orderData
 */
export async function submitOrder(orderData) {
  if (!supabase) {
    console.warn('[Supabase] Supabase client is not initialized.')
    return { success: true, localOnly: true }
  }

  try {
    const { error } = await supabase
      .from('orders')
      .insert([orderData])

    if (error) {
      console.error('[Supabase] Insert error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('[Supabase] Exception:', err)
    return { success: false, error: err.message }
  }
}
