import { db } from '../db';
import { patientsTable } from '../db/schema';
import { type CreatePatientInput, type Patient } from '../schema';

export const createPatient = async (input: CreatePatientInput): Promise<Patient> => {
  try {
    // Convert date to string format for database storage
    const dateString = input.date_of_birth.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Insert patient record
    const result = await db.insert(patientsTable)
      .values({
        name: input.name,
        date_of_birth: dateString,
        gender: input.gender,
        phone: input.phone,
        address: input.address,
        emergency_contact: input.emergency_contact,
        medical_notes: input.medical_notes
      })
      .returning()
      .execute();

    // Convert date string back to Date object for return
    const patient = result[0];
    return {
      ...patient,
      date_of_birth: new Date(patient.date_of_birth)
    };
  } catch (error) {
    console.error('Patient creation failed:', error);
    throw error;
  }
};