import { db } from '../db';
import { servicesTable } from '../db/schema';
import { type UpdateServiceInput, type Service } from '../schema';
import { eq } from 'drizzle-orm';

export const updateService = async (input: UpdateServiceInput): Promise<Service> => {
  try {
    // Check if service exists
    const existingService = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.id, input.id))
      .execute();

    if (existingService.length === 0) {
      throw new Error('Service not found');
    }

    // Build update object with only provided fields
    const updateData: any = {};
    
    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    
    if (input.price !== undefined) {
      updateData.price = input.price.toString(); // Convert number to string for numeric column
    }
    
    if (input.is_active !== undefined) {
      updateData.is_active = input.is_active;
    }

    // Always update the updated_at timestamp
    updateData.updated_at = new Date();

    // Perform update
    const result = await db.update(servicesTable)
      .set(updateData)
      .where(eq(servicesTable.id, input.id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const service = result[0];
    return {
      ...service,
      price: parseFloat(service.price) // Convert string back to number
    };
  } catch (error) {
    console.error('Service update failed:', error);
    throw error;
  }
};