import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { patientsTable, transactionsTable, patientVisitsTable } from '../db/schema';
import { type CreatePatientVisitInput } from '../schema';
import { 
  createPatientVisit, 
  getPatientVisits, 
  getVisitById, 
  updatePatientVisit 
} from '../handlers/patient_visits';
import { eq } from 'drizzle-orm';

// Test data
const testPatient = {
  name: 'John Doe',
  date_of_birth: '1990-01-15', // Use string format for database insertion
  gender: 'Laki-laki' as const,
  phone: '081234567890',
  address: 'Jl. Test No. 123',
  emergency_contact: '082345678901',
  medical_notes: 'No known allergies'
};

const testTransaction = {
  patient_id: 0, // Will be set after patient creation
  total_amount: '150000',
  payment_method: 'tunai' as const,
  payment_status: 'paid' as const,
  notes: 'Regular checkup payment'
};

const testVisitInput: CreatePatientVisitInput = {
  patient_id: 0, // Will be set after patient creation
  transaction_id: null,
  visit_date: new Date('2024-01-15T10:00:00Z'),
  diagnosis: 'Common cold',
  treatment: 'Rest and medication',
  notes: 'Patient advised to drink more fluids'
};

describe('Patient Visits Handler', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createPatientVisit', () => {
    it('should create a patient visit successfully', async () => {
      // Create prerequisite patient
      const patientResult = await db.insert(patientsTable)
        .values(testPatient)
        .returning()
        .execute();
      const patient = patientResult[0];

      const input = {
        ...testVisitInput,
        patient_id: patient.id
      };

      const result = await createPatientVisit(input);

      expect(result.patient_id).toEqual(patient.id);
      expect(result.transaction_id).toBeNull();
      expect(result.visit_date).toEqual(input.visit_date);
      expect(result.diagnosis).toEqual('Common cold');
      expect(result.treatment).toEqual('Rest and medication');
      expect(result.notes).toEqual('Patient advised to drink more fluids');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should create a patient visit with transaction reference', async () => {
      // Create prerequisite patient
      const patientResult = await db.insert(patientsTable)
        .values(testPatient)
        .returning()
        .execute();
      const patient = patientResult[0];

      // Create prerequisite transaction
      const transactionResult = await db.insert(transactionsTable)
        .values({
          ...testTransaction,
          patient_id: patient.id
        })
        .returning()
        .execute();
      const transaction = transactionResult[0];

      const input = {
        ...testVisitInput,
        patient_id: patient.id,
        transaction_id: transaction.id
      };

      const result = await createPatientVisit(input);

      expect(result.patient_id).toEqual(patient.id);
      expect(result.transaction_id).toEqual(transaction.id);
      expect(result.diagnosis).toEqual('Common cold');
      expect(result.id).toBeDefined();
    });

    it('should create a visit with minimal data', async () => {
      // Create prerequisite patient
      const patientResult = await db.insert(patientsTable)
        .values(testPatient)
        .returning()
        .execute();
      const patient = patientResult[0];

      const minimalInput = {
        patient_id: patient.id,
        transaction_id: null,
        visit_date: new Date(),
        diagnosis: null,
        treatment: null,
        notes: null
      };

      const result = await createPatientVisit(minimalInput);

      expect(result.patient_id).toEqual(patient.id);
      expect(result.diagnosis).toBeNull();
      expect(result.treatment).toBeNull();
      expect(result.notes).toBeNull();
      expect(result.id).toBeDefined();
    });

    it('should save visit to database correctly', async () => {
      // Create prerequisite patient
      const patientResult = await db.insert(patientsTable)
        .values(testPatient)
        .returning()
        .execute();
      const patient = patientResult[0];

      const input = {
        ...testVisitInput,
        patient_id: patient.id
      };

      const result = await createPatientVisit(input);

      // Verify in database
      const visits = await db.select()
        .from(patientVisitsTable)
        .where(eq(patientVisitsTable.id, result.id))
        .execute();

      expect(visits).toHaveLength(1);
      expect(visits[0].patient_id).toEqual(patient.id);
      expect(visits[0].diagnosis).toEqual('Common cold');
      expect(visits[0].treatment).toEqual('Rest and medication');
      expect(visits[0].notes).toEqual('Patient advised to drink more fluids');
    });

    it('should throw error when patient does not exist', async () => {
      const input = {
        ...testVisitInput,
        patient_id: 999
      };

      expect(createPatientVisit(input)).rejects.toThrow(/Patient with ID 999 not found/i);
    });

    it('should throw error when transaction does not exist', async () => {
      // Create prerequisite patient
      const patientResult = await db.insert(patientsTable)
        .values(testPatient)
        .returning()
        .execute();
      const patient = patientResult[0];

      const input = {
        ...testVisitInput,
        patient_id: patient.id,
        transaction_id: 999
      };

      expect(createPatientVisit(input)).rejects.toThrow(/Transaction with ID 999 not found/i);
    });
  });

  describe('getPatientVisits', () => {
    it('should fetch all visits for a patient ordered by date', async () => {
      // Create prerequisite patient
      const patientResult = await db.insert(patientsTable)
        .values(testPatient)
        .returning()
        .execute();
      const patient = patientResult[0];

      // Create multiple visits
      const visit1Input = {
        ...testVisitInput,
        patient_id: patient.id,
        visit_date: new Date('2024-01-10T10:00:00Z'),
        diagnosis: 'First visit'
      };

      const visit2Input = {
        ...testVisitInput,
        patient_id: patient.id,
        visit_date: new Date('2024-01-20T10:00:00Z'),
        diagnosis: 'Second visit'
      };

      await createPatientVisit(visit1Input);
      await createPatientVisit(visit2Input);

      const result = await getPatientVisits(patient.id);

      expect(result).toHaveLength(2);
      // Should be ordered by visit_date DESC (newest first)
      expect(result[0].diagnosis).toEqual('Second visit');
      expect(result[1].diagnosis).toEqual('First visit');
      expect(result[0].visit_date >= result[1].visit_date).toBe(true);
    });

    it('should return empty array for patient with no visits', async () => {
      // Create prerequisite patient
      const patientResult = await db.insert(patientsTable)
        .values(testPatient)
        .returning()
        .execute();
      const patient = patientResult[0];

      const result = await getPatientVisits(patient.id);

      expect(result).toHaveLength(0);
    });

    it('should throw error when patient does not exist', async () => {
      expect(getPatientVisits(999)).rejects.toThrow(/Patient with ID 999 not found/i);
    });
  });

  describe('getVisitById', () => {
    it('should fetch visit by ID successfully', async () => {
      // Create prerequisite patient
      const patientResult = await db.insert(patientsTable)
        .values(testPatient)
        .returning()
        .execute();
      const patient = patientResult[0];

      const input = {
        ...testVisitInput,
        patient_id: patient.id
      };

      const createdVisit = await createPatientVisit(input);
      const result = await getVisitById(createdVisit.id);

      expect(result).toBeDefined();
      expect(result!.id).toEqual(createdVisit.id);
      expect(result!.patient_id).toEqual(patient.id);
      expect(result!.diagnosis).toEqual('Common cold');
      expect(result!.treatment).toEqual('Rest and medication');
    });

    it('should return null when visit does not exist', async () => {
      const result = await getVisitById(999);

      expect(result).toBeNull();
    });
  });

  describe('updatePatientVisit', () => {
    it('should update visit diagnosis, treatment, and notes', async () => {
      // Create prerequisite patient
      const patientResult = await db.insert(patientsTable)
        .values(testPatient)
        .returning()
        .execute();
      const patient = patientResult[0];

      const input = {
        ...testVisitInput,
        patient_id: patient.id
      };

      const createdVisit = await createPatientVisit(input);

      const result = await updatePatientVisit(
        createdVisit.id,
        'Updated diagnosis',
        'Updated treatment',
        'Updated notes'
      );

      expect(result.id).toEqual(createdVisit.id);
      expect(result.diagnosis).toEqual('Updated diagnosis');
      expect(result.treatment).toEqual('Updated treatment');
      expect(result.notes).toEqual('Updated notes');
      expect(result.patient_id).toEqual(patient.id);
    });

    it('should update only provided fields', async () => {
      // Create prerequisite patient
      const patientResult = await db.insert(patientsTable)
        .values(testPatient)
        .returning()
        .execute();
      const patient = patientResult[0];

      const input = {
        ...testVisitInput,
        patient_id: patient.id
      };

      const createdVisit = await createPatientVisit(input);

      const result = await updatePatientVisit(
        createdVisit.id,
        'Updated diagnosis only'
      );

      expect(result.diagnosis).toEqual('Updated diagnosis only');
      expect(result.treatment).toEqual('Rest and medication'); // Unchanged
      expect(result.notes).toEqual('Patient advised to drink more fluids'); // Unchanged
    });

    it('should update fields to null when explicitly provided', async () => {
      // Create prerequisite patient
      const patientResult = await db.insert(patientsTable)
        .values(testPatient)
        .returning()
        .execute();
      const patient = patientResult[0];

      const input = {
        ...testVisitInput,
        patient_id: patient.id
      };

      const createdVisit = await createPatientVisit(input);

      const result = await updatePatientVisit(
        createdVisit.id,
        null, // Clear diagnosis
        'Updated treatment',
        null  // Clear notes
      );

      expect(result.diagnosis).toBeNull();
      expect(result.treatment).toEqual('Updated treatment');
      expect(result.notes).toBeNull();
    });

    it('should return unchanged visit when no fields provided', async () => {
      // Create prerequisite patient
      const patientResult = await db.insert(patientsTable)
        .values(testPatient)
        .returning()
        .execute();
      const patient = patientResult[0];

      const input = {
        ...testVisitInput,
        patient_id: patient.id
      };

      const createdVisit = await createPatientVisit(input);
      const result = await updatePatientVisit(createdVisit.id);

      expect(result.diagnosis).toEqual('Common cold');
      expect(result.treatment).toEqual('Rest and medication');
      expect(result.notes).toEqual('Patient advised to drink more fluids');
    });

    it('should persist changes to database', async () => {
      // Create prerequisite patient
      const patientResult = await db.insert(patientsTable)
        .values(testPatient)
        .returning()
        .execute();
      const patient = patientResult[0];

      const input = {
        ...testVisitInput,
        patient_id: patient.id
      };

      const createdVisit = await createPatientVisit(input);

      await updatePatientVisit(
        createdVisit.id,
        'Persistent diagnosis',
        'Persistent treatment',
        'Persistent notes'
      );

      // Verify changes in database
      const visits = await db.select()
        .from(patientVisitsTable)
        .where(eq(patientVisitsTable.id, createdVisit.id))
        .execute();

      expect(visits).toHaveLength(1);
      expect(visits[0].diagnosis).toEqual('Persistent diagnosis');
      expect(visits[0].treatment).toEqual('Persistent treatment');
      expect(visits[0].notes).toEqual('Persistent notes');
    });

    it('should throw error when visit does not exist', async () => {
      expect(updatePatientVisit(999, 'New diagnosis'))
        .rejects.toThrow(/Patient visit with ID 999 not found/i);
    });
  });
});