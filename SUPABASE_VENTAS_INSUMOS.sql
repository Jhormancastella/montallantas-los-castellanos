-- ============================================
-- TABLA PARA VENTAS DIRECTAS DE INSUMOS
-- Ejecutar en SQL Editor de Supabase
-- ============================================

-- Crear tabla ventas_insumos
CREATE TABLE IF NOT EXISTS ventas_insumos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fecha DATE NOT NULL,
    hora TEXT NOT NULL,
    cliente TEXT DEFAULT 'Sin nombre',
    insumos_vendidos JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_insumos NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_cobrado NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_ventas_insumos_fecha ON ventas_insumos(fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_insumos_cliente ON ventas_insumos(cliente);

-- Habilitar Row Level Security (RLS)
ALTER TABLE ventas_insumos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS mejoradas (requieren autenticación)
-- Política de lectura: usuarios autenticados pueden leer
CREATE POLICY "Usuarios autenticados pueden leer ventas_insumos" 
ON ventas_insumos 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Política de inserción: usuarios autenticados pueden insertar
CREATE POLICY "Usuarios autenticados pueden insertar ventas_insumos" 
ON ventas_insumos 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Política de actualización: usuarios autenticados pueden actualizar
CREATE POLICY "Usuarios autenticados pueden actualizar ventas_insumos" 
ON ventas_insumos 
FOR UPDATE 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Política de eliminación: usuarios autenticados pueden eliminar
CREATE POLICY "Usuarios autenticados pueden eliminar ventas_insumos" 
ON ventas_insumos 
FOR DELETE 
USING (auth.role() = 'authenticated');

-- Comentarios para documentación
COMMENT ON TABLE ventas_insumos IS 'Registro de ventas directas de insumos sin servicio ni empleado';
COMMENT ON COLUMN ventas_insumos.fecha IS 'Fecha de la venta (YYYY-MM-DD)';
COMMENT ON COLUMN ventas_insumos.hora IS 'Hora de la venta (HH:MM:SS)';
COMMENT ON COLUMN ventas_insumos.cliente IS 'Nombre o documento del cliente';
COMMENT ON COLUMN ventas_insumos.insumos_vendidos IS 'Array JSON con los insumos vendidos [{id, nombre, precio}]';
COMMENT ON COLUMN ventas_insumos.total_insumos IS 'Total de insumos vendidos';
COMMENT ON COLUMN ventas_insumos.total_cobrado IS 'Total cobrado al cliente';

-- ============================================
-- TABLA PARA PRÉSTAMOS A EMPLEADOS
-- ============================================

-- Crear tabla prestamos
CREATE TABLE IF NOT EXISTS prestamos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fecha DATE NOT NULL,
    hora TEXT NOT NULL,
    empleado_id TEXT NOT NULL,
    empleado_nombre TEXT NOT NULL,
    monto NUMERIC(10, 2) NOT NULL DEFAULT 0,
    motivo TEXT DEFAULT 'Sin motivo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_prestamos_fecha ON prestamos(fecha);
CREATE INDEX IF NOT EXISTS idx_prestamos_empleado_id ON prestamos(empleado_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE prestamos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS mejoradas (requieren autenticación)
-- Política de lectura: usuarios autenticados pueden leer
CREATE POLICY "Usuarios autenticados pueden leer prestamos" 
ON prestamos 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Política de inserción: usuarios autenticados pueden insertar
CREATE POLICY "Usuarios autenticados pueden insertar prestamos" 
ON prestamos 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Política de actualización: usuarios autenticados pueden actualizar
CREATE POLICY "Usuarios autenticados pueden actualizar prestamos" 
ON prestamos 
FOR UPDATE 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Política de eliminación: usuarios autenticados pueden eliminar
CREATE POLICY "Usuarios autenticados pueden eliminar prestamos" 
ON prestamos 
FOR DELETE 
USING (auth.role() = 'authenticated');

-- Comentarios para documentación
COMMENT ON TABLE prestamos IS 'Registro de préstamos realizados a empleados';
COMMENT ON COLUMN prestamos.fecha IS 'Fecha del préstamo (YYYY-MM-DD)';
COMMENT ON COLUMN prestamos.hora IS 'Hora del préstamo (HH:MM:SS)';
COMMENT ON COLUMN prestamos.empleado_id IS 'ID del empleado que recibió el préstamo';
COMMENT ON COLUMN prestamos.empleado_nombre IS 'Nombre del empleado';
COMMENT ON COLUMN prestamos.monto IS 'Monto del préstamo en COP';
COMMENT ON COLUMN prestamos.motivo IS 'Motivo o descripción del préstamo';

-- ============================================
-- VERIFICAR QUE LAS TABLAS EXISTAN
-- ============================================

-- Verificar tabla servicios_realizados (debe existir)
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'servicios_realizados'
) AS servicios_realizados_existe;

-- Verificar tabla insumos (debe existir)
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'insumos'
) AS insumos_existe;

-- Verificar tabla ventas_insumos (recién creada)
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'ventas_insumos'
) AS ventas_insumos_existe;

-- ============================================
-- ESTRUCTURA ESPERADA DE LA TABLA INSUMOS
-- ============================================

-- La tabla insumos debe tener estas columnas:
-- - id (UUID, primary key)
-- - nombre (TEXT)
-- - categoria (TEXT)
-- - precio (NUMERIC)
-- - stock (INTEGER)
-- - imagen_url (TEXT, opcional)

-- ============================================
-- ESTRUCTURA ESPERADA DE LA TABLA SERVICIOS_REALIZADOS
-- ============================================

-- La tabla servicios_realizados debe tener estas columnas:
-- - id (UUID, primary key)
-- - fecha (DATE)
-- - hora (TEXT)
-- - servicio_id (TEXT)
-- - servicio_nombre (TEXT)
-- - empleado_id (TEXT)
-- - empleado_nombre (TEXT)
-- - cliente (TEXT)
-- - precio_servicio (NUMERIC)
-- - insumos_utilizados (JSONB)
-- - total_insumos (NUMERIC)
-- - comision (NUMERIC)
-- - total_cobrado (NUMERIC)

-- ============================================
-- NOTAS DE SEGURIDAD
-- ============================================

-- 1. Las políticas RLS ahora requieren autenticación
-- 2. Solo usuarios autenticados pueden realizar operaciones CRUD
-- 3. Para producción, considerar políticas más granulares por rol
-- 4. Ejemplo: Solo admin puede eliminar, empleados solo insertar/actualizar
