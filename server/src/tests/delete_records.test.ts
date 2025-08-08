import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
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
import { eq } from 'drizzle-orm';
import { deletePatient, deleteMedicine, deleteService, deleteTransaction } from '../handlers/delete_records';

describe('deletePatient', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete patient with no associations', async () => {
    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values({
        name: 'Test Patient',
        date_of_birth: '1990-01-01',
        gender: 'Laki-laki',
        phone: '123456789',
        address: 'Test Address',
        emergency_contact: 'Emergency Contact',
        medical_notes: 'Test notes'
      })
      .returning()
      .execute();

    const patientId = patientResult[0].id;

    // Delete should succeed
    const result = await deletePatient(patientId);
    expect(result).toBe(true);

    // Verify patient was deleted
    const patients = await db.select()
      .from(patientsTable)
      .where(eq(patientsTable.id, patientId))
      .execute();
    
    expect(patients).toHaveLength(0);
  });

  it('should not delete patient with transactions', async () => {
    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values({
        name: 'Test Patient',
        date_of_birth: '1990-01-01',
        gender: 'Laki-laki',
        phone: '123456789',
        address: 'Test Address',
        emergency_contact: 'Emergency Contact',
        medical_notes: 'Test notes'
      })
      .returning()
      .execute();

    const patientId = patientResult[0].id;

    // Create transaction for patient
    await db.insert(transactionsTable)
      .values({
        patient_id: patientId,
        total_amount: '100.00',
        payment_method: 'tunai',
        payment_status: 'paid',
        notes: 'Test transaction'
      })
      .execute();

    // Delete should fail
    const result = await deletePatient(patientId);
    expect(result).toBe(false);

    // Verify patient still exists
    const patients = await db.select()
      .from(patientsTable)
      .where(eq(patientsTable.id, patientId))
      .execute();
    
    expect(patients).toHaveLength(1);
  });

  it('should not delete patient with visits', async () => {
    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values({
        name: 'Test Patient',
        date_of_birth: '1990-01-01',
        gender: 'Laki-laki',
        phone: '123456789',
        address: 'Test Address',
        emergency_contact: 'Emergency Contact',
        medical_notes: 'Test notes'
      })
      .returning()
      .execute();

    const patientId = patientResult[0].id;

    // Create visit for patient
    await db.insert(patientVisitsTable)
      .values({
        patient_id: patientId,
        visit_date: new Date(),
        diagnosis: 'Test diagnosis',
        treatment: 'Test treatment',
        notes: 'Test visit notes'
      })
      .execute();

    // Delete should fail
    const result = await deletePatient(patientId);
    expect(result).toBe(false);

    // Verify patient still exists
    const patients = await db.select()
      .from(patientsTable)
      .where(eq(patientsTable.id, patientId))
      .execute();
    
    expect(patients).toHaveLength(1);
  });

  it('should return false for non-existent patient', async () => {
    const result = await deletePatient(999);
    expect(result).toBe(false);
  });
});

