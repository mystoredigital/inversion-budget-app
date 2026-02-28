import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Expense = {
  id: string;
  user_id: string;
  expense: string;
  categoria: string;
  status: 'Pendiente' | 'Pagado';
  fecha: string | null;
  valor: number;
  moneda: 'COP' | 'USD';
  cuenta: string | null;
  nombre: string | null;
  phone: string | null;
  link: string | null;
  comment: string | null;
  tipo_presupuesto: 'Personal' | 'Suscripciones' | 'Negocios';
  frecuencia: 'Unico' | 'Mensual' | 'Bimestral' | 'Trimestral' | 'Semestral' | 'Anual';
  created_at: string;
  updated_at: string;
  vence_en?: string; // From view
};

export type ExpenseFile = {
  id: string;
  expense_id: string;
  user_id: string;
  bucket: string;
  path: string;
  filename: string | null;
  mime_type: string | null;
  size: number | null;
  created_at: string;
};
