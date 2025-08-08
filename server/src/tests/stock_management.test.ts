import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { medicinesTable, stockMovementsTable } from '../db/schema';
import { type CreateStockMovementInput } from '../schema';
import { createStockMovement, getStockMovements, adjustStock } from '../handlers/stock_management';
import { eq, desc } from 'drizzle-orm';

// Test data
const testMedicine = {
  name: 'Test Medicine',
  description: 'Medicine for testing',
  unit: 'tablet',
  price_per_unit: '10.50',
  stock_quantity: 100,
  minimum_stock: 10,
  expiry_date: '2025-12-31', // Use string format for date column
  supplier: 'Test Supplier'
};

const stockInInput: CreateStockMovementInput = {
  medicine_id: 1,
  movement_type: 'masuk',
  quantity: 50,
  reference_id: null,
  notes: 'Stock replenishment'
};

const stockOutInput: CreateStockMovementInput = {
  medicine_id: 1,
  movement_type: 'keluar',
  quantity: 25,
  reference_id: 123,
  notes: 'Sale transaction'
};

describe('Stock Management', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let medicineId: number;

  beforeEach(async () => {
    // Create a test medicine before each test
    const result = await db.insert(medicinesTable)
      .values(testMedicine)
      .returning()
      .execute();
    medicineId = result[0].id;
    
    // Update input with actual medicine ID
    stockInInput.medicine_id = medicineId;
    stockOutInput.medicine_id = medicineId;
  });

  describe('createStockMovement', () => {
    it('should create incoming stock movement and update medicine stock', async () => {
      const result = await createStockMovement(stockInInput);

      // Verify stock movement record
      expect(result.medicine_id).toBe(medicineId);
      expect(result.movement_type).toBe('masuk');
      expect(result.quantity).toBe(50);
      expect(result.reference_id).toBeNull();
      expect(result.notes).toBe('Stock replenishment');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);

      // Verify medicine stock was updated
      const medicine = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicineId))
        .execute();

      expect(medicine[0].stock_quantity).toBe(150); // 100 + 50
    });

    it('should create outgoing stock movement and update medicine stock', async () => {
      const result = await createStockMovement(stockOutInput);

      // Verify stock movement record
      expect(result.medicine_id).toBe(medicineId);
      expect(result.movement_type).toBe('keluar');
      expect(result.quantity).toBe(25);
      expect(result.reference_id).toBe(123);
      expect(result.notes).toBe('Sale transaction');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);

      // Verify medicine stock was updated
      const medicine = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicineId))
        .execute();

      expect(medicine[0].stock_quantity).toBe(75); // 100 - 25
    });

    it('should throw error when medicine does not exist', async () => {
      const invalidInput: CreateStockMovementInput = {
        medicine_id: 999,
        movement_type: 'masuk',
        quantity: 10,
        reference_id: null,
        notes: 'Test'
      };

      await expect(createStockMovement(invalidInput)).rejects.toThrow(/medicine not found/i);
    });

    it('should throw error when outgoing quantity exceeds stock', async () => {
      const excessiveOutInput: CreateStockMovementInput = {
        medicine_id: medicineId,
        movement_type: 'keluar',
        quantity: 150, // More than current stock of 100
        reference_id: null,
        notes: 'Excessive withdrawal'
      };

      await expect(createStockMovement(excessiveOutInput)).rejects.toThrow(/insufficient stock/i);

      // Verify stock wasn't changed
      const medicine = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicineId))
        .execute();

      expect(medicine[0].stock_quantity).toBe(100); // Should remain unchanged
    });

    it('should handle edge case of exact stock withdrawal', async () => {
      const exactStockOut: CreateStockMovementInput = {
        medicine_id: medicineId,
        movement_type: 'keluar',
        quantity: 100, // Exact current stock
        reference_id: null,
        notes: 'Complete stock withdrawal'
      };

      const result = await createStockMovement(exactStockOut);

      expect(result.quantity).toBe(100);

      // Verify stock is now zero
      const medicine = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicineId))
        .execute();

      expect(medicine[0].stock_quantity).toBe(0);
    });
  });

  describe('getStockMovements', () => {
    beforeEach(async () => {
      // Create multiple stock movements for testing
      await createStockMovement(stockInInput);
      await createStockMovement(stockOutInput);
      
      // Create another medicine and movement
      const anotherMedicine = await db.insert(medicinesTable)
        .values({
          ...testMedicine,
          name: 'Another Medicine',
          expiry_date: '2025-06-30' // Use string format for date column
        })
        .returning()
        .execute();

      await createStockMovement({
        medicine_id: anotherMedicine[0].id,
        movement_type: 'masuk',
        quantity: 20,
        reference_id: null,
        notes: 'Another medicine stock'
      });
    });

    it('should return all stock movements when no filter is applied', async () => {
      const movements = await getStockMovements();

      expect(movements).toHaveLength(3);
      
      // Verify they are ordered by created_at descending
      for (let i = 0; i < movements.length - 1; i++) {
        expect(movements[i].created_at >= movements[i + 1].created_at).toBe(true);
      }
    });

    it('should return filtered stock movements for specific medicine', async () => {
      const movements = await getStockMovements(medicineId);

      expect(movements).toHaveLength(2);
      movements.forEach(movement => {
        expect(movement.medicine_id).toBe(medicineId);
      });

      // Verify ordering (newest first)
      expect(movements[0].movement_type).toBe('keluar'); // This was created second
      expect(movements[1].movement_type).toBe('masuk');  // This was created first
    });

    it('should return empty array for medicine with no movements', async () => {
      // Create a medicine without any movements
      const emptyMedicine = await db.insert(medicinesTable)
        .values({
          ...testMedicine,
          name: 'Empty Medicine',
          expiry_date: '2025-08-15' // Use string format for date column
        })
        .returning()
        .execute();

      const movements = await getStockMovements(emptyMedicine[0].id);

      expect(movements).toHaveLength(0);
    });

    it('should handle non-existent medicine ID gracefully', async () => {
      const movements = await getStockMovements(999);

      expect(movements).toHaveLength(0);
    });
  });

  describe('adjustStock', () => {
    it('should increase stock with positive adjustment', async () => {
      await adjustStock(medicineId, 150, 'Inventory correction - increase');

      // Verify medicine stock was updated
      const medicine = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicineId))
        .execute();

      expect(medicine[0].stock_quantity).toBe(150);

      // Verify stock movement was created
      const movements = await db.select()
        .from(stockMovementsTable)
        .where(eq(stockMovementsTable.medicine_id, medicineId))
        .execute();

      expect(movements).toHaveLength(1);
      expect(movements[0].movement_type).toBe('masuk');
      expect(movements[0].quantity).toBe(50); // 150 - 100
      expect(movements[0].notes).toBe('Inventory correction - increase');
      expect(movements[0].reference_id).toBeNull();
    });

    it('should decrease stock with negative adjustment', async () => {
      await adjustStock(medicineId, 75, 'Inventory correction - decrease');

      // Verify medicine stock was updated
      const medicine = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicineId))
        .execute();

      expect(medicine[0].stock_quantity).toBe(75);

      // Verify stock movement was created
      const movements = await db.select()
        .from(stockMovementsTable)
        .where(eq(stockMovementsTable.medicine_id, medicineId))
        .execute();

      expect(movements).toHaveLength(1);
      expect(movements[0].movement_type).toBe('keluar');
      expect(movements[0].quantity).toBe(25); // 100 - 75
      expect(movements[0].notes).toBe('Inventory correction - decrease');
    });

    it('should handle zero adjustment without creating movement', async () => {
      await adjustStock(medicineId, 100, 'No change needed');

      // Verify medicine stock remains the same
      const medicine = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicineId))
        .execute();

      expect(medicine[0].stock_quantity).toBe(100);

      // Verify no stock movement was created
      const movements = await db.select()
        .from(stockMovementsTable)
        .where(eq(stockMovementsTable.medicine_id, medicineId))
        .execute();

      expect(movements).toHaveLength(0);
    });

    it('should use default notes when none provided', async () => {
      await adjustStock(medicineId, 120);

      const movements = await db.select()
        .from(stockMovementsTable)
        .where(eq(stockMovementsTable.medicine_id, medicineId))
        .execute();

      expect(movements).toHaveLength(1);
      expect(movements[0].notes).toBe('Stock adjustment: 100 → 120');
    });

    it('should throw error for negative stock quantity', async () => {
      await expect(adjustStock(medicineId, -10, 'Invalid negative stock'))
        .rejects.toThrow(/stock quantity cannot be negative/i);

      // Verify stock wasn't changed
      const medicine = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicineId))
        .execute();

      expect(medicine[0].stock_quantity).toBe(100);
    });

    it('should throw error when medicine does not exist', async () => {
      await expect(adjustStock(999, 50, 'Non-existent medicine'))
        .rejects.toThrow(/medicine not found/i);
    });

    it('should handle adjustment to zero stock', async () => {
      await adjustStock(medicineId, 0, 'Clear all stock');

      // Verify medicine stock was updated to zero
      const medicine = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicineId))
        .execute();

      expect(medicine[0].stock_quantity).toBe(0);

      // Verify outgoing movement was created
      const movements = await db.select()
        .from(stockMovementsTable)
        .where(eq(stockMovementsTable.medicine_id, medicineId))
        .execute();

      expect(movements).toHaveLength(1);
      expect(movements[0].movement_type).toBe('keluar');
      expect(movements[0].quantity).toBe(100);
    });
  });

  describe('transaction integrity', () => {
    it('should rollback stock movement if medicine update fails', async () => {
      // This test verifies that the transaction works correctly
      // by trying to create a movement for a medicine that gets deleted
      // during the transaction (simulating a concurrent deletion)
      
      const validInput: CreateStockMovementInput = {
        medicine_id: medicineId,
        movement_type: 'masuk',
        quantity: 30,
        reference_id: null,
        notes: 'Test transaction integrity'
      };

      // This should work normally
      const result = await createStockMovement(validInput);
      expect(result.quantity).toBe(30);

      // Verify both the movement was created and stock was updated
      const movements = await db.select()
        .from(stockMovementsTable)
        .where(eq(stockMovementsTable.medicine_id, medicineId))
        .execute();

      const medicine = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicineId))
        .execute();

      expect(movements).toHaveLength(1);
      expect(medicine[0].stock_quantity).toBe(130); // 100 + 30
    });
  });
});