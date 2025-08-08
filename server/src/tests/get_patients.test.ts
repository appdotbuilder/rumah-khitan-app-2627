import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { patientsTable } from '../db/schema';
import { type PatientSearchInput, type CreatePatientInput } from '../schema';
import { getPatients, getPatientById } from '../handlers/get_patients';

// Test data setup - using string dates for database insertion
const testPatientsForDB = [
  {
    name: 'John Doe',
    date_of_birth: '1985-03-15',
    gender: 'Laki-laki' as const,
    phone: '+6281234567890',
    address: 'Jl. Merdeka No. 123, Jakarta',
    emergency_contact: '+6281234567891',
    medical_notes: 'Alergi aspirin'
  },
  {
    name: 'Jane Smith',
    date_of_birth: '1990-07-22',
    gender: 'Perempuan' as const,
    phone: '+6281234567892',
    address: 'Jl. Sudirman No. 456, Bandung',
    emergency_contact: '+6281234567893',
    medical_notes: 'Hipertensi'
  },
  {
    name: 'Ahmad Rizki',
    date_of_birth: '1978-12-10',
    gender: 'Laki-laki' as const,
    phone: null,
    address: null,
    emergency_contact: null,
    medical_notes: null
  }
];

describe('getPatients', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no patients exist', async () => {
    const result = await getPatients();
    expect(result).toEqual([]);
  });

  it('should return all patients when no input provided', async () => {
    // Insert test patients
    await db.insert(patientsTable).values(testPatientsForDB).execute();

    const result = await getPatients();

    expect(result).toHaveLength(3);
    expect(result[0].name).toEqual('John Doe');
    expect(result[0].gender).toEqual('Laki-laki');
    expect(result[0].phone).toEqual('+6281234567890');
    expect(result[0].date_of_birth).toBeInstanceOf(Date);
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
    expect(result[0].id).toBeDefined();

    expect(result[1].name).toEqual('Jane Smith');
    expect(result[2].name).toEqual('Ahmad Rizki');
  });

  it('should apply default pagination when no input provided', async () => {
    // Insert 15 test patients
    const manyPatients = Array.from({ length: 15 }, (_, i) => ({
      name: `Patient ${i + 1}`,
      date_of_birth: '1990-01-01',
      gender: 'Laki-laki' as const,
      phone: null,
      address: null,
      emergency_contact: null,
      medical_notes: null
    }));

    await db.insert(patientsTable).values(manyPatients).execute();

    const result = await getPatients();

    // Should return default limit of 10
    expect(result).toHaveLength(10);
    expect(result[0].name).toEqual('Patient 1');
  });

  it('should apply custom pagination', async () => {
    // Insert test patients
    await db.insert(patientsTable).values(testPatientsForDB).execute();

    const searchInput: PatientSearchInput = {
      limit: 2,
      offset: 1
    };

    const result = await getPatients(searchInput);

    expect(result).toHaveLength(2);
    expect(result[0].name).toEqual('Jane Smith');
    expect(result[1].name).toEqual('Ahmad Rizki');
  });

  it('should search patients by name (case insensitive)', async () => {
    // Insert test patients
    await db.insert(patientsTable).values(testPatientsForDB).execute();

    const searchInput: PatientSearchInput = {
      query: 'john',
      limit: 10,
      offset: 0
    };

    const result = await getPatients(searchInput);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('John Doe');
    expect(result[0].gender).toEqual('Laki-laki');
  });

  it('should search patients by partial name match', async () => {
    // Insert test patients
    await db.insert(patientsTable).values(testPatientsForDB).execute();

    const searchInput: PatientSearchInput = {
      query: 'ah',
      limit: 10,
      offset: 0
    };

    const result = await getPatients(searchInput);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Ahmad Rizki');
  });

  it('should return empty array when search query has no matches', async () => {
    // Insert test patients
    await db.insert(patientsTable).values(testPatientsForDB).execute();

    const searchInput: PatientSearchInput = {
      query: 'nonexistent',
      limit: 10,
      offset: 0
    };

    const result = await getPatients(searchInput);

    expect(result).toEqual([]);
  });

  it('should handle empty search query by returning all patients', async () => {
    // Insert test patients
    await db.insert(patientsTable).values(testPatientsForDB).execute();

    const searchInput: PatientSearchInput = {
      query: '',
      limit: 10,
      offset: 0
    };

    const result = await getPatients(searchInput);

    expect(result).toHaveLength(3);
  });

  it('should handle whitespace-only search query by returning all patients', async () => {
    // Insert test patients
    await db.insert(patientsTable).values(testPatientsForDB).execute();

    const searchInput: PatientSearchInput = {
      query: '   ',
      limit: 10,
      offset: 0
    };

    const result = await getPatients(searchInput);

    expect(result).toHaveLength(3);
  });

  it('should combine search and pagination correctly', async () => {
    // Insert patients with similar names
    const similarPatients = [
      { ...testPatientsForDB[0], name: 'John Doe' },
      { ...testPatientsForDB[0], name: 'John Smith' },
      { ...testPatientsForDB[0], name: 'Johnny Walker' },
      { ...testPatientsForDB[1], name: 'Jane Doe' }
    ];

    await db.insert(patientsTable).values(similarPatients).execute();

    const searchInput: PatientSearchInput = {
      query: 'john',
      limit: 2,
      offset: 1
    };

    const result = await getPatients(searchInput);

    expect(result).toHaveLength(2);
    // Should return the second and third John matches
    expect(result[0].name).toEqual('John Smith');
    expect(result[1].name).toEqual('Johnny Walker');
  });

  it('should handle patients with null values correctly', async () => {
    // Insert patient with null values
    await db.insert(patientsTable).values([testPatientsForDB[2]]).execute();

    const result = await getPatients();

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Ahmad Rizki');
    expect(result[0].phone).toBeNull();
    expect(result[0].address).toBeNull();
    expect(result[0].emergency_contact).toBeNull();
    expect(result[0].medical_notes).toBeNull();
  });
});

