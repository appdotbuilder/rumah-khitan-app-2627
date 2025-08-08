import { db } from '../db';
import { stockMovementsTable, medicinesTable } from '../db/schema';
import { type CreateStockMovementInput, type StockMovement } from '../schema';
import { eq, desc, sql } from 'drizzle-orm';

export async function createStockMovement(input: CreateStockMovementInput): Promise<StockMovement> {
  try {
    // Start a transaction to ensure data consistency
    const result = await db.transaction(async (tx) => {
      // First, verify the medicine exists
      const medicine = await tx.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, input.medicine_id))
        .execute();

      if (medicine.length === 0) {
        throw new Error('Medicine not found');
      }

      const currentMedicine = medicine[0];

      // Calculate new stock quantity
      let newStockQuantity: number;
      if (input.movement_type === 'masuk') {
        newStockQuantity = currentMedicine.stock_quantity + input.quantity;
      } else { // 'keluar'
        newStockQuantity = currentMedicine.stock_quantity - input.quantity;
        
        // Check if there's enough stock for outgoing movement
        if (newStockQuantity < 0) {
          throw new Error('Insufficient stock for this operation');
        }
      }

      // Update medicine stock quantity
      await tx.update(medicinesTable)
        .set({ 
          stock_quantity: newStockQuantity,
          updated_at: new Date()
        })
        .where(eq(medicinesTable.id, input.medicine_id))
        .execute();

      // Create stock movement record
      const stockMovementResult = await tx.insert(stockMovementsTable)
        .values({
          medicine_id: input.medicine_id,
          movement_type: input.movement_type,
          quantity: input.quantity,
          reference_id: input.reference_id,
          notes: input.notes
        })
        .returning()
        .execute();

      return stockMovementResult[0];
    });

    return result;
  } catch (error) {
    console.error('Stock movement creation failed:', error);
    throw error;
  }
}

export async function getStockMovements(medicineId?: number): Promise<StockMovement[]> {
  try {
    // Build the complete query at once to avoid type issues
    const query = medicineId !== undefined
      ? db.select()
          .from(stockMovementsTable)
          .where(eq(stockMovementsTable.medicine_id, medicineId))
          .orderBy(desc(stockMovementsTable.created_at))
      : db.select()
          .from(stockMovementsTable)
          .orderBy(desc(stockMovementsTable.created_at));

    const results = await query.execute();
    return results;
  } catch (error) {
    console.error('Failed to fetch stock movements:', error);
    throw error;
  }
}

export async function adjustStock(medicineId: number, newQuantity: number, notes?: string): Promise<void> {
  try {
    // Start a transaction to ensure data consistency
    await db.transaction(async (tx) => {
      // First, verify the medicine exists and get current stock
      const medicine = await tx.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicineId))
        .execute();

      if (medicine.length === 0) {
        throw new Error('Medicine not found');
      }

      const currentMedicine = medicine[0];
      const currentStock = currentMedicine.stock_quantity;
      
      // Validate new quantity is not negative
      if (newQuantity < 0) {
        throw new Error('Stock quantity cannot be negative');
      }

      // Calculate the difference
      const difference = newQuantity - currentStock;

      // Only create movement record and update if there's a difference
      if (difference !== 0) {
        // Determine movement type based on difference
        const movementType = difference > 0 ? 'masuk' : 'keluar';
        const quantity = Math.abs(difference);

        // Update medicine stock quantity
        await tx.update(medicinesTable)
          .set({ 
            stock_quantity: newQuantity,
            updated_at: new Date()
          })
          .where(eq(medicinesTable.id, medicineId))
          .execute();

        // Create stock movement record for the adjustment
        await tx.insert(stockMovementsTable)
          .values({
            medicine_id: medicineId,
            movement_type: movementType,
            quantity: quantity,
            reference_id: null, // No reference for manual adjustments
            notes: notes || `Stock adjustment: ${currentStock} → ${newQuantity}`
          })
          .execute();
      }
    });
  } catch (error) {
    console.error('Stock adjustment failed:', error);
    throw error;
  }
}