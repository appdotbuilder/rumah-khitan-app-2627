import { db } from '../db';
import { patientsTable } from '../db/schema';
import { type Patient, type PatientSearchInput } from '../schema';
import { eq, ilike, and, type SQL } from 'drizzle-orm';

export async function getPatients(input?: PatientSearchInput): Promise<Patient[]> {
  try {
    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    // Apply search filter if query is provided
    if (input?.query && input.query.trim() !== '') {
      const searchTerm = `%${input.query.trim()}%`;
      conditions.push(ilike(patientsTable.name, searchTerm));
    }

    // Apply pagination - limit and offset are guaranteed to exist due to Zod defaults
    const limit = input?.limit ?? 10;
    const offset = input?.offset ?? 0;

    // Build the complete query in one go to avoid type issues
    const baseQuery = db.select().from(patientsTable);
    
    const results = conditions.length > 0
      ? await baseQuery
          .where(and(...conditions))
          .limit(limit)
          .offset(offset)
          .execute()
      : await baseQuery
          .limit(limit)
          .offset(offset)
          .execute();

    // Convert date strings to Date objects to match schema
    return results.map(patient => ({
      ...patient,
      date_of_birth: new Date(patient.date_of_birth),
      created_at: new Date(patient.created_at),
      updated_at: new Date(patient.updated_at)
    }));
  } catch (error) {
    console.error('Failed to fetch patients:', error);
    throw error;
  }
}

export async function getPatientById(id: number): Promise<Patient | null> {
  try {
    const results = await db.select()
      .from(patientsTable)
      .where(eq(patientsTable.id, id))
      .limit(1)
      .execute();

    if (results.length === 0) {
      return null;
    }

    const patient = results[0];
    // Convert date strings to Date objects to match schema
    return {
      ...patient,
      date_of_birth: new Date(patient.date_of_birth),
      created_at: new Date(patient.created_at),
      updated_at: new Date(patient.updated_at)
    };
  } catch (error) {
    console.error('Failed to fetch patient by ID:', error);
    throw error;
  }
}