import { query, transaction } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { audit } from './audit.service.js';

const mapProduct = (row) => ({
  id: row.id_producto,
  code: row.codigo_barra,
  name: row.nombre,
  description: row.descripcion,
  categoryId: row.id_categoria,
  category: row.categoria,
  price: Number(row.precio_venta),
  stock: Number(row.stock_actual ?? 0),
  minimumStock: Number(row.stock_minimo_inventario ?? row.stock_minimo ?? 0),
  maximumStock: row.stock_maximo == null ? null : Number(row.stock_maximo),
  location: row.ubicacion,
  status: Number(row.stock_actual) === 0 ? 'AGOTADO' : Number(row.stock_actual) <= Number(row.stock_minimo_inventario) ? 'STOCK_BAJO' : 'DISPONIBLE',
  active: row.estado === 'ACTIVO',
});

export async function listProducts({ q = '', category, stockStatus }) {
  const params = [`%${q}%`];
  const filters = [`(p.nombre ILIKE $1 OR p.codigo_barra ILIKE $1)`];
  if (category) {
    params.push(category);
    filters.push(`c.id_categoria = $${params.length}`);
  }
  if (stockStatus === 'AGOTADO') filters.push('i.stock_actual = 0');
  if (stockStatus === 'STOCK_BAJO') filters.push('i.stock_actual > 0 AND i.stock_actual <= i.stock_minimo');
  if (stockStatus === 'DISPONIBLE') filters.push('i.stock_actual > i.stock_minimo');
  const result = await query(`SELECT p.*,c.nombre AS categoria,i.stock_actual,i.stock_minimo AS stock_minimo_inventario,i.stock_maximo,i.ubicacion
    FROM producto p JOIN categoria c ON c.id_categoria=p.id_categoria
    LEFT JOIN inventario i ON i.id_producto=p.id_producto
    WHERE ${filters.join(' AND ')} ORDER BY p.nombre`, params);
  return result.rows.map(mapProduct);
}

export async function createProduct(input, actor) {
  return transaction(async (db) => {
    try {
      const product = await db.query(`INSERT INTO producto(id_categoria,codigo_barra,nombre,descripcion,precio_venta,stock_minimo,estado)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [input.categoryId, input.code, input.name, input.description || null, input.price, input.minimumStock, input.active === false ? 'INACTIVO' : 'ACTIVO']);
      await db.query(`INSERT INTO inventario(id_producto,stock_actual,stock_minimo,stock_maximo,ubicacion)
        VALUES ($1,$2,$3,$4,$5)`, [product.rows[0].id_producto, input.initialStock || 0, input.minimumStock, input.maximumStock || null, input.location || null]);
      await audit(db, { ...actor, action: 'PRODUCTO_CREADO', description: `Producto ${input.code} creado` });
      return (await listProductById(db, product.rows[0].id_producto));
    } catch (error) {
      if (error.code === '23505') throw new AppError('El código de barras ya está registrado.', 409, 'DUPLICATE_CODE');
      throw error;
    }
  });
}

export async function updateProduct(id, input, actor) {
  return transaction(async (db) => {
    const result = await db.query(`UPDATE producto SET
      id_categoria=COALESCE($2,id_categoria), codigo_barra=COALESCE($3,codigo_barra),
      nombre=COALESCE($4,nombre), descripcion=COALESCE($5,descripcion),
      precio_venta=COALESCE($6,precio_venta), stock_minimo=COALESCE($7,stock_minimo),
      estado=COALESCE($8,estado)
      WHERE id_producto=$1 RETURNING id_producto`,
    [id, input.categoryId, input.code, input.name, input.description, input.price, input.minimumStock, input.active == null ? null : input.active ? 'ACTIVO' : 'INACTIVO']);
    if (!result.rowCount) throw new AppError('Producto no encontrado.', 404, 'PRODUCT_NOT_FOUND');
    if (input.minimumStock != null || input.maximumStock != null || input.location != null) {
      await db.query(`UPDATE inventario SET stock_minimo=COALESCE($2,stock_minimo),
        stock_maximo=COALESCE($3,stock_maximo),ubicacion=COALESCE($4,ubicacion) WHERE id_producto=$1`,
      [id, input.minimumStock, input.maximumStock, input.location]);
    }
    await audit(db, { ...actor, action: 'PRODUCTO_ACTUALIZADO', description: `Producto ${id} actualizado` });
    return listProductById(db, id);
  });
}

async function listProductById(db, id) {
  const result = await db.query(`SELECT p.*,c.nombre AS categoria,i.stock_actual,i.stock_minimo AS stock_minimo_inventario,i.stock_maximo,i.ubicacion
    FROM producto p JOIN categoria c ON c.id_categoria=p.id_categoria
    LEFT JOIN inventario i ON i.id_producto=p.id_producto WHERE p.id_producto=$1`, [id]);
  if (!result.rowCount) throw new AppError('Producto no encontrado.', 404, 'PRODUCT_NOT_FOUND');
  return mapProduct(result.rows[0]);
}

export async function listCategories() {
  const result = await query('SELECT id_categoria AS id,nombre AS name,descripcion AS description,estado AS status FROM categoria ORDER BY nombre');
  return result.rows;
}

export async function createCategory(input) {
  try {
    return (await query(`INSERT INTO categoria(nombre,descripcion) VALUES ($1,$2)
      RETURNING id_categoria AS id,nombre AS name,descripcion AS description,estado AS status`, [input.name, input.description || null])).rows[0];
  } catch (error) {
    if (error.code === '23505') throw new AppError('La categoría ya existe.', 409, 'DUPLICATE_CATEGORY');
    throw error;
  }
}

export async function updateCategory(id, input) {
  const result = await query(`UPDATE categoria SET nombre=COALESCE($2,nombre),descripcion=COALESCE($3,descripcion),
    estado=COALESCE($4,estado) WHERE id_categoria=$1
    RETURNING id_categoria AS id,nombre AS name,descripcion AS description,estado AS status`,
  [id, input.name, input.description, input.active == null ? null : input.active ? 'ACTIVO' : 'INACTIVO']);
  if (!result.rowCount) throw new AppError('Categoría no encontrada.', 404, 'CATEGORY_NOT_FOUND');
  return result.rows[0];
}
