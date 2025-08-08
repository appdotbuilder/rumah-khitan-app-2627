import { db } from '../db';
import { medicinesTable } from '../db/schema';
import { type CreateMedicineInput, type Medicine } from '../schema';

export const createMedicine = async (input: CreateMedicineInput): Promise<Medicine> => {
  try {
    // Insert medicine record
    const result = await db.insert(medicinesTable)
      .values({
        name: input.name,
        description: input.description,
        unit: input.unit,
        price_per_unit: input.price_per_unit.toString(), // Convert number to string for numeric column
        stock_quantity: input.stock_quantity,
        minimum_stock: input.minimum_stock,
        expiry_date: input.expiry_date ? input.expiry_date.toISOString().split('T')[0] : null, // Convert Date to YYYY-MM-DD string
        supplier: input.supplier
      })
      .returning()
      .execute();

    // Convert numeric and date fields back to proper types before returning
    const medicine = result[0];
    return {
      ...medicine,
      price_per_unit: parseFloat(medicine.price_per_unit), // Convert string back to number
      expiry_date: medicine.expiry_date ? new Date(medicine.expiry_date) : null // Convert string back to Date
    };
  } catch (error) {
    console.error('Medicine creation failed:', error);
    throw error;
  }
};