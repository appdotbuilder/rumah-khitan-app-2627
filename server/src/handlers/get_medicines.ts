import { db } from '../db';
import { medicinesTable } from '../db/schema';
import { type Medicine, type MedicineSearchInput } from '../schema';
import { eq, lte, ilike, and, desc, SQL } from 'drizzle-orm';

export async function getMedicines(input?: MedicineSearchInput): Promise<Medicine[]> {
  try {
    const conditions: SQL<unknown>[] = [];

    // Apply filters if input is provided
    if (input) {
      // Search by name (case-insensitive)
      if (input.query) {
        conditions.push(ilike(medicinesTable.name, `%${input.query}%`));
      }

      // Filter for low stock medicines
      if (input.low_stock_only) {
        conditions.push(lte(medicinesTable.stock_quantity, medicinesTable.minimum_stock));
      }

      // Filter for expired medicines
      if (input.expired_only) {
        const today = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD
        conditions.push(lte(medicinesTable.expiry_date, today));
      }
    }

    // Build query in one step
    const baseQuery = db.select().from(medicinesTable);
    
    const whereQuery = conditions.length > 0 
      ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : baseQuery;

    const orderedQuery = whereQuery.orderBy(medicinesTable.name);

    const limitQuery = input?.limit 
      ? orderedQuery.limit(input.limit)
      : orderedQuery;

    const finalQuery = input?.offset 
      ? limitQuery.offset(input.offset)
      : limitQuery;

    const results = await finalQuery.execute();

    // Convert fields to proper types
    return results.map(medicine => ({
      ...medicine,
      price_per_unit: parseFloat(medicine.price_per_unit),
      expiry_date: medicine.expiry_date ? new Date(medicine.expiry_date) : null
    }));
  } catch (error) {
    console.error('Failed to get medicines:', error);
    throw error;
  }
}

export async function getMedicineById(id: number): Promise<Medicine | null> {
  try {
    const results = await db.select()
      .from(medicinesTable)
      .where(eq(medicinesTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const medicine = results[0];
    return {
      ...medicine,
      price_per_unit: parseFloat(medicine.price_per_unit),
      expiry_date: medicine.expiry_date ? new Date(medicine.expiry_date) : null
    };
  } catch (error) {
    console.error('Failed to get medicine by ID:', error);
    throw error;
  }
}

export async function getLowStockMedicines(): Promise<Medicine[]> {
  try {
    const results = await db.select()
      .from(medicinesTable)
      .where(lte(medicinesTable.stock_quantity, medicinesTable.minimum_stock))
      .orderBy(desc(medicinesTable.minimum_stock), medicinesTable.name)
      .execute();

    // Convert fields to proper types
    return results.map(medicine => ({
      ...medicine,
      price_per_unit: parseFloat(medicine.price_per_unit),
      expiry_date: medicine.expiry_date ? new Date(medicine.expiry_date) : null
    }));
  } catch (error) {
    console.error('Failed to get low stock medicines:', error);
    throw error;
  }
}

export async function getExpiredMedicines(): Promise<Medicine[]> {
  try {
    const today = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD
    const results = await db.select()
      .from(medicinesTable)
      .where(lte(medicinesTable.expiry_date, today))
      .orderBy(medicinesTable.expiry_date, medicinesTable.name)
      .execute();

    // Convert fields to proper types
    return results.map(medicine => ({
      ...medicine,
      price_per_unit: parseFloat(medicine.price_per_unit),
      expiry_date: medicine.expiry_date ? new Date(medicine.expiry_date) : null
    }));
  } catch (error) {
    console.error('Failed to get expired medicines:', error);
    throw error;
  }
}