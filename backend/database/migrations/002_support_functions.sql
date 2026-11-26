CREATE OR REPLACE FUNCTION nova_actualizar_alerta_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stock_actual <= NEW.stock_minimo THEN
    INSERT INTO alerta_stock (id_producto, tipo_alerta, stock_actual, stock_minimo)
    SELECT NEW.id_producto,
      CASE WHEN NEW.stock_actual = 0 THEN 'AGOTADO' ELSE 'STOCK_MINIMO' END,
      NEW.stock_actual, NEW.stock_minimo
    WHERE NOT EXISTS (
      SELECT 1 FROM alerta_stock
      WHERE id_producto = NEW.id_producto AND estado = 'PENDIENTE'
        AND tipo_alerta IN ('AGOTADO','STOCK_MINIMO')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventario_alerta ON inventario;
CREATE TRIGGER trg_inventario_alerta
AFTER INSERT OR UPDATE OF stock_actual ON inventario
FOR EACH ROW EXECUTE FUNCTION nova_actualizar_alerta_stock();
