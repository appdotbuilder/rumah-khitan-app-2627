import { db } from '../db';
import { patientVisitsTable, patientsTable, transactionsTable } from '../db/schema';
import { type CreatePatientVisitInput, type PatientVisit } from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function createPatientVisit(input: CreatePatientVisitInput): Promise<PatientVisit> {
  try {
    // Verify patient exists
    const patient = await db.select()
      .from(patientsTable)
      .where(eq(patientsTable.id, input.patient_id))
      .execute();

    if (patient.length === 0) {
      throw new Error(`Patient with ID ${input.patient_id} not found`);
    }

    // Verify transaction exists if provided
    if (input.transaction_id) {
      const transaction = await db.select()
        .from(transactionsTable)
        .where(eq(transactionsTable.id, input.transaction_id))
        .execute();

      if (transaction.length === 0) {
        throw new Error(`Transaction with ID ${input.transaction_id} not found`);
      }
    }

    // Create patient visit record
    const result = await db.insert(patientVisitsTable)
      .values({
        patient_id: input.patient_id,
        transaction_id: input.transaction_id,
        visit_date: input.visit_date,
        diagnosis: input.diagnosis,
        treatment: input.treatment,
        notes: input.notes
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Patient visit creation failed:', error);
    throw error;
  }
}

export async function getPatientVisits(patientId: number): Promise<PatientVisit[]> {
  try {
    // Verify patient exists
    const patient = await db.select()
      .from(patientsTable)
      .where(eq(patientsTable.id, patientId))
      .execute();

    if (patient.length === 0) {
      throw new Error(`Patient with ID ${patientId} not found`);
    }

    // Fetch patient visits ordered by visit date (newest first)
    const visits = await db.select()
      .from(patientVisitsTable)
      .where(eq(patientVisitsTable.patient_id, patientId))
      .orderBy(desc(patientVisitsTable.visit_date))
      .execute();

    return visits;
  } catch (error) {
    console.error('Failed to fetch patient visits:', error);
    throw error;
  }
}

export async function getVisitById(id: number): Promise<PatientVisit | null> {
  try {
    const visits = await db.select()
      .from(patientVisitsTable)
      .where(eq(patientVisitsTable.id, id))
      .execute();

    return visits.length > 0 ? visits[0] : null;
  } catch (error) {
    console.error('Failed to fetch visit by ID:', error);
    throw error;
  }
}

export async function updatePatientVisit(id: number, diagnosis?: string | null, treatment?: string | null, notes?: string | null): Promise<PatientVisit> {
  try {
    // Check if visit exists
    const existingVisit = await getVisitById(id);
    if (!existingVisit) {
      throw new Error(`Patient visit with ID ${id} not found`);
    }

    // Build update object with only provided fields
    const updateData: any = {};
    if (diagnosis !== undefined) updateData.diagnosis = diagnosis;
    if (treatment !== undefined) updateData.treatment = treatment;
    if (notes !== undefined) updateData.notes = notes;

    // If no fields to update, return existing visit
    if (Object.keys(updateData).length === 0) {
      return existingVisit;
    }

    // Update patient visit record
    const result = await db.update(patientVisitsTable)
      .set(updateData)
      .where(eq(patientVisitsTable.id, id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Patient visit update failed:', error);
    throw error;
  }
}