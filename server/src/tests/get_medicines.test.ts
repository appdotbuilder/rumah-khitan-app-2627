import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { medicinesTable } from '../db/schema';
import { type MedicineSearchInput, type CreateMedicineInput } from '../schema';
import { getMedicines, getMedicineById, getLowStockMedicines, getExpiredMedicines } from '../handlers/get_medicines';

describe('getMedicines', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test medicines
  const createTestMedicine = async (overrides: Partial<CreateMedicineInput> = {}) => {
    const defaultMedicine: CreateMedicineInput = {
      name: 'Test Medicine',
      description: 'A test medicine',
      unit: 'tablet',
      price_per_unit: 5000,
      stock_quantity: 100,
      minimum_stock: 10,
      expiry_date: new Date('2025-12-31'),
      supplier: 'Test Supplier'
    };

    const medicine = { ...defaultMedicine, ...overrides };
    
    const results = await db.insert(medicinesTable)
      .values({
        name: medicine.name,
        description: medicine.description,
        unit: medicine.unit,
        price_per_unit: medicine.price_per_unit.toString(),
        stock_quantity: medicine.stock_quantity,
        minimum_stock: medicine.minimum_stock,
        expiry_date: medicine.expiry_date?.toISOString().split('T')[0] || null,
        supplier: medicine.supplier
      })
      .returning()
      .execute();

    return results[0];
  };

  it('should return all medicines without filters', async () => {
    await createTestMedicine({ name: 'Medicine A' });
    await createTestMedicine({ name: 'Medicine B' });

    const results = await getMedicines();

    expect(results).toHaveLength(2);
    expect(results[0].name).toEqual('Medicine A');
    expect(results[1].name).toEqual('Medicine B');
    expect(typeof results[0].price_per_unit).toBe('number');
    expect(results[0].price_per_unit).toBe(5000);
  });

  it('should search medicines by name', async () => {
    await createTestMedicine({ name: 'Paracetamol' });
    await createTestMedicine({ name: 'Ibuprofen' });
    await createTestMedicine({ name: 'Paracetamol Extra' });

    const input: MedicineSearchInput = {
      query: 'para',
      limit: 10,
      offset: 0,
      low_stock_only: false,
      expired_only: false
    };

    const results = await getMedicines(input);

    // Should match both medicines containing "para"
    expect(results).toHaveLength(2);
    const names = results.map(r => r.name).sort();
    expect(names).toEqual(['Paracetamol', 'Paracetamol Extra']);
    
    // Verify no Ibuprofen in results
    expect(results.some(r => r.name === 'Ibuprofen')).toBe(false);
  });

  it('should filter low stock medicines', async () => {
    await createTestMedicine({ 
      name: 'Low Stock Medicine', 
      stock_quantity: 5, 
      minimum_stock: 10 
    });
    await createTestMedicine({ 
      name: 'Normal Stock Medicine', 
      stock_quantity: 50, 
      minimum_stock: 10 
    });

    const input: MedicineSearchInput = {
      low_stock_only: true,
      limit: 10,
      offset: 0,
      expired_only: false
    };

    const results = await getMedicines(input);

    expect(results).toHaveLength(1);
    expect(results[0].name).toEqual('Low Stock Medicine');
    expect(results[0].stock_quantity).toBe(5);
    expect(results[0].minimum_stock).toBe(10);
  });

  it('should filter expired medicines', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await createTestMedicine({ 
      name: 'Expired Medicine', 
      expiry_date: yesterday
    });
    await createTestMedicine({ 
      name: 'Valid Medicine', 
      expiry_date: tomorrow
    });

    const input: MedicineSearchInput = {
      expired_only: true,
      limit: 10,
      offset: 0,
      low_stock_only: false
    };

    const results = await getMedicines(input);

    expect(results).toHaveLength(1);
    expect(results[0].name).toEqual('Expired Medicine');
  });

  it('should apply pagination', async () => {
    await createTestMedicine({ name: 'Medicine 1' });
    await createTestMedicine({ name: 'Medicine 2' });
    await createTestMedicine({ name: 'Medicine 3' });

    const input: MedicineSearchInput = {
      limit: 2,
      offset: 1,
      low_stock_only: false,
      expired_only: false
    };

    const results = await getMedicines(input);

    expect(results).toHaveLength(2);
    expect(results[0].name).toEqual('Medicine 2');
    expect(results[1].name).toEqual('Medicine 3');
  });

  it('should combine multiple filters', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await createTestMedicine({ 
      name: 'Expired Low Stock Paracetamol',
      stock_quantity: 3,
      minimum_stock: 10,
      expiry_date: yesterday
    });
    await createTestMedicine({ 
      name: 'Valid High Stock Paracetamol',
      stock_quantity: 50,
      minimum_stock: 10,
      expiry_date: new Date('2025-12-31')
    });

    const input: MedicineSearchInput = {
      query: 'paracetamol',
      low_stock_only: true,
      expired_only: true,
      limit: 10,
      offset: 0
    };

    const results = await getMedicines(input);

    expect(results).toHaveLength(1);
    expect(results[0].name).toEqual('Expired Low Stock Paracetamol');
  });
});

