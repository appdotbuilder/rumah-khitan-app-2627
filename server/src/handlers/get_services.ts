import { db } from '../db';
import { servicesTable } from '../db/schema';
import { type Service } from '../schema';
import { eq } from 'drizzle-orm';

export async function getServices(activeOnly: boolean = false): Promise<Service[]> {
  try {
    const results = activeOnly
      ? await db.select()
          .from(servicesTable)
          .where(eq(servicesTable.is_active, true))
          .execute()
      : await db.select()
          .from(servicesTable)
          .execute();

    // Convert numeric fields back to numbers
    return results.map(service => ({
      ...service,
      price: parseFloat(service.price)
    }));
  } catch (error) {
    console.error('Get services failed:', error);
    throw error;
  }
}

export async function getServiceById(id: number): Promise<Service | null> {
  try {
    const results = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const service = results[0];
    return {
      ...service,
      price: parseFloat(service.price)
    };
  } catch (error) {
    console.error('Get service by ID failed:', error);
    throw error;
  }
}