describe('deleteMedicine', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete medicine with no transaction history', async () => {
    // Create test medicine
    const medicineResult = await db.insert(medicinesTable)
      .values({
        name: 'Test Medicine',
        description: 'Test description',
        unit: 'tablet',
        price_per_unit: '10.00',
        stock_quantity: 100,
        minimum_stock: 10,
        expiry_date: '2025-12-31',
        supplier: 'Test Supplier'
      })
      .returning()
      .execute();

    const medicineId = medicineResult[0].id;

    // Delete should succeed
    const result = await deleteMedicine(medicineId);
    expect(result).toBe(true);

    // Verify medicine was deleted
    const medicines = await db.select()
      .from(medicinesTable)
      .where(eq(medicinesTable.id, medicineId))
      .execute();
    
    expect(medicines).toHaveLength(0);
  });

  it('should delete medicine with stock movements but no transactions', async () => {
    // Create test medicine
    const medicineResult = await db.insert(medicinesTable)
      .values({
        name: 'Test Medicine',
        description: 'Test description',
        unit: 'tablet',
        price_per_unit: '10.00',
        stock_quantity: 100,
        minimum_stock: 10,
        expiry_date: '2025-12-31',
        supplier: 'Test Supplier'
      })
      .returning()
      .execute();

    const medicineId = medicineResult[0].id;

    // Create stock movement
    await db.insert(stockMovementsTable)
      .values({
        medicine_id: medicineId,
        movement_type: 'masuk',
        quantity: 50,
        notes: 'Test stock movement'
      })
      .execute();

    // Delete should succeed
    const result = await deleteMedicine(medicineId);
    expect(result).toBe(true);

    // Verify medicine was deleted
    const medicines = await db.select()
      .from(medicinesTable)
      .where(eq(medicinesTable.id, medicineId))
      .execute();
    
    expect(medicines).toHaveLength(0);

    // Verify stock movements were deleted
    const movements = await db.select()
      .from(stockMovementsTable)
      .where(eq(stockMovementsTable.medicine_id, medicineId))
      .execute();
    
    expect(movements).toHaveLength(0);
  });

  it('should not delete medicine used in transactions', async () => {
    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values({
        name: 'Test Patient',
        date_of_birth: '1990-01-01',
        gender: 'Laki-laki',
        phone: '123456789',
        address: 'Test Address',
        emergency_contact: 'Emergency Contact',
        medical_notes: 'Test notes'
      })
      .returning()
      .execute();

    // Create test medicine
    const medicineResult = await db.insert(medicinesTable)
      .values({
        name: 'Test Medicine',
        description: 'Test description',
        unit: 'tablet',
        price_per_unit: '10.00',
        stock_quantity: 100,
        minimum_stock: 10,
        expiry_date: '2025-12-31',
        supplier: 'Test Supplier'
      })
      .returning()
      .execute();

    const medicineId = medicineResult[0].id;

    // Create transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        patient_id: patientResult[0].id,
        total_amount: '100.00',
        payment_method: 'tunai',
        payment_status: 'paid',
        notes: 'Test transaction'
      })
      .returning()
      .execute();

    // Create transaction medicine
    await db.insert(transactionMedicinesTable)
      .values({
        transaction_id: transactionResult[0].id,
        medicine_id: medicineId,
        quantity: 5,
        price_per_unit: '10.00',
        total_price: '50.00'
      })
      .execute();

    // Delete should fail
    const result = await deleteMedicine(medicineId);
    expect(result).toBe(false);

    // Verify medicine still exists
    const medicines = await db.select()
      .from(medicinesTable)
      .where(eq(medicinesTable.id, medicineId))
      .execute();
    
    expect(medicines).toHaveLength(1);
  });

  it('should return false for non-existent medicine', async () => {
    const result = await deleteMedicine(999);
    expect(result).toBe(false);
  });
});

describe('deleteService', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete service with no transaction history', async () => {
    // Create test service
    const serviceResult = await db.insert(servicesTable)
      .values({
        name: 'Test Service',
        description: 'Test description',
        price: '50.00',
        is_active: true
      })
      .returning()
      .execute();

    const serviceId = serviceResult[0].id;

    // Delete should succeed
    const result = await deleteService(serviceId);
    expect(result).toBe(true);

    // Verify service was deleted
    const services = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.id, serviceId))
      .execute();
    
    expect(services).toHaveLength(0);
  });

  it('should deactivate service used in transactions', async () => {
    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values({
        name: 'Test Patient',
        date_of_birth: '1990-01-01',
        gender: 'Laki-laki',
        phone: '123456789',
        address: 'Test Address',
        emergency_contact: 'Emergency Contact',
        medical_notes: 'Test notes'
      })
      .returning()
      .execute();

    // Create test service
    const serviceResult = await db.insert(servicesTable)
      .values({
        name: 'Test Service',
        description: 'Test description',
        price: '50.00',
        is_active: true
      })
      .returning()
      .execute();

    const serviceId = serviceResult[0].id;

    // Create transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        patient_id: patientResult[0].id,
        total_amount: '100.00',
        payment_method: 'tunai',
        payment_status: 'paid',
        notes: 'Test transaction'
      })
      .returning()
      .execute();

    // Create transaction service
    await db.insert(transactionServicesTable)
      .values({
        transaction_id: transactionResult[0].id,
        service_id: serviceId,
        quantity: 1,
        price_per_unit: '50.00',
        total_price: '50.00'
      })
      .execute();

    // Delete should succeed (deactivate)
    const result = await deleteService(serviceId);
    expect(result).toBe(true);

    // Verify service was deactivated, not deleted
    const services = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.id, serviceId))
      .execute();
    
    expect(services).toHaveLength(1);
    expect(services[0].is_active).toBe(false);
  });

  it('should return false for non-existent service', async () => {
    const result = await deleteService(999);
    expect(result).toBe(false);
  });
});

