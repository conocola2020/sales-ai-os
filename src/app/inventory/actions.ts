'use server'

import { createClient } from '@/lib/supabase/server'
import type { InventoryItem } from '@/types/inventory'

export async function getInventory(): Promise<InventoryItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .order('category')
    .order('name')

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function updateStock(
  id: number,
  location: 'shop' | 'workshop',
  delta: number
): Promise<void> {
  const supabase = await createClient()

  // Get current value first
  const { data: current, error: fetchError } = await supabase
    .from('inventory')
    .select('shop, workshop')
    .eq('id', id)
    .single()

  if (fetchError || !current) throw new Error(fetchError?.message ?? 'Not found')

  const currentValue = location === 'shop' ? current.shop : current.workshop
  const newValue = Math.max(0, (currentValue as number) + delta)

  const { error } = await supabase
    .from('inventory')
    .update({ [location]: newValue, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function addItem(
  item: Omit<InventoryItem, 'id' | 'updated_at'>
): Promise<InventoryItem> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory')
    .insert(item)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateItem(
  id: number,
  item: Partial<Omit<InventoryItem, 'id' | 'updated_at'>>
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('inventory')
    .update({ ...item, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function deleteItem(id: number): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('inventory')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}