describe('getMedicineById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return medicine by ID', async () => {
    const created = await db.insert(medicinesTable)
      .values({
        name: 'Test Medicine',
        description: 'Test description',
        unit: 'tablet',
        price_per_unit: '7500',
        stock_quantity: 25,
        minimum_stock: 5,
        expiry_date: '2025-06-30',
        supplier: 'Test Supplier'
      })
      .returning()
      .execute();

    const result = await getMedicineById(created[0].id);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(created[0].id);
    expect(result!.name).toEqual('Test Medicine');
    expect(result!.description).toEqual('Test description');
    expect(typeof result!.price_per_unit).toBe('number');
    expect(result!.price_per_unit).toBe(7500);
    expect(result!.stock_quantity).toBe(25);
  });

  it('should return null for non-existent medicine', async () => {
    const result = await getMedicineById(999);

    expect(result).toBeNull();
  });
});

describe('getLowStockMedicines', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return medicines with low stock', async () => {
    await db.insert(medicinesTable)
      .values([
        {
          name: 'Low Stock Medicine 1',
          unit: 'tablet',
          price_per_unit: '1000',
          stock_quantity: 5,
          minimum_stock: 10,
          description: null,
          expiry_date: null,
          supplier: null
        },
        {
          name: 'Low Stock Medicine 2',
          unit: 'bottle',
          price_per_unit: '15000',
          stock_quantity: 2,
          minimum_stock: 5,
          description: null,
          expiry_date: null,
          supplier: null
        },
        {
          name: 'Normal Stock Medicine',
          unit: 'tablet',
          price_per_unit: '2000',
          stock_quantity: 50,
          minimum_stock: 10,
          description: null,
          expiry_date: null,
          supplier: null
        }
      ])
      .execute();

    const results = await getLowStockMedicines();

    expect(results).toHaveLength(2);
    expect(results.some(m => m.name === 'Low Stock Medicine 1')).toBe(true);
    expect(results.some(m => m.name === 'Low Stock Medicine 2')).toBe(true);
    expect(results.some(m => m.name === 'Normal Stock Medicine')).toBe(false);
    
    // Verify numeric conversion
    results.forEach(medicine => {
      expect(typeof medicine.price_per_unit).toBe('number');
    });
  });

  it('should return empty array when no low stock medicines exist', async () => {
    await db.insert(medicinesTable)
      .values({
        name: 'High Stock Medicine',
        unit: 'tablet',
        price_per_unit: '5000',
        stock_quantity: 100,
        minimum_stock: 10,
        description: null,
        expiry_date: null,
        supplier: null
      })
      .execute();

    const results = await getLowStockMedicines();

    expect(results).toHaveLength(0);
  });
});

describe('getExpiredMedicines', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return expired medicines', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await db.insert(medicinesTable)
      .values([
        {
          name: 'Expired Medicine 1',
          unit: 'tablet',
          price_per_unit: '3000',
          stock_quantity: 20,
          minimum_stock: 5,
          expiry_date: yesterday.toISOString().split('T')[0],
          description: null,
          supplier: null
        },
        {
          name: 'Valid Medicine',
          unit: 'bottle',
          price_per_unit: '8000',
          stock_quantity: 15,
          minimum_stock: 3,
          expiry_date: tomorrow.toISOString().split('T')[0],
          description: null,
          supplier: null
        }
      ])
      .execute();

    const results = await getExpiredMedicines();

    expect(results).toHaveLength(1);
    expect(results[0].name).toEqual('Expired Medicine 1');
    expect(results[0].expiry_date!.toDateString()).toEqual(yesterday.toDateString());
    expect(typeof results[0].price_per_unit).toBe('number');
    expect(results[0].price_per_unit).toBe(3000);
  });

  it('should return medicines expiring today', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of day

    await db.insert(medicinesTable)
      .values({
        name: 'Expiring Today',
        unit: 'tablet',
        price_per_unit: '2500',
        stock_quantity: 10,
        minimum_stock: 2,
        expiry_date: today.toISOString().split('T')[0],
        description: null,
        supplier: null
      })
      .execute();

    const results = await getExpiredMedicines();

    expect(results).toHaveLength(1);
    expect(results[0].name).toEqual('Expiring Today');
  });

  it('should return empty array when no expired medicines exist', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await db.insert(medicinesTable)
      .values({
        name: 'Future Medicine',
        unit: 'tablet',
        price_per_unit: '4000',
        stock_quantity: 30,
        minimum_stock: 5,
        expiry_date: tomorrow.toISOString().split('T')[0],
        description: null,
        supplier: null
      })
      .execute();

    const results = await getExpiredMedicines();

    expect(results).toHaveLength(0);
  });
});