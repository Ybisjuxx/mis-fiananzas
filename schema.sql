-- 1. Create the `transactions` table
CREATE TABLE public.transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('ingreso', 'gasto')),
  amount numeric NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  date date NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 3. Create a policy allowing your application to Read, Insert, and Delete
-- NOTA IMPORTANTE: Para empezar rápido y sin sistema de usuarios (login),
-- vamos a permitir que cualquiera que tenga el enlace a tu app pueda leer y editar.
-- Más adelante, si alojas la app en internet, te recomendaré agregar un sistema de Login.
CREATE POLICY "Allow public access" 
  ON public.transactions 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
