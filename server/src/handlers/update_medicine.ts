import { db } from '../db';
import { medicinesTable, stockMovementsTable } from '../db/schema';
import { type UpdateMedicineInput, type Medicine } from '../schema';
import { eq } from 'drizzle-orm';

export async function updateMedicine(input: UpdateMedicineInput): Promise<Medicine> {
  try {
    // First, get the current medicine record to check stock changes
    const existingMedicine = await db.select()
      .from(medicinesTable)
      .where(eq(medicinesTable.id, input.id))
      .execute();

    if (existingMedicine.length === 0) {
      throw new Error(`Medicine with id ${input.id} not found`);
    }

    const currentMedicine = existingMedicine[0];
    const currentStock = currentMedicine.stock_quantity;

    // Prepare update data with proper type conversions
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.unit !== undefined) updateData.unit = input.unit;
    if (input.price_per_unit !== undefined) updateData.price_per_unit = input.price_per_unit.toString();
    if (input.stock_quantity !== undefined) updateData.stock_quantity = input.stock_quantity;
    if (input.minimum_stock !== undefined) updateData.minimum_stock = input.minimum_stock;
    if (input.expiry_date !== undefined) {
      // Convert Date to string for database storage (date column expects string)
      updateData.expiry_date = input.expiry_date ? input.expiry_date.toISOString().split('T')[0] : null;
    }
    if (input.supplier !== undefined) updateData.supplier = input.supplier;

    // Update the medicine record
    const result = await db.update(medicinesTable)
      .set(updateData)
      .where(eq(medicinesTable.id, input.id))
      .returning()
      .execute();

    const updatedMedicine = result[0];

    // If stock quantity was updated, create a stock movement record
    if (input.stock_quantity !== undefined && input.stock_quantity !== currentStock) {
      const stockDifference = input.stock_quantity - currentStock;
      const movementType = stockDifference > 0 ? 'masuk' : 'keluar';
      const quantity = Math.abs(stockDifference);

      await db.insert(stockMovementsTable)
        .values({
          medicine_id: input.id,
          movement_type: movementType,
          quantity: quantity,
          reference_id: null,
          notes: 'Stock adjustment via medicine update'
        })
        .execute();
    }

    // Convert fields back to proper types before returning
    return {
      ...updatedMedicine,
      price_per_unit: parseFloat(updatedMedicine.price_per_unit),
      expiry_date: updatedMedicine.expiry_date ? new Date(updatedMedicine.expiry_date) : null
    };
  } catch (error) {
    console.error('Medicine update failed:', error);
    throw error;
  }
}