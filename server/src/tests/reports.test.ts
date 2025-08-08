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
  stockMovementsTable,
  settingsTable
} from '../db/schema';
import { type ReportInput } from '../schema';
import {
  generateSalesReport,
  generateInventoryReport,
  generatePatientReport,
  generateReceiptData
} from '../handlers/reports';

describe('Reports Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('generateSalesReport', () => {
    it('should generate sales report with transaction data', async () => {
      // Create test patient
      const patient = await db.insert(patientsTable)
        .values({
          name: 'Test Patient',
          date_of_birth: '1990-01-01',
          gender: 'Laki-laki',
          phone: '081234567890',
          address: 'Test Address',
          emergency_contact: 'Emergency Contact',
          medical_notes: 'Test notes'
        })
        .returning()
        .execute();

      // Create test service
      const service = await db.insert(servicesTable)
        .values({
          name: 'Test Service',
          description: 'Test description',
          price: '50000',
          is_active: true
        })
        .returning()
        .execute();

      // Create test medicine
      const medicine = await db.insert(medicinesTable)
        .values({
          name: 'Test Medicine',
          description: 'Test medicine description',
          unit: 'tablet',
          price_per_unit: '10000',
          stock_quantity: 100,
          minimum_stock: 10,
          expiry_date: '2025-12-31',
          supplier: 'Test Supplier'
        })
        .returning()
        .execute();

      // Create test transaction
      const transaction = await db.insert(transactionsTable)
        .values({
          patient_id: patient[0].id,
          total_amount: '75000',
          payment_method: 'tunai',
          payment_status: 'paid',
          notes: 'Test transaction'
        })
        .returning()
        .execute();

      // Create transaction service
      await db.insert(transactionServicesTable)
        .values({
          transaction_id: transaction[0].id,
          service_id: service[0].id,
          quantity: 1,
          price_per_unit: '50000',
          total_price: '50000'
        })
        .execute();

      // Create transaction medicine
      await db.insert(transactionMedicinesTable)
        .values({
          transaction_id: transaction[0].id,
          medicine_id: medicine[0].id,
          quantity: 5,
          price_per_unit: '5000',
          total_price: '25000'
        })
        .execute();

      // Use a wider date range that will definitely include our test data
      const reportInput: ReportInput = {
        type: 'sales',
        start_date: new Date('2020-01-01'),
        end_date: new Date('2030-12-31'),
        format: 'pdf'
      };

      const result = await generateSalesReport(reportInput);
      expect(result).toBeInstanceOf(Buffer);

      const reportData = JSON.parse(result.toString());
      expect(reportData.summary.total_transactions).toBe(1);
      expect(reportData.summary.total_revenue).toBe(75000);
      expect(reportData.service_revenue).toHaveLength(1);
      expect(reportData.service_revenue[0].service_name).toBe('Test Service');
      expect(reportData.medicine_revenue).toHaveLength(1);
      expect(reportData.medicine_revenue[0].medicine_name).toBe('Test Medicine');
      expect(reportData.payment_methods).toHaveLength(1);
      expect(reportData.payment_methods[0].payment_method).toBe('tunai');
    });

    it('should return excel format when requested', async () => {
      // Use a wider date range that will definitely include our test data
      const reportInput: ReportInput = {
        type: 'sales',
        start_date: new Date('2020-01-01'),
        end_date: new Date('2030-12-31'),
        format: 'excel'
      };

      const result = await generateSalesReport(reportInput);
      expect(typeof result).toBe('string');

      const reportData = JSON.parse(result as string);
      expect(reportData.period.start_date).toEqual(reportInput.start_date.toISOString());
      expect(reportData.period.end_date).toEqual(reportInput.end_date.toISOString());
    });

    it('should handle empty data gracefully', async () => {
      const reportInput: ReportInput = {
        type: 'sales',
        start_date: new Date('2025-01-01'),
        end_date: new Date('2025-12-31'),
        format: 'pdf'
      };

      const result = await generateSalesReport(reportInput);
      expect(result).toBeInstanceOf(Buffer);

      const reportData = JSON.parse(result.toString());
      expect(reportData.summary.total_transactions).toBe(0);
      expect(reportData.summary.total_revenue).toBe(0);
      expect(reportData.service_revenue).toHaveLength(0);
      expect(reportData.medicine_revenue).toHaveLength(0);
    });
  });

  describe('generateInventoryReport', () => {
    it('should generate inventory report with stock data', async () => {
      // Create test medicines
      const medicine1 = await db.insert(medicinesTable)
        .values({
          name: 'Medicine A',
          description: 'Description A',
          unit: 'tablet',
          price_per_unit: '5000',
          stock_quantity: 50,
          minimum_stock: 10,
          expiry_date: '2025-12-31',
          supplier: 'Supplier A'
        })
        .returning()
        .execute();

      const medicine2 = await db.insert(medicinesTable)
        .values({
          name: 'Medicine B',
          description: 'Description B',
          unit: 'botol',
          price_per_unit: '15000',
          stock_quantity: 5, // Low stock
          minimum_stock: 10,
          expiry_date: '2023-12-31', // Expired
          supplier: 'Supplier B'
        })
        .returning()
        .execute();

      // Create stock movements
      await db.insert(stockMovementsTable)
        .values({
          medicine_id: medicine1[0].id,
          movement_type: 'masuk',
          quantity: 100,
          notes: 'Initial stock'
        })
        .execute();

      await db.insert(stockMovementsTable)
        .values({
          medicine_id: medicine1[0].id,
          movement_type: 'keluar',
          quantity: 50,
          notes: 'Sale'
        })
        .execute();

      // Use a wider date range that will definitely include our test data
      const reportInput: ReportInput = {
        type: 'inventory',
        start_date: new Date('2020-01-01'),
        end_date: new Date('2030-12-31'),
        format: 'pdf'
      };

      const result = await generateInventoryReport(reportInput);
      expect(result).toBeInstanceOf(Buffer);

      const reportData = JSON.parse(result.toString());
      expect(reportData.summary.total_medicines).toBe(2);
      expect(reportData.summary.low_stock_count).toBe(1);
      expect(reportData.summary.expired_count).toBe(1);
      expect(reportData.current_stock).toHaveLength(2);
      
      // Check stock calculations
      const stockA = reportData.current_stock.find((item: any) => item.name === 'Medicine A');
      expect(stockA.stock_value).toBe(250000); // 50 * 5000
      expect(stockA.is_low_stock).toBe(false);
      expect(stockA.is_expired).toBe(false);

      const stockB = reportData.current_stock.find((item: any) => item.name === 'Medicine B');
      expect(stockB.is_low_stock).toBe(true);
      expect(stockB.is_expired).toBe(true);

      expect(reportData.stock_movements).toHaveLength(2);
      expect(reportData.alerts.low_stock_medicines).toHaveLength(1);
      expect(reportData.alerts.expired_medicines).toHaveLength(1);
    });

    it('should calculate total stock value correctly', async () => {
      await db.insert(medicinesTable)
        .values({
          name: 'Expensive Medicine',
          description: 'High value medicine',
          unit: 'vial',
          price_per_unit: '100000',
          stock_quantity: 10,
          minimum_stock: 5,
          expiry_date: '2025-12-31',
          supplier: 'Premium Supplier'
        })
        .execute();

      // Use a wider date range that will definitely include our test data
      const reportInput: ReportInput = {
        type: 'inventory',
        start_date: new Date('2020-01-01'),
        end_date: new Date('2030-12-31'),
        format: 'pdf'
      };

      const result = await generateInventoryReport(reportInput);
      const reportData = JSON.parse(result.toString());
      
      expect(reportData.summary.total_stock_value).toBe(1000000); // 10 * 100000
    });
  });

  describe('generatePatientReport', () => {
    it('should generate patient report with demographic data', async () => {
      // Create test patients
      const patient1 = await db.insert(patientsTable)
        .values({
          name: 'Patient A',
          date_of_birth: '1990-01-01',
          gender: 'Laki-laki',
          phone: '081234567890',
          address: 'Address A',
          emergency_contact: 'Contact A',
          medical_notes: 'Notes A'
        })
        .returning()
        .execute();

      const patient2 = await db.insert(patientsTable)
        .values({
          name: 'Patient B',
          date_of_birth: '2000-01-01',
          gender: 'Perempuan',
          phone: '081234567891',
          address: 'Address B',
          emergency_contact: 'Contact B',
          medical_notes: 'Notes B'
        })
        .returning()
        .execute();

      // Create patient visits
      await db.insert(patientVisitsTable)
        .values({
          patient_id: patient1[0].id,
          visit_date: new Date('2024-06-01'),
          diagnosis: 'Common Cold',
          treatment: 'Rest and medication',
          notes: 'Regular checkup'
        })
        .execute();

      await db.insert(patientVisitsTable)
        .values({
          patient_id: patient1[0].id,
          visit_date: new Date('2024-07-01'),
          diagnosis: 'Follow-up',
          treatment: 'Continued medication',
          notes: 'Improvement noted'
        })
        .execute();

      await db.insert(patientVisitsTable)
        .values({
          patient_id: patient2[0].id,
          visit_date: new Date('2024-06-15'),
          diagnosis: 'Common Cold',
          treatment: 'Medication',
          notes: 'First visit'
        })
        .execute();

      // Use a wider date range that will definitely include our test data
      const reportInput: ReportInput = {
        type: 'patients',
        start_date: new Date('2020-01-01'),
        end_date: new Date('2030-12-31'),
        format: 'pdf'
      };

      const result = await generatePatientReport(reportInput);
      expect(result).toBeInstanceOf(Buffer);

      const reportData = JSON.parse(result.toString());
      expect(reportData.summary.new_patients).toBe(2);
      expect(reportData.summary.total_visits).toBe(3);
      
      expect(reportData.visit_frequency).toHaveLength(2);
      const patientAVisits = reportData.visit_frequency.find((item: any) => item.patient_name === 'Patient A');
      expect(patientAVisits.visit_count).toBe(2);

      expect(reportData.common_diagnoses).toHaveLength(2);
      const commonCold = reportData.common_diagnoses.find((item: any) => item.diagnosis === 'Common Cold');
      expect(commonCold.count).toBe(2);

      expect(reportData.demographics.gender_distribution).toHaveLength(2);
      expect(reportData.demographics.age_distribution.length).toBeGreaterThan(0);
    });
  });

  describe('generateReceiptData', () => {
    it('should generate receipt data for transaction', async () => {
      // Create clinic settings
      await db.insert(settingsTable)
        .values([
          {
            key: 'clinic_name',
            value: 'Test Clinic',
            description: 'Clinic name'
          },
          {
            key: 'clinic_address',
            value: 'Test Address',
            description: 'Clinic address'
          },
          {
            key: 'clinic_phone',
            value: '021-1234567',
            description: 'Clinic phone'
          }
        ])
        .execute();

      // Create test patient
      const patient = await db.insert(patientsTable)
        .values({
          name: 'Receipt Patient',
          date_of_birth: '1995-01-01',
          gender: 'Laki-laki',
          phone: '081234567890',
          address: 'Patient Address',
          emergency_contact: 'Emergency Contact',
          medical_notes: 'Patient notes'
        })
        .returning()
        .execute();

      // Create test service and medicine
      const service = await db.insert(servicesTable)
        .values({
          name: 'Circumcision Service',
          description: 'Professional circumcision',
          price: '500000',
          is_active: true
        })
        .returning()
        .execute();

      const medicine = await db.insert(medicinesTable)
        .values({
          name: 'Antibiotics',
          description: 'Post-surgery antibiotics',
          unit: 'tablet',
          price_per_unit: '5000',
          stock_quantity: 100,
          minimum_stock: 10,
          expiry_date: '2025-12-31',
          supplier: 'Medical Supplier'
        })
        .returning()
        .execute();

      // Create transaction
      const transaction = await db.insert(transactionsTable)
        .values({
          patient_id: patient[0].id,
          total_amount: '525000',
          payment_method: 'tunai',
          payment_status: 'paid',
          notes: 'Complete service package'
        })
        .returning()
        .execute();

      // Create transaction items
      await db.insert(transactionServicesTable)
        .values({
          transaction_id: transaction[0].id,
          service_id: service[0].id,
          quantity: 1,
          price_per_unit: '500000',
          total_price: '500000'
        })
        .execute();

      await db.insert(transactionMedicinesTable)
        .values({
          transaction_id: transaction[0].id,
          medicine_id: medicine[0].id,
          quantity: 5,
          price_per_unit: '5000',
          total_price: '25000'
        })
        .execute();

      const result = await generateReceiptData(transaction[0].id);

      expect(result.clinic_info.name).toBe('Test Clinic');
      expect(result.clinic_info.address).toBe('Test Address');
      expect(result.clinic_info.phone).toBe('021-1234567');

      expect(result.transaction.id).toBe(transaction[0].id);
      expect(result.transaction.total_amount).toBe(525000);
      expect(result.transaction.payment_method).toBe('tunai');

      expect(result.patient.name).toBe('Receipt Patient');
      expect(result.patient.phone).toBe('081234567890');

      expect(result.items).toHaveLength(2);
      
      const serviceItem = result.items.find((item: any) => item.type === 'service');
      expect(serviceItem.name).toBe('Circumcision Service');
      expect(serviceItem.quantity).toBe(1);
      expect(serviceItem.total_price).toBe(500000);

      const medicineItem = result.items.find((item: any) => item.type === 'medicine');
      expect(medicineItem.name).toBe('Antibiotics');
      expect(medicineItem.quantity).toBe(5);
      expect(medicineItem.unit).toBe('tablet');
      expect(medicineItem.total_price).toBe(25000);

      expect(result.footer_message).toBe('Terima kasih atas kepercayaan Anda!');
    });

    it('should throw error for non-existent transaction', async () => {
      await expect(generateReceiptData(99999)).rejects.toThrow('Transaction with ID 99999 not found');
    });

    it('should use default clinic name when settings not found', async () => {
      // Create minimal test data without settings
      const patient = await db.insert(patientsTable)
        .values({
          name: 'Test Patient',
          date_of_birth: '1995-01-01',
          gender: 'Laki-laki',
          phone: '081234567890',
          address: 'Test Address',
          emergency_contact: 'Emergency Contact',
          medical_notes: 'Test notes'
        })
        .returning()
        .execute();

      const transaction = await db.insert(transactionsTable)
        .values({
          patient_id: patient[0].id,
          total_amount: '100000',
          payment_method: 'tunai',
          payment_status: 'paid',
          notes: 'Test transaction'
        })
        .returning()
        .execute();

      const result = await generateReceiptData(transaction[0].id);
      expect(result.clinic_info.name).toBe('Rumah Khitan Super Modern Pak Nopi');
      expect(result.items).toHaveLength(0); // No service/medicine items
    });
  });
});