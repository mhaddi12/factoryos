-- Database backstops for tenant isolation, stock, and closed documents.
-- Application services still have to enforce these rules. The database rejects
-- writes that skip them.

CREATE OR REPLACE FUNCTION assert_same_company(entity_company text, expected_company text, label text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF entity_company IS NULL THEN
    RAISE EXCEPTION '% was not found', label;
  END IF;

  IF entity_company IS DISTINCT FROM expected_company THEN
    RAISE EXCEPTION '% belongs to a different company', label;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION product_category_same_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  category_company text;
BEGIN
  IF NEW."categoryId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "companyId" INTO category_company FROM "ProductCategory" WHERE "id" = NEW."categoryId";
  PERFORM assert_same_company(category_company, NEW."companyId", 'Product category');
  RETURN NEW;
END;
$$;

CREATE TRIGGER product_category_same_company
BEFORE INSERT OR UPDATE OF "categoryId", "companyId" ON "Product"
FOR EACH ROW EXECUTE FUNCTION product_category_same_company();

CREATE OR REPLACE FUNCTION stock_balance_same_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  product_company text;
  warehouse_company text;
BEGIN
  SELECT "companyId" INTO product_company FROM "Product" WHERE "id" = NEW."productId";
  SELECT "companyId" INTO warehouse_company FROM "Warehouse" WHERE "id" = NEW."warehouseId";
  PERFORM assert_same_company(product_company, NEW."companyId", 'Product');
  PERFORM assert_same_company(warehouse_company, NEW."companyId", 'Warehouse');
  RETURN NEW;
END;
$$;

CREATE TRIGGER stock_balance_same_company
BEFORE INSERT OR UPDATE OF "companyId", "productId", "warehouseId" ON "StockBalance"
FOR EACH ROW EXECUTE FUNCTION stock_balance_same_company();

CREATE OR REPLACE FUNCTION stock_movement_same_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  product_company text;
  warehouse_company text;
  user_company text;
BEGIN
  SELECT "companyId" INTO product_company FROM "Product" WHERE "id" = NEW."productId";
  SELECT "companyId" INTO warehouse_company FROM "Warehouse" WHERE "id" = NEW."warehouseId";
  SELECT "companyId" INTO user_company FROM "User" WHERE "id" = NEW."createdById";
  PERFORM assert_same_company(product_company, NEW."companyId", 'Product');
  PERFORM assert_same_company(warehouse_company, NEW."companyId", 'Warehouse');
  PERFORM assert_same_company(user_company, NEW."companyId", 'User');
  RETURN NEW;
END;
$$;

CREATE TRIGGER stock_movement_same_company
BEFORE INSERT OR UPDATE OF "companyId", "productId", "warehouseId", "createdById" ON "StockMovement"
FOR EACH ROW EXECUTE FUNCTION stock_movement_same_company();

CREATE OR REPLACE FUNCTION stock_movement_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Stock movements cannot be edited or deleted';
END;
$$;

CREATE TRIGGER stock_movement_append_only
BEFORE UPDATE OR DELETE ON "StockMovement"
FOR EACH ROW EXECUTE FUNCTION stock_movement_append_only();

CREATE OR REPLACE FUNCTION purchase_order_same_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  supplier_company text;
  warehouse_company text;
  user_company text;
BEGIN
  SELECT "companyId" INTO supplier_company FROM "Supplier" WHERE "id" = NEW."supplierId";
  SELECT "companyId" INTO warehouse_company FROM "Warehouse" WHERE "id" = NEW."warehouseId";
  SELECT "companyId" INTO user_company FROM "User" WHERE "id" = NEW."createdById";
  PERFORM assert_same_company(supplier_company, NEW."companyId", 'Supplier');
  PERFORM assert_same_company(warehouse_company, NEW."companyId", 'Warehouse');
  PERFORM assert_same_company(user_company, NEW."companyId", 'User');
  RETURN NEW;
END;
$$;

CREATE TRIGGER purchase_order_same_company
BEFORE INSERT OR UPDATE OF "companyId", "supplierId", "warehouseId", "createdById" ON "PurchaseOrder"
FOR EACH ROW EXECUTE FUNCTION purchase_order_same_company();

CREATE OR REPLACE FUNCTION purchase_order_item_same_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  order_company text;
  product_company text;
BEGIN
  SELECT "companyId" INTO order_company FROM "PurchaseOrder" WHERE "id" = NEW."purchaseOrderId";
  SELECT "companyId" INTO product_company FROM "Product" WHERE "id" = NEW."productId";
  PERFORM assert_same_company(product_company, order_company, 'Purchase order product');
  RETURN NEW;
END;
$$;

CREATE TRIGGER purchase_order_item_same_company
BEFORE INSERT OR UPDATE OF "purchaseOrderId", "productId" ON "PurchaseOrderItem"
FOR EACH ROW EXECUTE FUNCTION purchase_order_item_same_company();

CREATE OR REPLACE FUNCTION protect_purchase_order()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."status" IN ('PARTIALLY_RECEIVED', 'RECEIVED') THEN
    RAISE EXCEPTION 'Received purchase orders cannot be deleted';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW."status" = 'CANCELLED' AND EXISTS (
    SELECT 1 FROM "PurchaseReceipt" WHERE "purchaseOrderId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'Purchase orders with receipts cannot be cancelled';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" = 'RECEIVED' AND NEW."status" IS DISTINCT FROM 'RECEIVED' THEN
    RAISE EXCEPTION 'Received purchase orders cannot change status';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER protect_purchase_order
BEFORE UPDATE OR DELETE ON "PurchaseOrder"
FOR EACH ROW EXECUTE FUNCTION protect_purchase_order();

CREATE OR REPLACE FUNCTION sales_order_same_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  customer_company text;
  warehouse_company text;
  user_company text;
BEGIN
  SELECT "companyId" INTO customer_company FROM "Customer" WHERE "id" = NEW."customerId";
  SELECT "companyId" INTO warehouse_company FROM "Warehouse" WHERE "id" = NEW."warehouseId";
  SELECT "companyId" INTO user_company FROM "User" WHERE "id" = NEW."createdById";
  PERFORM assert_same_company(customer_company, NEW."companyId", 'Customer');
  PERFORM assert_same_company(warehouse_company, NEW."companyId", 'Warehouse');
  PERFORM assert_same_company(user_company, NEW."companyId", 'User');
  RETURN NEW;
END;
$$;

CREATE TRIGGER sales_order_same_company
BEFORE INSERT OR UPDATE OF "companyId", "customerId", "warehouseId", "createdById" ON "SalesOrder"
FOR EACH ROW EXECUTE FUNCTION sales_order_same_company();

CREATE OR REPLACE FUNCTION sales_order_item_same_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  order_company text;
  product_company text;
BEGIN
  SELECT "companyId" INTO order_company FROM "SalesOrder" WHERE "id" = NEW."salesOrderId";
  SELECT "companyId" INTO product_company FROM "Product" WHERE "id" = NEW."productId";
  PERFORM assert_same_company(product_company, order_company, 'Sales order product');
  RETURN NEW;
END;
$$;

CREATE TRIGGER sales_order_item_same_company
BEFORE INSERT OR UPDATE OF "salesOrderId", "productId" ON "SalesOrderItem"
FOR EACH ROW EXECUTE FUNCTION sales_order_item_same_company();

CREATE OR REPLACE FUNCTION protect_sales_order()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."status" IN ('PARTIALLY_DELIVERED', 'DELIVERED') THEN
    RAISE EXCEPTION 'Delivered sales orders cannot be deleted';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW."status" = 'CANCELLED' AND EXISTS (
    SELECT 1 FROM "SalesDelivery" WHERE "salesOrderId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'Sales orders with deliveries cannot be cancelled';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" = 'DELIVERED' AND NEW."status" IS DISTINCT FROM 'DELIVERED' THEN
    RAISE EXCEPTION 'Delivered sales orders cannot change status';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER protect_sales_order
BEFORE UPDATE OR DELETE ON "SalesOrder"
FOR EACH ROW EXECUTE FUNCTION protect_sales_order();

CREATE OR REPLACE FUNCTION bom_product_is_producible()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  product_company text;
  product_type "ProductType";
BEGIN
  SELECT "companyId", "type" INTO product_company, product_type FROM "Product" WHERE "id" = NEW."productId";
  PERFORM assert_same_company(product_company, NEW."companyId", 'BOM product');

  IF product_type NOT IN ('FINISHED_GOOD', 'SEMI_FINISHED') THEN
    RAISE EXCEPTION 'A BOM can only belong to a finished or semi-finished product';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bom_product_is_producible
BEFORE INSERT OR UPDATE OF "companyId", "productId" ON "Bom"
FOR EACH ROW EXECUTE FUNCTION bom_product_is_producible();

CREATE OR REPLACE FUNCTION bom_item_same_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  bom_company text;
  bom_product_id text;
  material_company text;
BEGIN
  SELECT "companyId", "productId" INTO bom_company, bom_product_id FROM "Bom" WHERE "id" = NEW."bomId";
  SELECT "companyId" INTO material_company FROM "Product" WHERE "id" = NEW."materialProductId";
  PERFORM assert_same_company(material_company, bom_company, 'BOM material');

  IF NEW."materialProductId" = bom_product_id THEN
    RAISE EXCEPTION 'A product cannot be a component of its own BOM';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bom_item_same_company
BEFORE INSERT OR UPDATE OF "bomId", "materialProductId" ON "BomItem"
FOR EACH ROW EXECUTE FUNCTION bom_item_same_company();

CREATE OR REPLACE FUNCTION production_order_same_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  product_company text;
  bom_company text;
  bom_product_id text;
  material_warehouse_company text;
  output_warehouse_company text;
  user_company text;
BEGIN
  SELECT "companyId" INTO product_company FROM "Product" WHERE "id" = NEW."productId";
  SELECT "companyId", "productId" INTO bom_company, bom_product_id FROM "Bom" WHERE "id" = NEW."bomId";
  SELECT "companyId" INTO material_warehouse_company FROM "Warehouse" WHERE "id" = NEW."materialWarehouseId";
  SELECT "companyId" INTO output_warehouse_company FROM "Warehouse" WHERE "id" = NEW."outputWarehouseId";
  SELECT "companyId" INTO user_company FROM "User" WHERE "id" = NEW."createdById";

  PERFORM assert_same_company(product_company, NEW."companyId", 'Production product');
  PERFORM assert_same_company(bom_company, NEW."companyId", 'BOM');
  PERFORM assert_same_company(material_warehouse_company, NEW."companyId", 'Material warehouse');
  PERFORM assert_same_company(output_warehouse_company, NEW."companyId", 'Output warehouse');
  PERFORM assert_same_company(user_company, NEW."companyId", 'User');

  IF bom_product_id IS DISTINCT FROM NEW."productId" THEN
    RAISE EXCEPTION 'The selected BOM does not belong to the production product';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER production_order_same_company
BEFORE INSERT OR UPDATE OF "companyId", "productId", "bomId", "materialWarehouseId", "outputWarehouseId", "createdById" ON "ProductionOrder"
FOR EACH ROW EXECUTE FUNCTION production_order_same_company();

CREATE OR REPLACE FUNCTION protect_production_order()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."status" = 'COMPLETED' THEN
    RAISE EXCEPTION 'Completed production orders cannot be deleted';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" = 'COMPLETED' THEN
    IF NEW."status" IS DISTINCT FROM OLD."status"
      OR NEW."productId" IS DISTINCT FROM OLD."productId"
      OR NEW."bomId" IS DISTINCT FROM OLD."bomId"
      OR NEW."materialWarehouseId" IS DISTINCT FROM OLD."materialWarehouseId"
      OR NEW."outputWarehouseId" IS DISTINCT FROM OLD."outputWarehouseId"
      OR NEW."plannedQuantity" IS DISTINCT FROM OLD."plannedQuantity"
      OR NEW."producedQuantity" IS DISTINCT FROM OLD."producedQuantity"
      OR NEW."materialCost" IS DISTINCT FROM OLD."materialCost"
      OR NEW."labourCost" IS DISTINCT FROM OLD."labourCost"
      OR NEW."otherCost" IS DISTINCT FROM OLD."otherCost"
      OR NEW."totalCost" IS DISTINCT FROM OLD."totalCost"
      OR NEW."unitCost" IS DISTINCT FROM OLD."unitCost"
      OR NEW."companyId" IS DISTINCT FROM OLD."companyId"
      OR NEW."orderNumber" IS DISTINCT FROM OLD."orderNumber"
    THEN
      RAISE EXCEPTION 'Completed production orders cannot be edited';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW."status" = 'CANCELLED' AND OLD."status" IN ('IN_PROGRESS', 'COMPLETED') THEN
    RAISE EXCEPTION 'Started or completed production cannot be cancelled without a reversal';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER protect_production_order
BEFORE UPDATE OR DELETE ON "ProductionOrder"
FOR EACH ROW EXECUTE FUNCTION protect_production_order();

CREATE OR REPLACE FUNCTION production_material_same_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  order_company text;
  product_company text;
BEGIN
  SELECT "companyId" INTO order_company FROM "ProductionOrder" WHERE "id" = NEW."productionOrderId";
  SELECT "companyId" INTO product_company FROM "Product" WHERE "id" = NEW."productId";
  PERFORM assert_same_company(product_company, order_company, 'Production material');
  RETURN NEW;
END;
$$;

CREATE TRIGGER production_material_same_company
BEFORE INSERT OR UPDATE OF "productionOrderId", "productId" ON "ProductionMaterial"
FOR EACH ROW EXECUTE FUNCTION production_material_same_company();

ALTER TABLE "StockBalance"
  ADD CONSTRAINT "StockBalance_quantity_nonneg" CHECK ("quantity" >= 0),
  ADD CONSTRAINT "StockBalance_average_cost_nonneg" CHECK ("averageCost" >= 0);

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_values_nonneg" CHECK (
    "costPrice" >= 0 AND "sellingPrice" >= 0 AND "minimumStock" >= 0
  );

ALTER TABLE "BomItem"
  ADD CONSTRAINT "BomItem_quantity_pos" CHECK ("quantity" > 0),
  ADD CONSTRAINT "BomItem_wastage_range" CHECK ("wastagePercentage" >= 0 AND "wastagePercentage" <= 100);

ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_totals" CHECK (
    "subtotal" >= 0
    AND "discount" >= 0
    AND "tax" >= 0
    AND "total" >= 0
    AND "amountPaid" >= 0
    AND "discount" <= "subtotal"
    AND "amountPaid" <= "total"
    AND "total" = "subtotal" - "discount" + "tax"
  );

ALTER TABLE "SalesOrder"
  ADD CONSTRAINT "SalesOrder_totals" CHECK (
    "subtotal" >= 0
    AND "discount" >= 0
    AND "tax" >= 0
    AND "total" >= 0
    AND "amountPaid" >= 0
    AND "discount" <= "subtotal"
    AND "amountPaid" <= "total"
    AND "total" = "subtotal" - "discount" + "tax"
  );

ALTER TABLE "PurchaseOrderItem"
  ADD CONSTRAINT "PurchaseOrderItem_quantities" CHECK (
    "quantity" > 0
    AND "receivedQuantity" >= 0
    AND "receivedQuantity" <= "quantity"
    AND "unitPrice" >= 0
    AND "lineTotal" >= 0
  );

ALTER TABLE "SalesOrderItem"
  ADD CONSTRAINT "SalesOrderItem_quantities" CHECK (
    "quantity" > 0
    AND "deliveredQuantity" >= 0
    AND "deliveredQuantity" <= "quantity"
    AND "unitPrice" >= 0
    AND "lineTotal" >= 0
  );

ALTER TABLE "PurchaseReceiptItem"
  ADD CONSTRAINT "PurchaseReceiptItem_values" CHECK (
    "quantity" > 0 AND "unitCost" >= 0 AND "lineTotal" >= 0
  );

ALTER TABLE "SalesDeliveryItem"
  ADD CONSTRAINT "SalesDeliveryItem_values" CHECK (
    "quantity" > 0 AND "unitCost" >= 0 AND "lineTotal" >= 0
  );

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amount_pos" CHECK ("amount" > 0),
  ADD CONSTRAINT "Payment_party" CHECK (
    ("direction" = 'INCOMING' AND "customerId" IS NOT NULL)
    OR ("direction" = 'OUTGOING' AND "supplierId" IS NOT NULL)
  );

ALTER TABLE "ProductionOrder"
  ADD CONSTRAINT "ProductionOrder_quantities" CHECK (
    "plannedQuantity" > 0
    AND "producedQuantity" >= 0
    AND "materialCost" >= 0
    AND "labourCost" >= 0
    AND "otherCost" >= 0
    AND "totalCost" >= 0
    AND "unitCost" >= 0
  );

ALTER TABLE "ProductionMaterial"
  ADD CONSTRAINT "ProductionMaterial_quantities" CHECK (
    "quantityPerUnit" > 0
    AND "wastagePercentage" >= 0
    AND "wastagePercentage" <= 100
    AND "requiredQuantity" >= 0
    AND "consumedQuantity" >= 0
    AND "consumedQuantity" <= "requiredQuantity"
    AND "unitCost" >= 0
    AND "lineCost" >= 0
  );

ALTER TABLE "StockTransfer"
  ADD CONSTRAINT "StockTransfer_warehouses_differ" CHECK ("fromWarehouseId" <> "toWarehouseId");

ALTER TABLE "StockTransferItem"
  ADD CONSTRAINT "StockTransferItem_quantity_pos" CHECK ("quantity" > 0);

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_sign" CHECK (
    (
      "type" IN ('PURCHASE', 'PRODUCTION_IN', 'SALE_RETURN', 'TRANSFER_IN')
      AND "quantity" > 0
    )
    OR (
      "type" IN ('PRODUCTION_OUT', 'SALE', 'PURCHASE_RETURN', 'TRANSFER_OUT')
      AND "quantity" < 0
    )
    OR ("type" = 'ADJUSTMENT' AND "quantity" <> 0)
  ),
  ADD CONSTRAINT "StockMovement_reference" CHECK (
    ("type" = 'ADJUSTMENT' AND "referenceType" IS NULL AND "referenceId" IS NULL)
    OR ("type" <> 'ADJUSTMENT' AND "referenceType" IS NOT NULL AND "referenceId" IS NOT NULL)
  ),
  ADD CONSTRAINT "StockMovement_unit_cost_nonneg" CHECK ("unitCost" >= 0);

CREATE UNIQUE INDEX "Bom_one_active_per_product_idx"
  ON "Bom" ("companyId", "productId")
  WHERE "isActive" = true;
