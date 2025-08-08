import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { patientsTable } from '../db/schema';
import { type UpdatePatientInput, type CreatePatientInput } from '../schema';
import { updatePatient } from '../handlers/update_patient';
import { eq } from 'drizzle-orm';

// Helper function to create a test patient
const createTestPatient = async (data: CreatePatientInput) => {
  const result = await db.insert(patientsTable)
    .values({
      name: data.name,
      date_of_birth: data.date_of_birth.toISOString().split('T')[0],
      gender: data.gender,
      phone: data.phone,
      address: data.address,
      emergency_contact: data.emergency_contact,
      medical_notes: data.medical_notes
    })
    .returning()
    .execute();

  // Convert date string back to Date object for consistency
  const patient = result[0];
  return {
    ...patient,
    date_of_birth: new Date(patient.date_of_birth)
  };
};

// Test patient data
const testPatientData: CreatePatientInput = {
  name: 'John Doe',
  date_of_birth: new Date('1985-05-15'),
  gender: 'Laki-laki',
  phone: '08123456789',
  address: 'Jl. Test No. 123',
  emergency_contact: 'Jane Doe - 08987654321',
  medical_notes: 'No known allergies'
};

describe('updatePatient', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update all patient fields', async () => {
    // Create initial patient
    const createdPatient = await createTestPatient(testPatientData);

    const updateInput: UpdatePatientInput = {
      id: createdPatient.id,
      name: 'John Smith',
      date_of_birth: new Date('1980-03-20'),
      gender: 'Perempuan',
      phone: '08111222333',
      address: 'Jl. Updated No. 456',
      emergency_contact: 'Mary Smith - 08999888777',
      medical_notes: 'Allergic to penicillin'
    };

    const result = await updatePatient(updateInput);

    // Verify updated fields
    expect(result.id).toEqual(createdPatient.id);
    expect(result.name).toEqual('John Smith');
    expect(result.date_of_birth).toBeInstanceOf(Date);
    expect(result.date_of_birth.toISOString().split('T')[0]).toEqual('1980-03-20');
    expect(result.gender).toEqual('Perempuan');
    expect(result.phone).toEqual('08111222333');
    expect(result.address).toEqual('Jl. Updated No. 456');
    expect(result.emergency_contact).toEqual('Mary Smith - 08999888777');
    expect(result.medical_notes).toEqual('Allergic to penicillin');
    expect(result.created_at).toEqual(createdPatient.created_at);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(createdPatient.updated_at.getTime());
  });

  it('should update only specified fields', async () => {
    // Create initial patient
    const createdPatient = await createTestPatient(testPatientData);

    const updateInput: UpdatePatientInput = {
      id: createdPatient.id,
      name: 'Updated Name',
      phone: '08999999999'
    };

    const result = await updatePatient(updateInput);

    // Verify only specified fields were updated
    expect(result.name).toEqual('Updated Name');
    expect(result.phone).toEqual('08999999999');

    // Verify other fields remained unchanged
    expect(result.date_of_birth).toEqual(createdPatient.date_of_birth);
    expect(result.gender).toEqual(createdPatient.gender);
    expect(result.address).toEqual(createdPatient.address);
    expect(result.emergency_contact).toEqual(createdPatient.emergency_contact);
    expect(result.medical_notes).toEqual(createdPatient.medical_notes);
    expect(result.created_at).toEqual(createdPatient.created_at);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(createdPatient.updated_at.getTime());
  });

  it('should update nullable fields to null', async () => {
    // Create initial patient with all fields filled
    const createdPatient = await createTestPatient(testPatientData);

    const updateInput: UpdatePatientInput = {
      id: createdPatient.id,
      phone: null,
      address: null,
      emergency_contact: null,
      medical_notes: null
    };

    const result = await updatePatient(updateInput);

    // Verify nullable fields were set to null
    expect(result.phone).toBeNull();
    expect(result.address).toBeNull();
    expect(result.emergency_contact).toBeNull();
    expect(result.medical_notes).toBeNull();

    // Verify required fields remained unchanged
    expect(result.name).toEqual(createdPatient.name);
    expect(result.date_of_birth).toEqual(createdPatient.date_of_birth);
    expect(result.gender).toEqual(createdPatient.gender);
  });

  it('should save updated data to database', async () => {
    // Create initial patient
    const createdPatient = await createTestPatient(testPatientData);

    const updateInput: UpdatePatientInput = {
      id: createdPatient.id,
      name: 'Database Test Patient',
      gender: 'Perempuan'
    };

    await updatePatient(updateInput);

    // Query database directly to verify changes
    const updatedPatients = await db.select()
      .from(patientsTable)
      .where(eq(patientsTable.id, createdPatient.id))
      .execute();

    expect(updatedPatients).toHaveLength(1);
    const dbPatient = updatedPatients[0];
    expect(dbPatient.name).toEqual('Database Test Patient');
    expect(dbPatient.gender).toEqual('Perempuan');
    expect(dbPatient.phone).toEqual(testPatientData.phone); // Should remain unchanged
    expect(dbPatient.updated_at).toBeInstanceOf(Date);
    expect(dbPatient.updated_at.getTime()).toBeGreaterThan(createdPatient.updated_at.getTime());
    // Date from DB is a string, so we check the string value
    expect(dbPatient.date_of_birth).toEqual(createdPatient.date_of_birth.toISOString().split('T')[0]);
  });

  it('should throw error when patient does not exist', async () => {
    const updateInput: UpdatePatientInput = {
      id: 99999, // Non-existent ID
      name: 'Non-existent Patient'
    };

    await expect(updatePatient(updateInput)).rejects.toThrow(/Patient with ID 99999 not found/i);
  });

  it('should handle date updates correctly', async () => {
    // Create initial patient
    const createdPatient = await createTestPatient(testPatientData);

    const newDate = new Date('1990-12-25');
    const updateInput: UpdatePatientInput = {
      id: createdPatient.id,
      date_of_birth: newDate
    };

    const result = await updatePatient(updateInput);

    expect(result.date_of_birth).toBeInstanceOf(Date);
    expect(result.date_of_birth.toISOString().split('T')[0]).toEqual(newDate.toISOString().split('T')[0]);
  });

  it('should update patient with minimal data', async () => {
    // Create patient with minimal required fields
    const minimalPatient: CreatePatientInput = {
      name: 'Minimal Patient',
      date_of_birth: new Date('1995-01-01'),
      gender: 'Laki-laki',
      phone: null,
      address: null,
      emergency_contact: null,
      medical_notes: null
    };

    const createdPatient = await createTestPatient(minimalPatient);

    const updateInput: UpdatePatientInput = {
      id: createdPatient.id,
      phone: '08123123123',
      medical_notes: 'Added medical notes'
    };

    const result = await updatePatient(updateInput);

    expect(result.name).toEqual('Minimal Patient');
    expect(result.phone).toEqual('08123123123');
    expect(result.medical_notes).toEqual('Added medical notes');
    expect(result.address).toBeNull();
    expect(result.emergency_contact).toBeNull();
  });

  it('should preserve created_at timestamp when updating', async () => {
    // Create initial patient
    const createdPatient = await createTestPatient(testPatientData);
    const originalCreatedAt = createdPatient.created_at;

    // Wait a small amount to ensure timestamps differ
    await new Promise(resolve => setTimeout(resolve, 10));

    const updateInput: UpdatePatientInput = {
      id: createdPatient.id,
      name: 'Updated Patient'
    };

    const result = await updatePatient(updateInput);

    // created_at should remain the same
    expect(result.created_at).toEqual(originalCreatedAt);
    // updated_at should be different
    expect(result.updated_at.getTime()).toBeGreaterThan(originalCreatedAt.getTime());
  });
});