describe('deleteTransaction', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete pending transaction with all related data', async () => {
    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values({
        name: 'Test Patient',
        date_of_birth: '1990-01-01',
        gender: 'Laki-laki',
        phone: '123456789',
        address: 'Test Address',
        emergency_contact: 'Emergency Contact',
        medical_notes: 'Test notes'
      })
      .returning()
      .execute();

    // Create test service
    const serviceResult = await db.insert(servicesTable)
      .values({
        name: 'Test Service',
        description: 'Test description',
        price: '50.00',
        is_active: true
      })
      .returning()
      .execute();

    // Create test medicine
    const medicineResult = await db.insert(medicinesTable)
      .values({
        name: 'Test Medicine',
        description: 'Test description',
        unit: 'tablet',
        price_per_unit: '10.00',
        stock_quantity: 100,
        minimum_stock: 10,
        expiry_date: '2025-12-31',
        supplier: 'Test Supplier'
      })
      .returning()
      .execute();

    // Create pending transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        patient_id: patientResult[0].id,
        total_amount: '60.00',
        payment_method: 'tunai',
        payment_status: 'pending',
        notes: 'Test transaction'
      })
      .returning()
      .execute();

    const transactionId = transactionResult[0].id;

    // Create transaction service
    await db.insert(transactionServicesTable)
      .values({
        transaction_id: transactionId,
        service_id: serviceResult[0].id,
        quantity: 1,
        price_per_unit: '50.00',
        total_price: '50.00'
      })
      .execute();

    // Create transaction medicine
    await db.insert(transactionMedicinesTable)
      .values({
        transaction_id: transactionId,
        medicine_id: medicineResult[0].id,
        quantity: 1,
        price_per_unit: '10.00',
        total_price: '10.00'
      })
      .execute();

    // Create patient visit linked to transaction
    await db.insert(patientVisitsTable)
      .values({
        patient_id: patientResult[0].id,
        transaction_id: transactionId,
        visit_date: new Date(),
        diagnosis: 'Test diagnosis',
        treatment: 'Test treatment',
        notes: 'Test visit notes'
      })
      .execute();

    // Delete should succeed
    const result = await deleteTransaction(transactionId);
    expect(result).toBe(true);

    // Verify transaction was deleted
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transactionId))
      .execute();
    
    expect(transactions).toHaveLength(0);

    // Verify transaction services were deleted
    const transactionServices = await db.select()
      .from(transactionServicesTable)
      .where(eq(transactionServicesTable.transaction_id, transactionId))
      .execute();
    
    expect(transactionServices).toHaveLength(0);

    // Verify transaction medicines were deleted
    const transactionMedicines = await db.select()
      .from(transactionMedicinesTable)
      .where(eq(transactionMedicinesTable.transaction_id, transactionId))
      .execute();
    
    expect(transactionMedicines).toHaveLength(0);

    // Verify patient visit transaction_id was set to null
    const visits = await db.select()
      .from(patientVisitsTable)
      .where(eq(patientVisitsTable.patient_id, patientResult[0].id))
      .execute();
    
    expect(visits).toHaveLength(1);
    expect(visits[0].transaction_id).toBeNull();
  });

  it('should delete cancelled transaction', async () => {
    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values({
        name: 'Test Patient',
        date_of_birth: '1990-01-01',
        gender: 'Laki-laki',
        phone: '123456789',
        address: 'Test Address',
        emergency_contact: 'Emergency Contact',
        medical_notes: 'Test notes'
      })
      .returning()
      .execute();

    // Create cancelled transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        patient_id: patientResult[0].id,
        total_amount: '100.00',
        payment_method: 'tunai',
        payment_status: 'cancelled',
        notes: 'Test transaction'
      })
      .returning()
      .execute();

    const transactionId = transactionResult[0].id;

    // Delete should succeed
    const result = await deleteTransaction(transactionId);
    expect(result).toBe(true);

    // Verify transaction was deleted
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transactionId))
      .execute();
    
    expect(transactions).toHaveLength(0);
  });

  it('should not delete paid transaction', async () => {
    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values({
        name: 'Test Patient',
        date_of_birth: '1990-01-01',
        gender: 'Laki-laki',
        phone: '123456789',
        address: 'Test Address',
        emergency_contact: 'Emergency Contact',
        medical_notes: 'Test notes'
      })
      .returning()
      .execute();

    // Create paid transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        patient_id: patientResult[0].id,
        total_amount: '100.00',
        payment_method: 'tunai',
        payment_status: 'paid',
        notes: 'Test transaction'
      })
      .returning()
      .execute();

    const transactionId = transactionResult[0].id;

    // Delete should fail
    const result = await deleteTransaction(transactionId);
    expect(result).toBe(false);

    // Verify transaction still exists
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transactionId))
      .execute();
    
    expect(transactions).toHaveLength(1);
  });

  it('should return false for non-existent transaction', async () => {
    const result = await deleteTransaction(999);
    expect(result).toBe(false);
  });
});