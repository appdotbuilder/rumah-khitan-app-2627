import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { medicinesTable, stockMovementsTable } from '../db/schema';
import { type UpdateMedicineInput, type CreateMedicineInput } from '../schema';
import { updateMedicine } from '../handlers/update_medicine';
import { eq } from 'drizzle-orm';

// Helper function to create a test medicine
const createTestMedicine = async (overrides: Partial<CreateMedicineInput> = {}) => {
  const testMedicine = {
    name: 'Test Medicine',
    description: 'Test description',
    unit: 'tablet',
    price_per_unit: 15.50,
    stock_quantity: 100,
    minimum_stock: 10,
    expiry_date: new Date('2025-12-31'),
    supplier: 'Test Supplier',
    ...overrides
  };

  const result = await db.insert(medicinesTable)
    .values({
      ...testMedicine,
      price_per_unit: testMedicine.price_per_unit.toString(),
      expiry_date: testMedicine.expiry_date ? testMedicine.expiry_date.toISOString().split('T')[0] : null
    })
    .returning()
    .execute();

  return {
    ...result[0],
    price_per_unit: parseFloat(result[0].price_per_unit),
    expiry_date: result[0].expiry_date ? new Date(result[0].expiry_date) : null
  };
};

// Test input for updating medicine
const testUpdateInput: UpdateMedicineInput = {
  id: 1,
  name: 'Updated Medicine',
  description: 'Updated description',
  unit: 'capsule',
  price_per_unit: 25.75,
  stock_quantity: 150,
  minimum_stock: 15,
  expiry_date: new Date('2026-06-30'),
  supplier: 'Updated Supplier'
};

