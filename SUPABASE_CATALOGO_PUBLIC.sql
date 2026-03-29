-- ============================================
-- POLÍTICAS DE LECTURA PÚBLICA PARA CATÁLOGO
-- Ejecutar en SQL Editor de Supabase
-- ============================================

-- Habilitar RLS en servicios (si no está habilitado)
ALTER TABLE servicios ENABLE ROW LEVEL SECURITY;

-- Lectura pública de servicios (nombre y precio)
CREATE POLICY "Lectura pública de servicios"
ON servicios
FOR SELECT
USING (true);

-- Escritura solo para usuarios autenticados
CREATE POLICY "Solo autenticados pueden modificar servicios"
ON servicios
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- ============================================

-- Habilitar RLS en insumos (si no está habilitado)
ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;

-- Lectura pública de insumos (nombre, categoria, precio, imagen_url)
-- El stock NO se expone en el catálogo (la query solo pide esas columnas)
CREATE POLICY "Lectura pública de insumos"
ON insumos
FOR SELECT
USING (true);

-- Escritura solo para usuarios autenticados
CREATE POLICY "Solo autenticados pueden modificar insumos"
ON insumos
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
