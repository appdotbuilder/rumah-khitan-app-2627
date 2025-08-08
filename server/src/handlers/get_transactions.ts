import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { type Transaction, type TransactionSearchInput } from '../schema';
import { eq, and, gte, lte, desc, SQL } from 'drizzle-orm';

export async function getTransactions(input?: TransactionSearchInput): Promise<Transaction[]> {
  try {
    // Apply default values if input is provided but fields are undefined
    const filters = input ? {
      patient_id: input.patient_id,
      payment_status: input.payment_status,
      start_date: input.start_date,
      end_date: input.end_date,
      limit: input.limit,
      offset: input.offset
    } : {
      limit: 10,
      offset: 0
    };

    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    if (filters.patient_id !== undefined) {
      conditions.push(eq(transactionsTable.patient_id, filters.patient_id));
    }

    if (filters.payment_status !== undefined) {
      conditions.push(eq(transactionsTable.payment_status, filters.payment_status));
    }

    if (filters.start_date !== undefined) {
      conditions.push(gte(transactionsTable.created_at, filters.start_date));
    }

    if (filters.end_date !== undefined) {
      conditions.push(lte(transactionsTable.created_at, filters.end_date));
    }

    // Build the query step by step
    const baseQuery = db.select().from(transactionsTable);
    
    const queryWithConditions = conditions.length > 0
      ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : baseQuery;

    // Apply ordering and pagination
    const results = await queryWithConditions
      .orderBy(desc(transactionsTable.created_at))
      .limit(filters.limit)
      .offset(filters.offset)
      .execute();

    // Convert numeric fields back to numbers
    return results.map(transaction => ({
      ...transaction,
      total_amount: parseFloat(transaction.total_amount)
    }));
  } catch (error) {
    console.error('Failed to get transactions:', error);
    throw error;
  }
}

export async function getTransactionById(id: number): Promise<Transaction | null> {
  try {
    const results = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const transaction = results[0];
    return {
      ...transaction,
      total_amount: parseFloat(transaction.total_amount)
    };
  } catch (error) {
    console.error('Failed to get transaction by ID:', error);
    throw error;
  }
}

export async function getTodayTransactions(): Promise<Transaction[]> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const results = await db.select()
      .from(transactionsTable)
      .where(and(
        gte(transactionsTable.created_at, today),
        lte(transactionsTable.created_at, tomorrow)
      ))
      .orderBy(desc(transactionsTable.created_at))
      .execute();

    // Convert numeric fields back to numbers
    return results.map(transaction => ({
      ...transaction,
      total_amount: parseFloat(transaction.total_amount)
    }));
  } catch (error) {
    console.error('Failed to get today transactions:', error);
    throw error;
  }
}

export async function getPendingTransactions(): Promise<Transaction[]> {
  try {
    const results = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.payment_status, 'pending'))
      .orderBy(desc(transactionsTable.created_at))
      .execute();

    // Convert numeric fields back to numbers
    return results.map(transaction => ({
      ...transaction,
      total_amount: parseFloat(transaction.total_amount)
    }));
  } catch (error) {
    console.error('Failed to get pending transactions:', error);
    throw error;
  }
}