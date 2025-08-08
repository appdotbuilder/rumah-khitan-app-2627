import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  patientsTable, 
  servicesTable, 
  medicinesTable, 
  transactionsTable,
  transactionServicesTable,
  transactionMedicinesTable,
  stockMovementsTable,
  patientVisitsTable
} from '../db/schema';
import { type CreateTransactionInput } from '../schema';
import { createTransaction } from '../handlers/create_transaction';
import { eq } from 'drizzle-orm';

describe('createTransaction', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testPatientId: number;
  let testServiceId: number;
  let testMedicineId: number;

  beforeEach(async () => {
    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values({
        name: 'Test Patient',
        date_of_birth: '1990-01-01',
        gender: 'Laki-laki',
        phone: '08123456789'
      })
      .returning()
      .execute();
    testPatientId = patientResult[0].id;

    // Create test service
    const serviceResult = await db.insert(servicesTable)
      .values({
        name: 'Konsultasi Dokter',
        description: 'Konsultasi dengan dokter umum',
        price: '50000.00',
        is_active: true
      })
      .returning()
      .execute();
    testServiceId = serviceResult[0].id;

    // Create test medicine
    const medicineResult = await db.insert(medicinesTable)
      .values({
        name: 'Paracetamol',
        description: 'Obat penurun panas',
        unit: 'tablet',
        price_per_unit: '2000.00',
        stock_quantity: 100,
        minimum_stock: 10
      })
      .returning()
      .execute();
    testMedicineId = medicineResult[0].id;
  });

  it('should create a transaction with services only', async () => {
    const input: CreateTransactionInput = {
      patient_id: testPatientId,
      payment_method: 'tunai',
      payment_status: 'paid',
      notes: 'Test transaction',
      services: [
        {
          service_id: testServiceId,
          quantity: 1
        }
      ]
    };

    const result = await createTransaction(input);

    // Verify transaction was created
    expect(result.id).toBeDefined();
    expect(result.patient_id).toEqual(testPatientId);
    expect(result.total_amount).toEqual(50000);
    expect(result.payment_method).toEqual('tunai');
    expect(result.payment_status).toEqual('paid');
    expect(result.notes).toEqual('Test transaction');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify transaction service was created
    const transactionServices = await db.select()
      .from(transactionServicesTable)
      .where(eq(transactionServicesTable.transaction_id, result.id))
      .execute();

    expect(transactionServices).toHaveLength(1);
    expect(transactionServices[0].service_id).toEqual(testServiceId);
    expect(transactionServices[0].quantity).toEqual(1);
    expect(parseFloat(transactionServices[0].price_per_unit)).toEqual(50000);
    expect(parseFloat(transactionServices[0].total_price)).toEqual(50000);

    // Verify patient visit was created
    const patientVisits = await db.select()
      .from(patientVisitsTable)
      .where(eq(patientVisitsTable.transaction_id, result.id))
      .execute();

    expect(patientVisits).toHaveLength(1);
    expect(patientVisits[0].patient_id).toEqual(testPatientId);
    expect(patientVisits[0].transaction_id).toEqual(result.id);
  });

  it('should create a transaction with services and medicines', async () => {
    const input: CreateTransactionInput = {
      patient_id: testPatientId,
      payment_method: 'transfer',
      payment_status: 'pending',
      notes: null,
      services: [
        {
          service_id: testServiceId,
          quantity: 2
        }
      ],
      medicines: [
        {
          medicine_id: testMedicineId,
          quantity: 10
        }
      ]
    };

    const result = await createTransaction(input);

    // Verify transaction was created with correct total
    expect(result.total_amount).toEqual(120000); // (50000 * 2) + (2000 * 10)
    expect(result.payment_method).toEqual('transfer');
    expect(result.payment_status).toEqual('pending');

    // Verify transaction medicines was created
    const transactionMedicines = await db.select()
      .from(transactionMedicinesTable)
      .where(eq(transactionMedicinesTable.transaction_id, result.id))
      .execute();

    expect(transactionMedicines).toHaveLength(1);
    expect(transactionMedicines[0].medicine_id).toEqual(testMedicineId);
    expect(transactionMedicines[0].quantity).toEqual(10);
    expect(parseFloat(transactionMedicines[0].price_per_unit)).toEqual(2000);
    expect(parseFloat(transactionMedicines[0].total_price)).toEqual(20000);

    // Verify stock was reduced
    const medicine = await db.select()
      .from(medicinesTable)
      .where(eq(medicinesTable.id, testMedicineId))
      .execute();

    expect(medicine[0].stock_quantity).toEqual(90); // 100 - 10

    // Verify stock movement was created
    const stockMovements = await db.select()
      .from(stockMovementsTable)
      .where(eq(stockMovementsTable.reference_id, result.id))
      .execute();

    expect(stockMovements).toHaveLength(1);
    expect(stockMovements[0].medicine_id).toEqual(testMedicineId);
    expect(stockMovements[0].movement_type).toEqual('keluar');
    expect(stockMovements[0].quantity).toEqual(10);
    expect(stockMovements[0].reference_id).toEqual(result.id);
  });

  it('should create transaction with multiple services and medicines', async () => {
    // Create additional test data
    const service2Result = await db.insert(servicesTable)
      .values({
        name: 'Medical Check-up',
        price: '75000.00',
        is_active: true
      })
      .returning()
      .execute();

    const medicine2Result = await db.insert(medicinesTable)
      .values({
        name: 'Amoxicillin',
        unit: 'kapsul',
        price_per_unit: '5000.00',
        stock_quantity: 50,
        minimum_stock: 5
      })
      .returning()
      .execute();

    const input: CreateTransactionInput = {
      patient_id: testPatientId,
      payment_method: 'kartu',
      payment_status: 'paid',
      notes: 'Multiple items transaction',
      services: [
        { service_id: testServiceId, quantity: 1 },
        { service_id: service2Result[0].id, quantity: 1 }
      ],
      medicines: [
        { medicine_id: testMedicineId, quantity: 5 },
        { medicine_id: medicine2Result[0].id, quantity: 3 }
      ]
    };

    const result = await createTransaction(input);

    // Verify total calculation: (50000 * 1) + (75000 * 1) + (2000 * 5) + (5000 * 3)
    expect(result.total_amount).toEqual(150000);

    // Verify multiple transaction services
    const transactionServices = await db.select()
      .from(transactionServicesTable)
      .where(eq(transactionServicesTable.transaction_id, result.id))
      .execute();

    expect(transactionServices).toHaveLength(2);

    // Verify multiple transaction medicines
    const transactionMedicines = await db.select()
      .from(transactionMedicinesTable)
      .where(eq(transactionMedicinesTable.transaction_id, result.id))
      .execute();

    expect(transactionMedicines).toHaveLength(2);

    // Verify both stocks were reduced
    const medicines = await db.select()
      .from(medicinesTable)
      .execute();

    const paracetamol = medicines.find(m => m.id === testMedicineId);
    const amoxicillin = medicines.find(m => m.id === medicine2Result[0].id);

    expect(paracetamol!.stock_quantity).toEqual(95); // 100 - 5
    expect(amoxicillin!.stock_quantity).toEqual(47); // 50 - 3
  });

  it('should throw error when patient does not exist', async () => {
    const input: CreateTransactionInput = {
      patient_id: 99999,
      payment_method: 'tunai',
      payment_status: 'paid',
      notes: null,
      services: [{ service_id: testServiceId, quantity: 1 }]
    };

    await expect(createTransaction(input)).rejects.toThrow(/Patient with ID 99999 not found/i);
  });

  it('should throw error when service does not exist', async () => {
    const input: CreateTransactionInput = {
      patient_id: testPatientId,
      payment_method: 'tunai',
      payment_status: 'paid',
      notes: null,
      services: [{ service_id: 99999, quantity: 1 }]
    };

    await expect(createTransaction(input)).rejects.toThrow(/Service with ID 99999 not found/i);
  });

  it('should throw error when service is inactive', async () => {
    // Create inactive service
    const inactiveServiceResult = await db.insert(servicesTable)
      .values({
        name: 'Inactive Service',
        price: '25000.00',
        is_active: false
      })
      .returning()
      .execute();

    const input: CreateTransactionInput = {
      patient_id: testPatientId,
      payment_method: 'tunai',
      payment_status: 'paid',
      notes: null,
      services: [{ service_id: inactiveServiceResult[0].id, quantity: 1 }]
    };

    await expect(createTransaction(input)).rejects.toThrow(/Service .+ is not active/i);
  });

  it('should throw error when medicine does not exist', async () => {
    const input: CreateTransactionInput = {
      patient_id: testPatientId,
      payment_method: 'tunai',
      payment_status: 'paid',
      notes: null,
      services: [{ service_id: testServiceId, quantity: 1 }],
      medicines: [{ medicine_id: 99999, quantity: 1 }]
    };

    await expect(createTransaction(input)).rejects.toThrow(/Medicine with ID 99999 not found/i);
  });

  it('should throw error when insufficient medicine stock', async () => {
    const input: CreateTransactionInput = {
      patient_id: testPatientId,
      payment_method: 'tunai',
      payment_status: 'paid',
      notes: null,
      services: [{ service_id: testServiceId, quantity: 1 }],
      medicines: [{ medicine_id: testMedicineId, quantity: 150 }] // More than available stock (100)
    };

    await expect(createTransaction(input)).rejects.toThrow(/Insufficient stock for Paracetamol/i);
  });

  it('should handle transaction with default payment status', async () => {
    const input: CreateTransactionInput = {
      patient_id: testPatientId,
      payment_method: 'tunai',
      payment_status: 'pending', // This is the default from Zod schema
      notes: null,
      services: [{ service_id: testServiceId, quantity: 1 }]
    };

    const result = await createTransaction(input);

    expect(result.payment_status).toEqual('pending');
  });
});