describe('getPatientById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null when patient does not exist', async () => {
    const result = await getPatientById(999);
    expect(result).toBeNull();
  });

  it('should return patient when found by ID', async () => {
    // Insert test patient
    const insertResult = await db.insert(patientsTable)
      .values([testPatientsForDB[0]])
      .returning()
      .execute();

    const patientId = insertResult[0].id;

    const result = await getPatientById(patientId);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(patientId);
    expect(result!.name).toEqual('John Doe');
    expect(result!.gender).toEqual('Laki-laki');
    expect(result!.phone).toEqual('+6281234567890');
    expect(result!.address).toEqual('Jl. Merdeka No. 123, Jakarta');
    expect(result!.emergency_contact).toEqual('+6281234567891');
    expect(result!.medical_notes).toEqual('Alergi aspirin');
    expect(result!.date_of_birth).toBeInstanceOf(Date);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return patient with null fields correctly', async () => {
    // Insert patient with null fields
    const insertResult = await db.insert(patientsTable)
      .values([testPatientsForDB[2]])
      .returning()
      .execute();

    const patientId = insertResult[0].id;

    const result = await getPatientById(patientId);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(patientId);
    expect(result!.name).toEqual('Ahmad Rizki');
    expect(result!.gender).toEqual('Laki-laki');
    expect(result!.phone).toBeNull();
    expect(result!.address).toBeNull();
    expect(result!.emergency_contact).toBeNull();
    expect(result!.medical_notes).toBeNull();
  });

  it('should return correct patient when multiple patients exist', async () => {
    // Insert multiple patients
    const insertResult = await db.insert(patientsTable)
      .values(testPatientsForDB)
      .returning()
      .execute();

    // Get the second patient
    const targetPatientId = insertResult[1].id;

    const result = await getPatientById(targetPatientId);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(targetPatientId);
    expect(result!.name).toEqual('Jane Smith');
    expect(result!.gender).toEqual('Perempuan');
    expect(result!.phone).toEqual('+6281234567892');
  });

  it('should handle edge case with ID 0', async () => {
    const result = await getPatientById(0);
    expect(result).toBeNull();
  });

  it('should handle negative ID', async () => {
    const result = await getPatientById(-1);
    expect(result).toBeNull();
  });
});