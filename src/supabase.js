import { supabase } from './lib/supabase.js'

export { supabase }

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
