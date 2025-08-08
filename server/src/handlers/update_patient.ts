import { db } from '../db';
import { patientsTable } from '../db/schema';
import { type UpdatePatientInput, type Patient } from '../schema';
import { eq } from 'drizzle-orm';

export const updatePatient = async (input: UpdatePatientInput): Promise<Patient> => {
  try {
    // First verify the patient exists
    const existingPatient = await db.select()
      .from(patientsTable)
      .where(eq(patientsTable.id, input.id))
      .limit(1)
      .execute();

    if (existingPatient.length === 0) {
      throw new Error(`Patient with ID ${input.id} not found`);
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }

    if (input.date_of_birth !== undefined) {
      updateData.date_of_birth = input.date_of_birth.toISOString().split('T')[0];
    }

    if (input.gender !== undefined) {
      updateData.gender = input.gender;
    }

    if (input.phone !== undefined) {
      updateData.phone = input.phone;
    }

    if (input.address !== undefined) {
      updateData.address = input.address;
    }

    if (input.emergency_contact !== undefined) {
      updateData.emergency_contact = input.emergency_contact;
    }

    if (input.medical_notes !== undefined) {
      updateData.medical_notes = input.medical_notes;
    }

    // Update patient record
    const result = await db.update(patientsTable)
      .set(updateData)
      .where(eq(patientsTable.id, input.id))
      .returning()
      .execute();

    // Convert date string back to Date object for the response
    const patient = result[0];
    return {
      ...patient,
      date_of_birth: new Date(patient.date_of_birth)
    };
  } catch (error) {
    console.error('Patient update failed:', error);
    throw error;
  }
};