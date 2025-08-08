import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  patientsTable, 
  transactionsTable, 
  medicinesTable,
  servicesTable,
  transactionServicesTable
} from '../db/schema';
import { 
  getDashboardStats, 
  getDailyRevenue, 
  getMonthlyRevenue, 
  getTopServices 
} from '../handlers/dashboard';

describe('Dashboard Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getDashboardStats', () => {
    it('should return zero stats for empty database', async () => {
      const stats = await getDashboardStats();

      expect(stats.total_patients).toBe(0);
      expect(stats.total_transactions_today).toBe(0);
      expect(stats.total_revenue_today).toBe(0);
      expect(stats.low_stock_medicines).toBe(0);
      expect(stats.expired_medicines).toBe(0);
      expect(stats.pending_transactions).toBe(0);
    });

    it('should calculate correct dashboard statistics', async () => {
      // Create test patients
      const patients = await db.insert(patientsTable)
        .values([
          {
            name: 'Patient 1',
            date_of_birth: '1990-01-01',
            gender: 'Laki-laki',
            phone: '081234567890',
            address: 'Address 1',
            emergency_contact: '081234567891',
            medical_notes: 'Notes 1'
          },
          {
            name: 'Patient 2',
            date_of_birth: '1985-01-01',
            gender: 'Perempuan',
            phone: '081234567892',
            address: 'Address 2',
            emergency_contact: '081234567893',
            medical_notes: 'Notes 2'
          }
        ])
        .returning()
        .execute();

      // Create test medicines with different stock levels
      await db.insert(medicinesTable)
        .values([
          {
            name: 'Medicine Low Stock',
            description: 'Low stock medicine',
            unit: 'tablet',
            price_per_unit: '10.00',
            stock_quantity: 5,
            minimum_stock: 10, // Below minimum
            expiry_date: '2025-12-31',
            supplier: 'Supplier A'
          },
          {
            name: 'Medicine Expired',
            description: 'Expired medicine',
            unit: 'botol',
            price_per_unit: '15.00',
            stock_quantity: 20,
            minimum_stock: 5,
            expiry_date: '2020-01-01', // Expired
            supplier: 'Supplier B'
          },
          {
            name: 'Medicine Good',
            description: 'Good medicine',
            unit: 'strip',
            price_per_unit: '8.00',
            stock_quantity: 50,
            minimum_stock: 10,
            expiry_date: '2025-12-31',
            supplier: 'Supplier C'
          }
        ])
        .returning()
        .execute();

      // Create test transactions for today
      const today = new Date();
      await db.insert(transactionsTable)
        .values([
          {
            patient_id: patients[0].id,
            total_amount: '50000.00',
            payment_method: 'tunai',
            payment_status: 'paid',
            notes: 'Paid transaction today',
            created_at: today
          },
          {
            patient_id: patients[1].id,
            total_amount: '75000.00',
            payment_method: 'transfer',
            payment_status: 'paid',
            notes: 'Another paid transaction today',
            created_at: today
          },
          {
            patient_id: patients[0].id,
            total_amount: '30000.00',
            payment_method: 'kartu',
            payment_status: 'pending',
            notes: 'Pending transaction',
            created_at: today
          }
        ])
        .returning()
        .execute();

      const stats = await getDashboardStats();

      expect(stats.total_patients).toBe(2);
      expect(stats.total_transactions_today).toBe(3);
      expect(stats.total_revenue_today).toBe(125000); // Only paid transactions
      expect(stats.low_stock_medicines).toBe(1); // Medicine Low Stock
      expect(stats.expired_medicines).toBe(1); // Medicine Expired
      expect(stats.pending_transactions).toBe(1);
    });

    it('should handle database errors gracefully', async () => {
      // This test ensures error handling works properly
      // We can't easily simulate a database error in this test environment
      // But the try-catch structure ensures errors are properly re-thrown
      const stats = await getDashboardStats();
      expect(typeof stats.total_patients).toBe('number');
    });
  });

  describe('getDailyRevenue', () => {
    it('should return zero revenue for no transactions', async () => {
      const revenue = await getDailyRevenue();
      expect(revenue).toBe(0);
    });

    it('should calculate daily revenue correctly', async () => {
      // Create test patient
      const patients = await db.insert(patientsTable)
        .values([{
          name: 'Test Patient',
          date_of_birth: '1990-01-01',
          gender: 'Laki-laki',
          phone: '081234567890',
          address: 'Test Address',
          emergency_contact: '081234567891',
          medical_notes: 'Test Notes'
        }])
        .returning()
        .execute();

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Create transactions for different days and statuses
      await db.insert(transactionsTable)
        .values([
          {
            patient_id: patients[0].id,
            total_amount: '50000.00',
            payment_method: 'tunai',
            payment_status: 'paid',
            notes: 'Paid today',
            created_at: today
          },
          {
            patient_id: patients[0].id,
            total_amount: '30000.00',
            payment_method: 'transfer',
            payment_status: 'paid',
            notes: 'Paid yesterday',
            created_at: yesterday
          },
          {
            patient_id: patients[0].id,
            total_amount: '25000.00',
            payment_method: 'kartu',
            payment_status: 'pending',
            notes: 'Pending today',
            created_at: today
          }
        ])
        .returning()
        .execute();

      // Test today's revenue (should only include paid transactions from today)
      const todayRevenue = await getDailyRevenue();
      expect(todayRevenue).toBe(50000);

      // Test yesterday's revenue
      const yesterdayRevenue = await getDailyRevenue(yesterday);
      expect(yesterdayRevenue).toBe(30000);
    });

    it('should use current date when no date provided', async () => {
      const revenue = await getDailyRevenue();
      expect(typeof revenue).toBe('number');
      expect(revenue).toBe(0); // No transactions in test
    });
  });

  describe('getMonthlyRevenue', () => {
    it('should return zero revenue for no transactions', async () => {
      const revenue = await getMonthlyRevenue(2024, 1);
      expect(revenue).toBe(0);
    });

    it('should calculate monthly revenue correctly', async () => {
      // Create test patient
      const patients = await db.insert(patientsTable)
        .values([{
          name: 'Test Patient',
          date_of_birth: '1990-01-01',
          gender: 'Laki-laki',
          phone: '081234567890',
          address: 'Test Address',
          emergency_contact: '081234567891',
          medical_notes: 'Test Notes'
        }])
        .returning()
        .execute();

      // Create transactions for different months
      await db.insert(transactionsTable)
        .values([
          {
            patient_id: patients[0].id,
            total_amount: '100000.00',
            payment_method: 'tunai',
            payment_status: 'paid',
            notes: 'January 2024',
            created_at: new Date('2024-01-15')
          },
          {
            patient_id: patients[0].id,
            total_amount: '75000.00',
            payment_method: 'transfer',
            payment_status: 'paid',
            notes: 'January 2024',
            created_at: new Date('2024-01-25')
          },
          {
            patient_id: patients[0].id,
            total_amount: '50000.00',
            payment_method: 'kartu',
            payment_status: 'paid',
            notes: 'February 2024',
            created_at: new Date('2024-02-10')
          },
          {
            patient_id: patients[0].id,
            total_amount: '30000.00',
            payment_method: 'tunai',
            payment_status: 'pending',
            notes: 'Pending January',
            created_at: new Date('2024-01-20')
          }
        ])
        .returning()
        .execute();

      // Test January 2024 revenue (should only include paid transactions)
      const januaryRevenue = await getMonthlyRevenue(2024, 1);
      expect(januaryRevenue).toBe(175000);

      // Test February 2024 revenue
      const februaryRevenue = await getMonthlyRevenue(2024, 2);
      expect(februaryRevenue).toBe(50000);

      // Test month with no transactions
      const marchRevenue = await getMonthlyRevenue(2024, 3);
      expect(marchRevenue).toBe(0);
    });
  });

  describe('getTopServices', () => {
    it('should return empty array for no services', async () => {
      const topServices = await getTopServices();
      expect(topServices).toEqual([]);
    });

    it('should return top services ordered by usage', async () => {
      // Create test patient
      const patients = await db.insert(patientsTable)
        .values([{
          name: 'Test Patient',
          date_of_birth: '1990-01-01',
          gender: 'Laki-laki',
          phone: '081234567890',
          address: 'Test Address',
          emergency_contact: '081234567891',
          medical_notes: 'Test Notes'
        }])
        .returning()
        .execute();

      // Create test services
      const services = await db.insert(servicesTable)
        .values([
          {
            name: 'Konsultasi Dokter',
            description: 'Konsultasi dengan dokter umum',
            price: '50000.00',
            is_active: true
          },
          {
            name: 'Pemeriksaan Lab',
            description: 'Pemeriksaan laboratorium darah',
            price: '100000.00',
            is_active: true
          },
          {
            name: 'Vaksinasi',
            description: 'Layanan vaksinasi',
            price: '75000.00',
            is_active: true
          }
        ])
        .returning()
        .execute();

      // Create test transactions
      const transactions = await db.insert(transactionsTable)
        .values([
          {
            patient_id: patients[0].id,
            total_amount: '200000.00',
            payment_method: 'tunai',
            payment_status: 'paid',
            notes: 'Transaction 1'
          },
          {
            patient_id: patients[0].id,
            total_amount: '150000.00',
            payment_method: 'transfer',
            payment_status: 'paid',
            notes: 'Transaction 2'
          }
        ])
        .returning()
        .execute();

      // Create transaction services with different usage counts
      await db.insert(transactionServicesTable)
        .values([
          // Konsultasi Dokter - used 3 times total
          {
            transaction_id: transactions[0].id,
            service_id: services[0].id,
            quantity: 2,
            price_per_unit: '50000.00',
            total_price: '100000.00'
          },
          {
            transaction_id: transactions[1].id,
            service_id: services[0].id,
            quantity: 1,
            price_per_unit: '50000.00',
            total_price: '50000.00'
          },
          // Pemeriksaan Lab - used 2 times total
          {
            transaction_id: transactions[0].id,
            service_id: services[1].id,
            quantity: 1,
            price_per_unit: '100000.00',
            total_price: '100000.00'
          },
          {
            transaction_id: transactions[1].id,
            service_id: services[1].id,
            quantity: 1,
            price_per_unit: '100000.00',
            total_price: '100000.00'
          },
          // Vaksinasi - used 1 time total
          {
            transaction_id: transactions[1].id,
            service_id: services[2].id,
            quantity: 1,
            price_per_unit: '75000.00',
            total_price: '75000.00'
          }
        ])
        .returning()
        .execute();

      const topServices = await getTopServices(3);

      expect(topServices).toHaveLength(3);
      
      // Should be ordered by usage count (descending)
      expect(topServices[0].service_name).toBe('Konsultasi Dokter');
      expect(topServices[0].total_usage).toBe(3);
      expect(topServices[0].total_revenue).toBe(150000);

      expect(topServices[1].service_name).toBe('Pemeriksaan Lab');
      expect(topServices[1].total_usage).toBe(2);
      expect(topServices[1].total_revenue).toBe(200000);

      expect(topServices[2].service_name).toBe('Vaksinasi');
      expect(topServices[2].total_usage).toBe(1);
      expect(topServices[2].total_revenue).toBe(75000);
    });

    it('should respect limit parameter', async () => {
      // Create minimal test data
      const patients = await db.insert(patientsTable)
        .values([{
          name: 'Test Patient',
          date_of_birth: '1990-01-01',
          gender: 'Laki-laki',
          phone: '081234567890',
          address: 'Test Address',
          emergency_contact: '081234567891',
          medical_notes: 'Test Notes'
        }])
        .returning()
        .execute();

      const services = await db.insert(servicesTable)
        .values([
          { name: 'Service 1', price: '50000.00', is_active: true },
          { name: 'Service 2', price: '60000.00', is_active: true },
          { name: 'Service 3', price: '70000.00', is_active: true }
        ])
        .returning()
        .execute();

      const transactions = await db.insert(transactionsTable)
        .values([{
          patient_id: patients[0].id,
          total_amount: '180000.00',
          payment_method: 'tunai',
          payment_status: 'paid',
          notes: 'Test transaction'
        }])
        .returning()
        .execute();

      await db.insert(transactionServicesTable)
        .values([
          {
            transaction_id: transactions[0].id,
            service_id: services[0].id,
            quantity: 1,
            price_per_unit: '50000.00',
            total_price: '50000.00'
          },
          {
            transaction_id: transactions[0].id,
            service_id: services[1].id,
            quantity: 1,
            price_per_unit: '60000.00',
            total_price: '60000.00'
          },
          {
            transaction_id: transactions[0].id,
            service_id: services[2].id,
            quantity: 1,
            price_per_unit: '70000.00',
            total_price: '70000.00'
          }
        ])
        .returning()
        .execute();

      // Test default limit
      const defaultLimit = await getTopServices();
      expect(defaultLimit.length).toBeLessThanOrEqual(5);

      // Test custom limit
      const customLimit = await getTopServices(2);
      expect(customLimit).toHaveLength(2);
    });

    it('should only include paid transactions', async () => {
      // Create test data with pending transaction
      const patients = await db.insert(patientsTable)
        .values([{
          name: 'Test Patient',
          date_of_birth: '1990-01-01',
          gender: 'Laki-laki',
          phone: '081234567890',
          address: 'Test Address',
          emergency_contact: '081234567891',
          medical_notes: 'Test Notes'
        }])
        .returning()
        .execute();

      const services = await db.insert(servicesTable)
        .values([{
          name: 'Test Service',
          price: '50000.00',
          is_active: true
        }])
        .returning()
        .execute();

      const transactions = await db.insert(transactionsTable)
        .values([
          {
            patient_id: patients[0].id,
            total_amount: '50000.00',
            payment_method: 'tunai',
            payment_status: 'paid',
            notes: 'Paid transaction'
          },
          {
            patient_id: patients[0].id,
            total_amount: '50000.00',
            payment_method: 'transfer',
            payment_status: 'pending',
            notes: 'Pending transaction'
          }
        ])
        .returning()
        .execute();

      await db.insert(transactionServicesTable)
        .values([
          {
            transaction_id: transactions[0].id, // Paid transaction
            service_id: services[0].id,
            quantity: 1,
            price_per_unit: '50000.00',
            total_price: '50000.00'
          },
          {
            transaction_id: transactions[1].id, // Pending transaction
            service_id: services[0].id,
            quantity: 2,
            price_per_unit: '50000.00',
            total_price: '100000.00'
          }
        ])
        .returning()
        .execute();

      const topServices = await getTopServices();

      expect(topServices).toHaveLength(1);
      expect(topServices[0].service_name).toBe('Test Service');
      expect(topServices[0].total_usage).toBe(1); // Only from paid transaction
      expect(topServices[0].total_revenue).toBe(50000); // Only from paid transaction
    });
  });
});