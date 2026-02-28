-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create expenses table
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expense text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('Home','Food','Entertainment','Salud','Servicios','Creditos','Tarjeta de Credito','Colegio','Business','Car')),
  status text NOT NULL CHECK (status IN ('Pendiente','Pagado')),
  fecha date,
  valor numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  cuenta text,
  nombre text,
  phone text,
  link text,
  comment text,
  tipo_presupuesto text NOT NULL DEFAULT 'Personal' CHECK (tipo_presupuesto IN ('Personal', 'Suscripciones', 'Negocios')),
  frecuencia text NOT NULL DEFAULT 'Unico' CHECK (frecuencia IN ('Unico', 'Mensual', 'Bimestral', 'Trimestral', 'Semestral', 'Anual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create expense_files table
CREATE TABLE expense_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket text NOT NULL DEFAULT 'comprobantes',
  path text NOT NULL,
  filename text,
  mime_type text,
  size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Create View for calculated field "vence_en"
CREATE OR REPLACE VIEW expenses_view AS
SELECT 
  *,
  CASE 
    WHEN status = 'Pagado' THEN 'Pagado'
    WHEN fecha IS NULL THEN 'Sin fecha'
    WHEN status = 'Pendiente' THEN
      CASE 
        WHEN (fecha - current_date) < 0 THEN 'Vencido hace ' || abs(fecha - current_date) || ' días'
        WHEN (fecha - current_date) = 0 THEN 'Vence hoy'
        ELSE 'Vence en ' || (fecha - current_date) || ' días'
      END
  END as vence_en
FROM expenses;

-- 5. Row Level Security (RLS)
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own expenses" 
ON expenses FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own expense files" 
ON expense_files FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 6. Storage Policies (Run these after creating the 'comprobantes' bucket in Supabase UI)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('comprobantes', 'comprobantes', false);
-- CREATE POLICY "Users can upload their own comprobantes" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'comprobantes' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users can view their own comprobantes" ON storage.objects FOR SELECT USING (bucket_id = 'comprobantes' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users can delete their own comprobantes" ON storage.objects FOR DELETE USING (bucket_id = 'comprobantes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 7. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 8. Trigger to auto-create next recurring payment
CREATE OR REPLACE FUNCTION create_next_recurring_expense()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changed to 'Pagado' and it has a recurring frequency
  IF NEW.status = 'Pagado' AND OLD.status = 'Pendiente' AND NEW.frecuencia != 'Unico' AND NEW.fecha IS NOT NULL THEN
    INSERT INTO expenses (
      user_id, expense, categoria, status, fecha, valor, cuenta, nombre, phone, link, comment, tipo_presupuesto, frecuencia
    ) VALUES (
      NEW.user_id,
      NEW.expense,
      NEW.categoria,
      'Pendiente',
      CASE
        WHEN NEW.frecuencia = 'Mensual' THEN NEW.fecha + INTERVAL '1 month'
        WHEN NEW.frecuencia = 'Bimestral' THEN NEW.fecha + INTERVAL '2 months'
        WHEN NEW.frecuencia = 'Trimestral' THEN NEW.fecha + INTERVAL '3 months'
        WHEN NEW.frecuencia = 'Semestral' THEN NEW.fecha + INTERVAL '6 months'
        WHEN NEW.frecuencia = 'Anual' THEN NEW.fecha + INTERVAL '1 year'
        ELSE NEW.fecha
      END,
      NEW.valor,
      NEW.cuenta,
      NEW.nombre,
      NEW.phone,
      NEW.link,
      NEW.comment,
      NEW.tipo_presupuesto,
      NEW.frecuencia
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_next_recurring_expense
AFTER UPDATE ON expenses
FOR EACH ROW
EXECUTE FUNCTION create_next_recurring_expense();
