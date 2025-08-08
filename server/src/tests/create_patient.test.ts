import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { patientsTable } from '../db/schema';
import { type CreatePatientInput } from '../schema';
import { createPatient } from '../handlers/create_patient';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreatePatientInput = {
  name: 'John Doe',
  date_of_birth: new Date('1990-01-15'),
  gender: 'Laki-laki',
  phone: '081234567890',
  address: 'Jl. Merdeka No. 123',
  emergency_contact: '081987654321',
  medical_notes: 'No known allergies'
};

// Test input with minimal required fields
const minimalTestInput: CreatePatientInput = {
  name: 'Jane Smith',
  date_of_birth: new Date('1985-06-20'),
  gender: 'Perempuan',
  phone: null,
  address: null,
  emergency_contact: null,
  medical_notes: null
};

describe('createPatient', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a patient with all fields', async () => {
    const result = await createPatient(testInput);

    // Verify returned patient data
    expect(result.name).toEqual('John Doe');
    expect(result.date_of_birth).toEqual(new Date('1990-01-15'));
    expect(result.gender).toEqual('Laki-laki');
    expect(result.phone).toEqual('081234567890');
    expect(result.address).toEqual('Jl. Merdeka No. 123');
    expect(result.emergency_contact).toEqual('081987654321');
    expect(result.medical_notes).toEqual('No known allergies');
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a patient with minimal required fields', async () => {
    const result = await createPatient(minimalTestInput);

    // Verify returned patient data
    expect(result.name).toEqual('Jane Smith');
    expect(result.date_of_birth).toEqual(new Date('1985-06-20'));
    expect(result.gender).toEqual('Perempuan');
    expect(result.phone).toBeNull();
    expect(result.address).toBeNull();
    expect(result.emergency_contact).toBeNull();
    expect(result.medical_notes).toBeNull();
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save patient to database', async () => {
    const result = await createPatient(testInput);

    // Query database to verify patient was saved
    const patients = await db.select()
      .from(patientsTable)
      .where(eq(patientsTable.id, result.id))
      .execute();

    expect(patients).toHaveLength(1);
    expect(patients[0].name).toEqual('John Doe');
    expect(patients[0].date_of_birth).toEqual('1990-01-15'); // Database stores as string
    expect(patients[0].gender).toEqual('Laki-laki');
    expect(patients[0].phone).toEqual('081234567890');
    expect(patients[0].address).toEqual('Jl. Merdeka No. 123');
    expect(patients[0].emergency_contact).toEqual('081987654321');
    expect(patients[0].medical_notes).toEqual('No known allergies');
    expect(patients[0].created_at).toBeInstanceOf(Date);
    expect(patients[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create multiple patients with unique IDs', async () => {
    const patient1 = await createPatient(testInput);
    const patient2 = await createPatient(minimalTestInput);

    expect(patient1.id).not.toEqual(patient2.id);
    expect(patient1.name).toEqual('John Doe');
    expect(patient2.name).toEqual('Jane Smith');

    // Verify both patients exist in database
    const allPatients = await db.select()
      .from(patientsTable)
      .execute();

    expect(allPatients).toHaveLength(2);
  });

  it('should handle date objects correctly', async () => {
    const birthDate = new Date('1995-12-25');
    const dateInput: CreatePatientInput = {
      ...testInput,
      date_of_birth: birthDate
    };

    const result = await createPatient(dateInput);

    expect(result.date_of_birth).toEqual(birthDate);

    // Verify in database
    const savedPatient = await db.select()
      .from(patientsTable)
      .where(eq(patientsTable.id, result.id))
      .execute();

    expect(savedPatient[0].date_of_birth).toEqual('1995-12-25'); // Database stores as string
  });

  it('should handle both gender options', async () => {
    const maleInput: CreatePatientInput = {
      ...testInput,
      name: 'Male Patient',
      gender: 'Laki-laki'
    };

    const femaleInput: CreatePatientInput = {
      ...testInput,
      name: 'Female Patient',
      gender: 'Perempuan'
    };

    const maleResult = await createPatient(maleInput);
    const femaleResult = await createPatient(femaleInput);

    expect(maleResult.gender).toEqual('Laki-laki');
    expect(femaleResult.gender).toEqual('Perempuan');

    // Verify in database
    const patients = await db.select()
      .from(patientsTable)
      .execute();

    expect(patients).toHaveLength(2);
    const genders = patients.map(p => p.gender).sort();
    expect(genders).toEqual(['Laki-laki', 'Perempuan']);
  });
});