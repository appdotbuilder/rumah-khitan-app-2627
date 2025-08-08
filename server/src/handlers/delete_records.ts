import { db } from '../db';
import { 
  patientsTable, 
  medicinesTable, 
  servicesTable, 
  transactionsTable,
  transactionServicesTable,
  transactionMedicinesTable,
  patientVisitsTable,
  stockMovementsTable
} from '../db/schema';
import { eq, and } from 'drizzle-orm';

export async function deletePatient(id: number): Promise<boolean> {
  try {
    // Check if patient exists
    const patient = await db.select()
      .from(patientsTable)
      .where(eq(patientsTable.id, id))
      .execute();

    if (patient.length === 0) {
      return false;
    }

    // Check for associated transactions
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.patient_id, id))
      .execute();

    if (transactions.length > 0) {
      // Prevent deletion if patient has transactions
      return false;
    }

    // Check for associated visits
    const visits = await db.select()
      .from(patientVisitsTable)
      .where(eq(patientVisitsTable.patient_id, id))
      .execute();

    if (visits.length > 0) {
      // Prevent deletion if patient has visits
      return false;
    }

    // Safe to delete patient
    await db.delete(patientsTable)
      .where(eq(patientsTable.id, id))
      .execute();

    return true;
  } catch (error) {
    console.error('Patient deletion failed:', error);
    throw error;
  }
}

export async function deleteMedicine(id: number): Promise<boolean> {
  try {
    // Check if medicine exists
    const medicine = await db.select()
      .from(medicinesTable)
      .where(eq(medicinesTable.id, id))
      .execute();

    if (medicine.length === 0) {
      return false;
    }

    // Check if medicine has been used in transactions
    const transactionMedicines = await db.select()
      .from(transactionMedicinesTable)
      .where(eq(transactionMedicinesTable.medicine_id, id))
      .execute();

    if (transactionMedicines.length > 0) {
      // Prevent deletion if medicine has been used in transactions
      return false;
    }

    // Check for stock movements
    const stockMovements = await db.select()
      .from(stockMovementsTable)
      .where(eq(stockMovementsTable.medicine_id, id))
      .execute();

    if (stockMovements.length > 0) {
      // Delete stock movements first
      await db.delete(stockMovementsTable)
        .where(eq(stockMovementsTable.medicine_id, id))
        .execute();
    }

    // Safe to delete medicine
    await db.delete(medicinesTable)
      .where(eq(medicinesTable.id, id))
      .execute();

    return true;
  } catch (error) {
    console.error('Medicine deletion failed:', error);
    throw error;
  }
}

export async function deleteService(id: number): Promise<boolean> {
  try {
    // Check if service exists
    const service = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.id, id))
      .execute();

    if (service.length === 0) {
      return false;
    }

    // Check if service has been used in transactions
    const transactionServices = await db.select()
      .from(transactionServicesTable)
      .where(eq(transactionServicesTable.service_id, id))
      .execute();

    if (transactionServices.length > 0) {
      // If service has been used, deactivate instead of deleting
      await db.update(servicesTable)
        .set({ 
          is_active: false,
          updated_at: new Date()
        })
        .where(eq(servicesTable.id, id))
        .execute();

      return true;
    }

    // Safe to delete service (no transaction history)
    await db.delete(servicesTable)
      .where(eq(servicesTable.id, id))
      .execute();

    return true;
  } catch (error) {
    console.error('Service deletion failed:', error);
    throw error;
  }
}

export async function deleteTransaction(id: number): Promise<boolean> {
  try {
    // Check if transaction exists
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, id))
      .execute();

    if (transactions.length === 0) {
      return false;
    }

    const transaction = transactions[0];

    // Only allow deletion of cancelled or pending transactions
    if (transaction.payment_status === 'paid') {
      return false;
    }

    // If transaction has medicines and was paid, we would restore stock
    // But since we only delete cancelled/pending, no stock restoration needed
    
    // Delete related transaction services
    await db.delete(transactionServicesTable)
      .where(eq(transactionServicesTable.transaction_id, id))
      .execute();

    // Delete related transaction medicines
    await db.delete(transactionMedicinesTable)
      .where(eq(transactionMedicinesTable.transaction_id, id))
      .execute();

    // Delete related stock movements (if any reference this transaction)
    await db.delete(stockMovementsTable)
      .where(eq(stockMovementsTable.reference_id, id))
      .execute();

    // Delete related patient visits (if any reference this transaction)
    await db.update(patientVisitsTable)
      .set({ transaction_id: null })
      .where(eq(patientVisitsTable.transaction_id, id))
      .execute();

    // Finally delete the transaction
    await db.delete(transactionsTable)
      .where(eq(transactionsTable.id, id))
      .execute();

    return true;
  } catch (error) {
    console.error('Transaction deletion failed:', error);
    throw error;
  }
}