describe('updateMedicine', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update all medicine fields', async () => {
    const medicine = await createTestMedicine();
    
    const updateInput = {
      ...testUpdateInput,
      id: medicine.id
    };

    const result = await updateMedicine(updateInput);

    // Verify all fields are updated
    expect(result.id).toEqual(medicine.id);
    expect(result.name).toEqual('Updated Medicine');
    expect(result.description).toEqual('Updated description');
    expect(result.unit).toEqual('capsule');
    expect(result.price_per_unit).toEqual(25.75);
    expect(typeof result.price_per_unit).toBe('number');
    expect(result.stock_quantity).toEqual(150);
    expect(result.minimum_stock).toEqual(15);
    expect(result.expiry_date).toEqual(new Date('2026-06-30'));
    expect(result.supplier).toEqual('Updated Supplier');
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should update medicine in database', async () => {
    const medicine = await createTestMedicine();
    
    const updateInput = {
      id: medicine.id,
      name: 'Database Updated Medicine',
      price_per_unit: 30.00,
      stock_quantity: 200
    };

    await updateMedicine(updateInput);

    // Verify database was updated
    const updatedMedicines = await db.select()
      .from(medicinesTable)
      .where(eq(medicinesTable.id, medicine.id))
      .execute();

    expect(updatedMedicines).toHaveLength(1);
    expect(updatedMedicines[0].name).toEqual('Database Updated Medicine');
    expect(parseFloat(updatedMedicines[0].price_per_unit)).toEqual(30.00);
    expect(updatedMedicines[0].stock_quantity).toEqual(200);
    expect(updatedMedicines[0].updated_at).toBeInstanceOf(Date);
  });

  it('should update only specified fields', async () => {
    const medicine = await createTestMedicine();
    
    const partialUpdate: UpdateMedicineInput = {
      id: medicine.id,
      name: 'Partially Updated Medicine',
      price_per_unit: 40.00
    };

    const result = await updateMedicine(partialUpdate);

    // Verify only specified fields are updated
    expect(result.name).toEqual('Partially Updated Medicine');
    expect(result.price_per_unit).toEqual(40.00);
    
    // Verify other fields remain unchanged
    expect(result.description).toEqual(medicine.description);
    expect(result.unit).toEqual(medicine.unit);
    expect(result.stock_quantity).toEqual(medicine.stock_quantity);
    expect(result.minimum_stock).toEqual(medicine.minimum_stock);
    expect(result.supplier).toEqual(medicine.supplier);
  });

  it('should create stock movement when stock quantity increases', async () => {
    const medicine = await createTestMedicine({
      stock_quantity: 100
    });
    
    const updateInput: UpdateMedicineInput = {
      id: medicine.id,
      stock_quantity: 150
    };

    await updateMedicine(updateInput);

    // Verify stock movement was created
    const stockMovements = await db.select()
      .from(stockMovementsTable)
      .where(eq(stockMovementsTable.medicine_id, medicine.id))
      .execute();

    expect(stockMovements).toHaveLength(1);
    expect(stockMovements[0].medicine_id).toEqual(medicine.id);
    expect(stockMovements[0].movement_type).toEqual('masuk');
    expect(stockMovements[0].quantity).toEqual(50);
    expect(stockMovements[0].reference_id).toBeNull();
    expect(stockMovements[0].notes).toEqual('Stock adjustment via medicine update');
    expect(stockMovements[0].created_at).toBeInstanceOf(Date);
  });

  it('should create stock movement when stock quantity decreases', async () => {
    const medicine = await createTestMedicine({
      stock_quantity: 100
    });
    
    const updateInput: UpdateMedicineInput = {
      id: medicine.id,
      stock_quantity: 75
    };

    await updateMedicine(updateInput);

    // Verify stock movement was created
    const stockMovements = await db.select()
      .from(stockMovementsTable)
      .where(eq(stockMovementsTable.medicine_id, medicine.id))
      .execute();

    expect(stockMovements).toHaveLength(1);
    expect(stockMovements[0].medicine_id).toEqual(medicine.id);
    expect(stockMovements[0].movement_type).toEqual('keluar');
    expect(stockMovements[0].quantity).toEqual(25);
    expect(stockMovements[0].reference_id).toBeNull();
    expect(stockMovements[0].notes).toEqual('Stock adjustment via medicine update');
  });

  it('should not create stock movement when stock quantity unchanged', async () => {
    const medicine = await createTestMedicine({
      stock_quantity: 100
    });
    
    const updateInput: UpdateMedicineInput = {
      id: medicine.id,
      name: 'Updated Name Only',
      stock_quantity: 100 // Same as current
    };

    await updateMedicine(updateInput);

    // Verify no stock movement was created
    const stockMovements = await db.select()
      .from(stockMovementsTable)
      .where(eq(stockMovementsTable.medicine_id, medicine.id))
      .execute();

    expect(stockMovements).toHaveLength(0);
  });

  it('should not create stock movement when stock quantity not provided', async () => {
    const medicine = await createTestMedicine();
    
    const updateInput: UpdateMedicineInput = {
      id: medicine.id,
      name: 'Updated Name Only'
    };

    await updateMedicine(updateInput);

    // Verify no stock movement was created
    const stockMovements = await db.select()
      .from(stockMovementsTable)
      .where(eq(stockMovementsTable.medicine_id, medicine.id))
      .execute();

    expect(stockMovements).toHaveLength(0);
  });

  it('should handle null values correctly', async () => {
    const medicine = await createTestMedicine({
      description: 'Original description',
      expiry_date: new Date('2025-01-01'),
      supplier: 'Original supplier'
    });
    
    const updateInput: UpdateMedicineInput = {
      id: medicine.id,
      description: null,
      expiry_date: null,
      supplier: null
    };

    const result = await updateMedicine(updateInput);

    // Verify null values are set correctly
    expect(result.description).toBeNull();
    expect(result.expiry_date).toBeNull();
    expect(result.supplier).toBeNull();
  });

  it('should throw error when medicine not found', async () => {
    const updateInput: UpdateMedicineInput = {
      id: 99999, // Non-existent ID
      name: 'Updated Medicine'
    };

    expect(updateMedicine(updateInput)).rejects.toThrow(/Medicine with id 99999 not found/i);
  });

  it('should handle large stock adjustments correctly', async () => {
    const medicine = await createTestMedicine({
      stock_quantity: 50
    });
    
    const updateInput: UpdateMedicineInput = {
      id: medicine.id,
      stock_quantity: 500 // Large increase
    };

    const result = await updateMedicine(updateInput);

    expect(result.stock_quantity).toEqual(500);

    // Verify large stock movement was created
    const stockMovements = await db.select()
      .from(stockMovementsTable)
      .where(eq(stockMovementsTable.medicine_id, medicine.id))
      .execute();

    expect(stockMovements).toHaveLength(1);
    expect(stockMovements[0].movement_type).toEqual('masuk');
    expect(stockMovements[0].quantity).toEqual(450);
  });

  it('should handle zero stock quantity correctly', async () => {
    const medicine = await createTestMedicine({
      stock_quantity: 25
    });
    
    const updateInput: UpdateMedicineInput = {
      id: medicine.id,
      stock_quantity: 0
    };

    const result = await updateMedicine(updateInput);

    expect(result.stock_quantity).toEqual(0);

    // Verify stock movement was created
    const stockMovements = await db.select()
      .from(stockMovementsTable)
      .where(eq(stockMovementsTable.medicine_id, medicine.id))
      .execute();

    expect(stockMovements).toHaveLength(1);
    expect(stockMovements[0].movement_type).toEqual('keluar');
    expect(stockMovements[0].quantity).toEqual(25);
  });

  it('should preserve timestamp fields correctly', async () => {
    const medicine = await createTestMedicine();
    const originalCreatedAt = medicine.created_at;
    
    // Wait a small amount to ensure updated_at changes
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const updateInput: UpdateMedicineInput = {
      id: medicine.id,
      name: 'Timestamp Test'
    };

    const result = await updateMedicine(updateInput);

    // created_at should remain unchanged
    expect(result.created_at).toEqual(originalCreatedAt);
    
    // updated_at should be newer
    expect(result.updated_at.getTime()).toBeGreaterThan(originalCreatedAt.getTime());
  });
});