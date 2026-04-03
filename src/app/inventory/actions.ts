'use server'

import { createClient } from '@/lib/supabase/server'
import type { InventoryItem } from '@/types/inventory'

export async function getInventory(): Promise<InventoryItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .order('sort_order', { ascending: true })
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

export async function updateSortOrder(
  items: { id: number; sort_order: number }[]
): Promise<void> {
  const supabase = await createClient()
  for (const item of items) {
    const { error } = await supabase
      .from('inventory')
      .update({ sort_order: item.sort_order })
      .eq('id', item.id)
    if (error) throw new Error(error.message)
  }
}

export async function addItem(
  item: Omit<InventoryItem, 'id' | 'updated_at' | 'sort_order'>
): Promise<InventoryItem> {
  const supabase = await createClient()

  // Get max sort_order to place new item at the end
  const { data: maxRow } = await supabase
    .from('inventory')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = (maxRow?.sort_order ?? 0) + 1

  const { data, error } = await supabase
    .from('inventory')
    .insert({ ...item, sort_order: nextOrder })
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
