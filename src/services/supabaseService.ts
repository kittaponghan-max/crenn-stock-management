import { supabase } from '../lib/supabase';
import { Ingredient, ReceivingRecord, LogEntry } from '../types';

export const supabaseService = {
  async getIngredients() {
    const { data, error } = await supabase.from('ingredients').select('*');
    if (error) throw error;
    return data as Ingredient[];
  },

  async saveIngredient(ingredient: Ingredient) {
    const { error } = await supabase.from('ingredients').upsert(ingredient);
    if (error) throw error;
  },

  async deleteIngredient(id: string) {
    const { error } = await supabase.from('ingredients').delete().eq('id', id);
    if (error) throw error;
  },

  async getStockRecords() {
    const { data, error } = await supabase.from('stock_records').select('*');
    if (error) throw error;
    const result: any = {};
    data.forEach(entry => {
      if (!result[entry.record_date]) result[entry.record_date] = {};
      result[entry.record_date][entry.ingredient_id] = {
        in: entry.stock_in,
        out: entry.stock_out,
        remaining: entry.remaining
      };
    });
    return result;
  },

  async updateStockEntry(date: string, ingredientId: string, entry: { in?: number; out?: number; remaining?: number }, branch?: string) {
    const { error } = await supabase.from('stock_records').upsert({
      branch: branch || 'Rayong',
      record_date: date,
      ingredient_id: ingredientId,
      stock_in: entry.in,
      stock_out: entry.out,
      remaining: entry.remaining
    }, { onConflict: 'record_date,ingredient_id,branch' });
    if (error) throw error;
  },

  async getReceivingRecords() {
    const { data, error } = await supabase.from('receiving_records').select('*');
    if (error) throw error;
    return data as ReceivingRecord[];
  },

  async saveReceivingRecord(record: ReceivingRecord) {
    const { error } = await supabase.from('receiving_records').upsert(record);
    if (error) throw error;
  },

  async deleteReceivingRecord(id: string) {
    const { error } = await supabase.from('receiving_records').delete().eq('id', id);
    if (error) throw error;
  },

  async getLogs() {
    const { data, error } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(120);
    if (error) throw error;
    return data as LogEntry[];
  },

  async saveLog(log: LogEntry) {
    const { error } = await supabase.from('audit_logs').insert(log);
    if (error) throw error;
  },

  async getChecklistRecords() {
    const { data, error } = await supabase.from('checklist_records').select('*').order('timestamp', { ascending: false });
    if (error) throw error;
    return data;
  },

  async saveChecklistRecord(record: any) {
    const { error } = await supabase.from('checklist_records').insert(record);
    if (error) throw error;
  }
};
