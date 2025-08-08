import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  patientsTable, 
  transactionsTable, 
  medicinesTable,
  transactionMedicinesTable,
  stockMovementsTable
} from '../db/schema';
import { updateTransactionStatus, addTransactionNotes } from '../handlers/update_transaction';
import { eq } from 'drizzle-orm';

describe('updateTransactionStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update transaction status from pending to paid', async () => {
    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values({
        name: 'Test Patient',
        date_of_birth: '1990-01-01',
        gender: 'Laki-laki',
        phone: '081234567890',
        address: 'Test Address',
        emergency_contact: '081234567891',
        medical_notes: 'Test notes'
      })
      .returning()
      .execute();

    const patient = patientResult[0];

    // Create test transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        patient_id: patient.id,
        total_amount: '100000.00',
        payment_method: 'tunai',
        payment_status: 'pending',
        notes: 'Test transaction'
      })
      .returning()
      .execute();

    const transaction = transactionResult[0];

    // Update status to paid
    const result = await updateTransactionStatus(transaction.id, 'paid');

    expect(result.id).toEqual(transaction.id);
    expect(result.payment_status).toEqual('paid');
    expect(result.total_amount).toEqual(100000);
    expect(typeof result.total_amount).toBe('number');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should reverse stock movements when changing status to cancelled', async () => {
    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values({
        name: 'Test Patient',
        date_of_birth: '1990-01-01',
        gender: 'Laki-laki',
        phone: '081234567890',
        address: 'Test Address',
        emergency_contact: '081234567891',
        medical_notes: 'Test notes'
      })
      .returning()
      .execute();

    const patient = patientResult[0];

    // Create test medicine
    const medicineResult = await db.insert(medicinesTable)
      .values({
        name: 'Test Medicine',
        description: 'Test description',
        unit: 'tablet',
        price_per_unit: '5000.00',
        stock_quantity: 100,
        minimum_stock: 10,
        expiry_date: '2025-12-31',
        supplier: 'Test Supplier'
      })
      .returning()
      .execute();

    const medicine = medicineResult[0];

    // Create test transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        patient_id: patient.id,
        total_amount: '15000.00',
        payment_method: 'tunai',
        payment_status: 'pending',
        notes: 'Test transaction'
      })
      .returning()
      .execute();

    const transaction = transactionResult[0];

    // Add medicine to transaction
    await db.insert(transactionMedicinesTable)
      .values({
        transaction_id: transaction.id,
        medicine_id: medicine.id,
        quantity: 3,
        price_per_unit: '5000.00',
        total_price: '15000.00'
      })
      .execute();

    // Create stock movement (outgoing)
    await db.insert(stockMovementsTable)
      .values({
        medicine_id: medicine.id,
        movement_type: 'keluar',
        quantity: 3,
        reference_id: transaction.id,
        notes: 'Penjualan obat'
      })
      .execute();

    // Update medicine stock (simulate deduction)
    await db.update(medicinesTable)
      .set({ stock_quantity: 97 })
      .where(eq(medicinesTable.id, medicine.id))
      .execute();

    // Change status to cancelled
    const result = await updateTransactionStatus(transaction.id, 'cancelled');

    expect(result.payment_status).toEqual('cancelled');

    // Check that stock was restored
    const updatedMedicine = await db.select()
      .from(medicinesTable)
      .where(eq(medicinesTable.id, medicine.id))
      .execute();

    expect(updatedMedicine[0].stock_quantity).toEqual(100); // Original stock restored

    // Check that reverse stock movement was created
    const stockMovements = await db.select()
      .from(stockMovementsTable)
      .where(eq(stockMovementsTable.reference_id, transaction.id))
      .execute();

    expect(stockMovements).toHaveLength(2); // Original + reverse movement
    const reverseMovement = stockMovements.find(sm => sm.movement_type === 'masuk');
    expect(reverseMovement).toBeDefined();
    expect(reverseMovement?.quantity).toEqual(3);
    expect(reverseMovement?.notes).toContain('Pembatalan transaksi');
  });

  it('should re-deduct stock when changing from cancelled to paid', async () => {
    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values({
        name: 'Test Patient',
        date_of_birth: '1990-01-01',
        gender: 'Laki-laki',
        phone: '081234567890',
        address: 'Test Address',
        emergency_contact: '081234567891',
        medical_notes: 'Test notes'
      })
      .returning()
      .execute();

    const patient = patientResult[0];

    // Create test medicine with sufficient stock
    const medicineResult = await db.insert(medicinesTable)
      .values({
        name: 'Test Medicine',
        description: 'Test description',
        unit: 'tablet',
        price_per_unit: '5000.00',
        stock_quantity: 100,
        minimum_stock: 10,
        expiry_date: '2025-12-31',
        supplier: 'Test Supplier'
      })
      .returning()
      .execute();

    const medicine = medicineResult[0];

    // Create cancelled transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        patient_id: patient.id,
        total_amount: '15000.00',
        payment_method: 'tunai',
        payment_status: 'cancelled',
        notes: 'Test cancelled transaction'
      })
      .returning()
      .execute();

    const transaction = transactionResult[0];

    // Add medicine to transaction
    await db.insert(transactionMedicinesTable)
      .values({
        transaction_id: transaction.id,
        medicine_id: medicine.id,
        quantity: 3,
        price_per_unit: '5000.00',
        total_price: '15000.00'
      })
      .execute();

    // Change status from cancelled to paid
    const result = await updateTransactionStatus(transaction.id, 'paid');

    expect(result.payment_status).toEqual('paid');

    // Check that stock was deducted
    const updatedMedicine = await db.select()
      .from(medicinesTable)
      .where(eq(medicinesTable.id, medicine.id))
      .execute();

    expect(updatedMedicine[0].stock_quantity).toEqual(97); // Stock deducted

    // Check that new stock movement was created
    const stockMovements = await db.select()
      .from(stockMovementsTable)
      .where(eq(stockMovementsTable.reference_id, transaction.id))
      .execute();

    expect(stockMovements).toHaveLength(1);
    expect(stockMovements[0].movement_type).toEqual('keluar');
    expect(stockMovements[0].quantity).toEqual(3);
    expect(stockMovements[0].notes).toContain('Reaktivasi transaksi');
  });

  it('should throw error when transaction not found', async () => {
    expect(updateTransactionStatus(999, 'paid')).rejects.toThrow(/Transaction not found/i);
  });

  it('should throw error when insufficient stock for reactivation', async () => {
    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values({
        name: 'Test Patient',
        date_of_birth: '1990-01-01',
        gender: 'Laki-laki',
        phone: '081234567890',
        address: 'Test Address',
        emergency_contact: '081234567891',
        medical_notes: 'Test notes'
      })
      .returning()
      .execute();

    const patient = patientResult[0];

    // Create test medicine with insufficient stock
    const medicineResult = await db.insert(medicinesTable)
      .values({
        name: 'Test Medicine',
        description: 'Test description',
        unit: 'tablet',
        price_per_unit: '5000.00',
        stock_quantity: 1, // Only 1 in stock
        minimum_stock: 10,
        expiry_date: '2025-12-31',
        supplier: 'Test Supplier'
      })
      .returning()
      .execute();

    const medicine = medicineResult[0];

    // Create cancelled transaction that requires 5 units
    const transactionResult = await db.insert(transactionsTable)
      .values({
        patient_id: patient.id,
        total_amount: '25000.00',
        payment_method: 'tunai',
        payment_status: 'cancelled',
        notes: 'Test cancelled transaction'
      })
      .returning()
      .execute();

    const transaction = transactionResult[0];

    // Add medicine to transaction (requires 5 units but only 1 available)
    await db.insert(transactionMedicinesTable)
      .values({
        transaction_id: transaction.id,
        medicine_id: medicine.id,
        quantity: 5,
        price_per_unit: '5000.00',
        total_price: '25000.00'
      })
      .execute();

    // Try to change status from cancelled to paid (should fail due to insufficient stock)
    expect(updateTransactionStatus(transaction.id, 'paid')).rejects.toThrow(/Insufficient stock/i);
  });
});

