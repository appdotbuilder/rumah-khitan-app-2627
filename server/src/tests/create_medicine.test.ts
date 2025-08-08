import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { medicinesTable } from '../db/schema';
import { type CreateMedicineInput } from '../schema';
import { createMedicine } from '../handlers/create_medicine';
import { eq } from 'drizzle-orm';

// Complete test input with all required fields
const testInput: CreateMedicineInput = {
  name: 'Paracetamol',
  description: 'Pain relief medication',
  unit: 'tablet',
  price_per_unit: 2500.50,
  stock_quantity: 100,
  minimum_stock: 20,
  expiry_date: new Date('2025-12-31'),
  supplier: 'PT Kimia Farma'
};

describe('createMedicine', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a medicine with all fields', async () => {
    const result = await createMedicine(testInput);

    // Basic field validation
    expect(result.name).toEqual('Paracetamol');
    expect(result.description).toEqual('Pain relief medication');
    expect(result.unit).toEqual('tablet');
    expect(result.price_per_unit).toEqual(2500.50);
    expect(typeof result.price_per_unit).toBe('number');
    expect(result.stock_quantity).toEqual(100);
    expect(result.minimum_stock).toEqual(20);
    expect(result.expiry_date).toEqual(new Date('2025-12-31'));
    expect(result.supplier).toEqual('PT Kimia Farma');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a medicine with minimal fields', async () => {
    const minimalInput: CreateMedicineInput = {
      name: 'Aspirin',
      description: null,
      unit: 'strip',
      price_per_unit: 5000,
      stock_quantity: 50,
      minimum_stock: 10,
      expiry_date: null,
      supplier: null
    };

    const result = await createMedicine(minimalInput);

    expect(result.name).toEqual('Aspirin');
    expect(result.description).toBeNull();
    expect(result.unit).toEqual('strip');
    expect(result.price_per_unit).toEqual(5000);
    expect(result.stock_quantity).toEqual(50);
    expect(result.minimum_stock).toEqual(10);
    expect(result.expiry_date).toBeNull();
    expect(result.supplier).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save medicine to database correctly', async () => {
    const result = await createMedicine(testInput);

    // Query using proper drizzle syntax
    const medicines = await db.select()
      .from(medicinesTable)
      .where(eq(medicinesTable.id, result.id))
      .execute();

    expect(medicines).toHaveLength(1);
    const savedMedicine = medicines[0];
    
    expect(savedMedicine.name).toEqual('Paracetamol');
    expect(savedMedicine.description).toEqual('Pain relief medication');
    expect(savedMedicine.unit).toEqual('tablet');
    expect(parseFloat(savedMedicine.price_per_unit)).toEqual(2500.50);
    expect(savedMedicine.stock_quantity).toEqual(100);
    expect(savedMedicine.minimum_stock).toEqual(20);
    expect(new Date(savedMedicine.expiry_date!)).toEqual(new Date('2025-12-31'));
    expect(savedMedicine.supplier).toEqual('PT Kimia Farma');
    expect(savedMedicine.created_at).toBeInstanceOf(Date);
    expect(savedMedicine.updated_at).toBeInstanceOf(Date);
  });

  it('should handle decimal prices correctly', async () => {
    const decimalPriceInput: CreateMedicineInput = {
      name: 'Expensive Medicine',
      description: 'High precision pricing test',
      unit: 'vial',
      price_per_unit: 125000.99,
      stock_quantity: 5,
      minimum_stock: 2,
      expiry_date: new Date('2024-06-15'),
      supplier: 'Premium Supplier'
    };

    const result = await createMedicine(decimalPriceInput);

    // Verify numeric conversion maintains precision
    expect(result.price_per_unit).toEqual(125000.99);
    expect(typeof result.price_per_unit).toBe('number');

    // Verify database storage
    const medicines = await db.select()
      .from(medicinesTable)
      .where(eq(medicinesTable.id, result.id))
      .execute();

    expect(parseFloat(medicines[0].price_per_unit)).toEqual(125000.99);
  });

  it('should handle zero stock quantities', async () => {
    const zeroStockInput: CreateMedicineInput = {
      name: 'Out of Stock Medicine',
      description: 'Testing zero stock handling',
      unit: 'box',
      price_per_unit: 15000,
      stock_quantity: 0,
      minimum_stock: 0,
      expiry_date: null,
      supplier: null
    };

    const result = await createMedicine(zeroStockInput);

    expect(result.stock_quantity).toEqual(0);
    expect(result.minimum_stock).toEqual(0);
  });

  it('should create multiple medicines independently', async () => {
    const medicine1Input: CreateMedicineInput = {
      name: 'Medicine One',
      description: 'First medicine',
      unit: 'tablet',
      price_per_unit: 1000,
      stock_quantity: 50,
      minimum_stock: 10,
      expiry_date: new Date('2025-01-01'),
      supplier: 'Supplier A'
    };

    const medicine2Input: CreateMedicineInput = {
      name: 'Medicine Two',
      description: 'Second medicine',
      unit: 'capsule',
      price_per_unit: 2000,
      stock_quantity: 30,
      minimum_stock: 5,
      expiry_date: new Date('2025-02-01'),
      supplier: 'Supplier B'
    };

    const result1 = await createMedicine(medicine1Input);
    const result2 = await createMedicine(medicine2Input);

    // Verify both medicines were created with unique IDs
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.name).toEqual('Medicine One');
    expect(result2.name).toEqual('Medicine Two');

    // Verify both exist in database
    const allMedicines = await db.select().from(medicinesTable).execute();
    expect(allMedicines).toHaveLength(2);
  });
});