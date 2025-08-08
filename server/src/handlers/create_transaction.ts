import { db } from '../db';
import { 
  transactionsTable, 
  transactionServicesTable, 
  transactionMedicinesTable,
  stockMovementsTable,
  medicinesTable,
  servicesTable,
  patientsTable,
  patientVisitsTable
} from '../db/schema';
import { type CreateTransactionInput, type Transaction } from '../schema';
import { eq, sql } from 'drizzle-orm';

export const createTransaction = async (input: CreateTransactionInput): Promise<Transaction> => {
  try {
    // Use database transaction to ensure atomicity
    return await db.transaction(async (tx) => {
      // 1. Verify patient exists
      const patient = await tx.select()
        .from(patientsTable)
        .where(eq(patientsTable.id, input.patient_id))
        .execute();
      
      if (patient.length === 0) {
        throw new Error(`Patient with ID ${input.patient_id} not found`);
      }

      // 2. Fetch service details and calculate service total
      let serviceTotal = 0;
      for (const serviceItem of input.services) {
        const service = await tx.select()
          .from(servicesTable)
          .where(eq(servicesTable.id, serviceItem.service_id))
          .execute();
        
        if (service.length === 0) {
          throw new Error(`Service with ID ${serviceItem.service_id} not found`);
        }

        if (!service[0].is_active) {
          throw new Error(`Service ${service[0].name} is not active`);
        }

        const servicePrice = parseFloat(service[0].price);
        serviceTotal += servicePrice * serviceItem.quantity;
      }

      // 3. Fetch medicine details and calculate medicine total
      let medicineTotal = 0;
      if (input.medicines && input.medicines.length > 0) {
        for (const medicineItem of input.medicines) {
          const medicine = await tx.select()
            .from(medicinesTable)
            .where(eq(medicinesTable.id, medicineItem.medicine_id))
            .execute();
          
          if (medicine.length === 0) {
            throw new Error(`Medicine with ID ${medicineItem.medicine_id} not found`);
          }

          if (medicine[0].stock_quantity < medicineItem.quantity) {
            throw new Error(`Insufficient stock for ${medicine[0].name}. Available: ${medicine[0].stock_quantity}, Required: ${medicineItem.quantity}`);
          }

          const medicinePrice = parseFloat(medicine[0].price_per_unit);
          medicineTotal += medicinePrice * medicineItem.quantity;
        }
      }

      // 4. Calculate total amount
      const totalAmount = serviceTotal + medicineTotal;

      // 5. Create main transaction record
      const transactionResult = await tx.insert(transactionsTable)
        .values({
          patient_id: input.patient_id,
          total_amount: totalAmount.toString(),
          payment_method: input.payment_method,
          payment_status: input.payment_status,
          notes: input.notes
        })
        .returning()
        .execute();

      const transaction = transactionResult[0];

      // 6. Create transaction services records
      for (const serviceItem of input.services) {
        const service = await tx.select()
          .from(servicesTable)
          .where(eq(servicesTable.id, serviceItem.service_id))
          .execute();

        const servicePrice = parseFloat(service[0].price);
        const totalPrice = servicePrice * serviceItem.quantity;

        await tx.insert(transactionServicesTable)
          .values({
            transaction_id: transaction.id,
            service_id: serviceItem.service_id,
            quantity: serviceItem.quantity,
            price_per_unit: servicePrice.toString(),
            total_price: totalPrice.toString()
          })
          .execute();
      }

      // 7. Create transaction medicines records and update stock
      if (input.medicines && input.medicines.length > 0) {
        for (const medicineItem of input.medicines) {
          const medicine = await tx.select()
            .from(medicinesTable)
            .where(eq(medicinesTable.id, medicineItem.medicine_id))
            .execute();

          const medicinePrice = parseFloat(medicine[0].price_per_unit);
          const totalPrice = medicinePrice * medicineItem.quantity;

          // Create transaction medicine record
          await tx.insert(transactionMedicinesTable)
            .values({
              transaction_id: transaction.id,
              medicine_id: medicineItem.medicine_id,
              quantity: medicineItem.quantity,
              price_per_unit: medicinePrice.toString(),
              total_price: totalPrice.toString()
            })
            .execute();

          // Update medicine stock
          await tx.update(medicinesTable)
            .set({
              stock_quantity: sql`${medicinesTable.stock_quantity} - ${medicineItem.quantity}`,
              updated_at: new Date()
            })
            .where(eq(medicinesTable.id, medicineItem.medicine_id))
            .execute();

          // Create stock movement record
          await tx.insert(stockMovementsTable)
            .values({
              medicine_id: medicineItem.medicine_id,
              movement_type: 'keluar',
              quantity: medicineItem.quantity,
              reference_id: transaction.id,
              notes: `Medicine used in transaction #${transaction.id}`
            })
            .execute();
        }
      }

      // 8. Create patient visit record
      await tx.insert(patientVisitsTable)
        .values({
          patient_id: input.patient_id,
          transaction_id: transaction.id,
          notes: `Transaction #${transaction.id} - ${input.services.length} service(s)${input.medicines ? `, ${input.medicines.length} medicine(s)` : ''}`
        })
        .execute();

      // Return the transaction with converted numeric fields
      return {
        ...transaction,
        total_amount: parseFloat(transaction.total_amount)
      };
    });
  } catch (error) {
    console.error('Transaction creation failed:', error);
    throw error;
  }
};