describe('addTransactionNotes', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should add notes to transaction', async () => {
    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values({
        name: 'Test Patient',
        date_of_birth: '1990-01-01',
        gender: 'Laki-laki',
        phone: '081234567890',
        address: 'Test Address',
        emergency_contact: '081234567891',
        medical_notes: 'Test notes'
      })
      .returning()
      .execute();

    const patient = patientResult[0];

    // Create test transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        patient_id: patient.id,
        total_amount: '100000.00',
        payment_method: 'tunai',
        payment_status: 'pending',
        notes: null
      })
      .returning()
      .execute();

    const transaction = transactionResult[0];

    // Add notes
    const result = await addTransactionNotes(transaction.id, 'Payment received via bank transfer');

    expect(result.id).toEqual(transaction.id);
    expect(result.notes).toEqual('Payment received via bank transfer');
    expect(result.total_amount).toEqual(100000);
    expect(typeof result.total_amount).toBe('number');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update existing notes', async () => {
    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values({
        name: 'Test Patient',
        date_of_birth: '1990-01-01',
        gender: 'Laki-laki',
        phone: '081234567890',
        address: 'Test Address',
        emergency_contact: '081234567891',
        medical_notes: 'Test notes'
      })
      .returning()
      .execute();

    const patient = patientResult[0];

    // Create test transaction with existing notes
    const transactionResult = await db.insert(transactionsTable)
      .values({
        patient_id: patient.id,
        total_amount: '100000.00',
        payment_method: 'tunai',
        payment_status: 'pending',
        notes: 'Old notes'
      })
      .returning()
      .execute();

    const transaction = transactionResult[0];

    // Update notes
    const result = await addTransactionNotes(transaction.id, 'Updated notes with payment details');

    expect(result.id).toEqual(transaction.id);
    expect(result.notes).toEqual('Updated notes with payment details');
  });

  it('should throw error when transaction not found', async () => {
    expect(addTransactionNotes(999, 'Some notes')).rejects.toThrow(/Transaction not found/i);
  });

  it('should save notes to database', async () => {
    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values({
        name: 'Test Patient',
        date_of_birth: '1990-01-01',
        gender: 'Laki-laki',
        phone: '081234567890',
        address: 'Test Address',
        emergency_contact: '081234567891',
        medical_notes: 'Test notes'
      })
      .returning()
      .execute();

    const patient = patientResult[0];

    // Create test transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        patient_id: patient.id,
        total_amount: '100000.00',
        payment_method: 'tunai',
        payment_status: 'pending',
        notes: null
      })
      .returning()
      .execute();

    const transaction = transactionResult[0];

    // Add notes
    await addTransactionNotes(transaction.id, 'Special payment instructions');

    // Verify notes were saved to database
    const savedTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transaction.id))
      .execute();

    expect(savedTransaction).toHaveLength(1);
    expect(savedTransaction[0].notes).toEqual('Special payment instructions');
    expect(savedTransaction[0].updated_at).toBeInstanceOf(Date);
  });
});