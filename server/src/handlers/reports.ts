import { db } from '../db';
import {
  transactionsTable,
  transactionServicesTable,
  transactionMedicinesTable,
  patientsTable,
  servicesTable,
  medicinesTable,
  patientVisitsTable,
  stockMovementsTable,
  settingsTable
} from '../db/schema';
import { type ReportInput } from '../schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';

export async function generateSalesReport(input: ReportInput): Promise<Buffer | string> {
  try {
    // Get transaction summary for date range
    const transactionSummary = await db
      .select({
        total_transactions: sql<number>`count(*)::integer`,
        total_revenue: sql<string>`coalesce(sum(${transactionsTable.total_amount}), 0)`,
        avg_transaction_value: sql<string>`coalesce(avg(${transactionsTable.total_amount}), 0)`
      })
      .from(transactionsTable)
      .where(
        and(
          gte(transactionsTable.created_at, input.start_date),
          lte(transactionsTable.created_at, input.end_date),
          eq(transactionsTable.payment_status, 'paid')
        )
      )
      .execute();

    // Get revenue breakdown by services
    const serviceRevenue = await db
      .select({
        service_name: servicesTable.name,
        total_quantity: sql<number>`sum(${transactionServicesTable.quantity})::integer`,
        total_revenue: sql<string>`sum(${transactionServicesTable.total_price})`
      })
      .from(transactionServicesTable)
      .innerJoin(servicesTable, eq(transactionServicesTable.service_id, servicesTable.id))
      .innerJoin(transactionsTable, eq(transactionServicesTable.transaction_id, transactionsTable.id))
      .where(
        and(
          gte(transactionsTable.created_at, input.start_date),
          lte(transactionsTable.created_at, input.end_date),
          eq(transactionsTable.payment_status, 'paid')
        )
      )
      .groupBy(servicesTable.id, servicesTable.name)
      .orderBy(desc(sql`sum(${transactionServicesTable.total_price})`))
      .execute();

    // Get revenue breakdown by medicines
    const medicineRevenue = await db
      .select({
        medicine_name: medicinesTable.name,
        total_quantity: sql<number>`sum(${transactionMedicinesTable.quantity})::integer`,
        total_revenue: sql<string>`sum(${transactionMedicinesTable.total_price})`
      })
      .from(transactionMedicinesTable)
      .innerJoin(medicinesTable, eq(transactionMedicinesTable.medicine_id, medicinesTable.id))
      .innerJoin(transactionsTable, eq(transactionMedicinesTable.transaction_id, transactionsTable.id))
      .where(
        and(
          gte(transactionsTable.created_at, input.start_date),
          lte(transactionsTable.created_at, input.end_date),
          eq(transactionsTable.payment_status, 'paid')
        )
      )
      .groupBy(medicinesTable.id, medicinesTable.name)
      .orderBy(desc(sql`sum(${transactionMedicinesTable.total_price})`))
      .execute();

    // Get payment method distribution
    const paymentMethods = await db
      .select({
        payment_method: transactionsTable.payment_method,
        count: sql<number>`count(*)::integer`,
        total_amount: sql<string>`sum(${transactionsTable.total_amount})`
      })
      .from(transactionsTable)
      .where(
        and(
          gte(transactionsTable.created_at, input.start_date),
          lte(transactionsTable.created_at, input.end_date),
          eq(transactionsTable.payment_status, 'paid')
        )
      )
      .groupBy(transactionsTable.payment_method)
      .execute();

    // Get daily trends
    const dailyTrends = await db
      .select({
        date: sql<string>`date(${transactionsTable.created_at})`,
        transaction_count: sql<number>`count(*)::integer`,
        daily_revenue: sql<string>`sum(${transactionsTable.total_amount})`
      })
      .from(transactionsTable)
      .where(
        and(
          gte(transactionsTable.created_at, input.start_date),
          lte(transactionsTable.created_at, input.end_date),
          eq(transactionsTable.payment_status, 'paid')
        )
      )
      .groupBy(sql`date(${transactionsTable.created_at})`)
      .orderBy(sql`date(${transactionsTable.created_at})`)
      .execute();

    const reportData = {
      period: {
        start_date: input.start_date,
        end_date: input.end_date
      },
      summary: {
        total_transactions: transactionSummary[0]?.total_transactions || 0,
        total_revenue: parseFloat(transactionSummary[0]?.total_revenue || '0'),
        avg_transaction_value: parseFloat(transactionSummary[0]?.avg_transaction_value || '0')
      },
      service_revenue: serviceRevenue.map(item => ({
        service_name: item.service_name,
        total_quantity: item.total_quantity,
        total_revenue: parseFloat(item.total_revenue)
      })),
      medicine_revenue: medicineRevenue.map(item => ({
        medicine_name: item.medicine_name,
        total_quantity: item.total_quantity,
        total_revenue: parseFloat(item.total_revenue)
      })),
      payment_methods: paymentMethods.map(item => ({
        payment_method: item.payment_method,
        count: item.count,
        total_amount: parseFloat(item.total_amount)
      })),
      daily_trends: dailyTrends.map(item => ({
        date: item.date,
        transaction_count: item.transaction_count,
        daily_revenue: parseFloat(item.daily_revenue)
      }))
    };

    // For this implementation, return JSON data as string
    // In production, this would generate actual PDF/Excel files
    if (input.format === 'excel') {
      return JSON.stringify(reportData, null, 2);
    } else {
      return Buffer.from(JSON.stringify(reportData, null, 2));
    }
  } catch (error) {
    console.error('Sales report generation failed:', error);
    throw error;
  }
}

export async function generateInventoryReport(input: ReportInput): Promise<Buffer | string> {
  try {
    // Get current stock levels for all medicines
    const currentStock = await db
      .select({
        id: medicinesTable.id,
        name: medicinesTable.name,
        unit: medicinesTable.unit,
        current_stock: medicinesTable.stock_quantity,
        minimum_stock: medicinesTable.minimum_stock,
        price_per_unit: medicinesTable.price_per_unit,
        expiry_date: medicinesTable.expiry_date,
        supplier: medicinesTable.supplier
      })
      .from(medicinesTable)
      .orderBy(medicinesTable.name)
      .execute();

    // Get stock movements during the date range
    const stockMovements = await db
      .select({
        medicine_name: medicinesTable.name,
        movement_type: stockMovementsTable.movement_type,
        quantity: stockMovementsTable.quantity,
        notes: stockMovementsTable.notes,
        created_at: stockMovementsTable.created_at
      })
      .from(stockMovementsTable)
      .innerJoin(medicinesTable, eq(stockMovementsTable.medicine_id, medicinesTable.id))
      .where(
        and(
          gte(stockMovementsTable.created_at, input.start_date),
          lte(stockMovementsTable.created_at, input.end_date)
        )
      )
      .orderBy(desc(stockMovementsTable.created_at))
      .execute();

    // Calculate stock value
    const stockValue = await db
      .select({
        total_stock_value: sql<string>`sum(${medicinesTable.stock_quantity} * ${medicinesTable.price_per_unit})`
      })
      .from(medicinesTable)
      .execute();

    // Get low stock medicines
    const lowStockMedicines = currentStock.filter(
      medicine => medicine.current_stock <= medicine.minimum_stock
    );

    // Get expired medicines
    const now = new Date();
    const expiredMedicines = currentStock.filter(
      medicine => medicine.expiry_date && new Date(medicine.expiry_date) < now
    );

    const reportData = {
      period: {
        start_date: input.start_date,
        end_date: input.end_date
      },
      summary: {
        total_medicines: currentStock.length,
        total_stock_value: parseFloat(stockValue[0]?.total_stock_value || '0'),
        low_stock_count: lowStockMedicines.length,
        expired_count: expiredMedicines.length
      },
      current_stock: currentStock.map(item => ({
        id: item.id,
        name: item.name,
        unit: item.unit,
        current_stock: item.current_stock,
        minimum_stock: item.minimum_stock,
        price_per_unit: parseFloat(item.price_per_unit),
        expiry_date: item.expiry_date,
        supplier: item.supplier,
        stock_value: item.current_stock * parseFloat(item.price_per_unit),
        is_low_stock: item.current_stock <= item.minimum_stock,
        is_expired: item.expiry_date ? new Date(item.expiry_date) < now : false
      })),
      stock_movements: stockMovements.map(item => ({
        medicine_name: item.medicine_name,
        movement_type: item.movement_type,
        quantity: item.quantity,
        notes: item.notes,
        created_at: item.created_at
      })),
      alerts: {
        low_stock_medicines: lowStockMedicines.map(item => ({
          name: item.name,
          current_stock: item.current_stock,
          minimum_stock: item.minimum_stock
        })),
        expired_medicines: expiredMedicines.map(item => ({
          name: item.name,
          expiry_date: item.expiry_date,
          current_stock: item.current_stock
        }))
      }
    };

    // For this implementation, return JSON data as string
    // In production, this would generate actual PDF/Excel files
    if (input.format === 'excel') {
      return JSON.stringify(reportData, null, 2);
    } else {
      return Buffer.from(JSON.stringify(reportData, null, 2));
    }
  } catch (error) {
    console.error('Inventory report generation failed:', error);
    throw error;
  }
}

export async function generatePatientReport(input: ReportInput): Promise<Buffer | string> {
  try {
    // Get new patient registrations in date range
    const newPatients = await db
      .select({
        count: sql<number>`count(*)::integer`
      })
      .from(patientsTable)
      .where(
        and(
          gte(patientsTable.created_at, input.start_date),
          lte(patientsTable.created_at, input.end_date)
        )
      )
      .execute();

    // Get patient visit frequency
    const visitFrequency = await db
      .select({
        patient_name: patientsTable.name,
        visit_count: sql<number>`count(${patientVisitsTable.id})::integer`,
        last_visit: sql<Date>`max(${patientVisitsTable.visit_date})`
      })
      .from(patientsTable)
      .leftJoin(patientVisitsTable, eq(patientsTable.id, patientVisitsTable.patient_id))
      .where(
        and(
          gte(patientVisitsTable.visit_date, input.start_date),
          lte(patientVisitsTable.visit_date, input.end_date)
        )
      )
      .groupBy(patientsTable.id, patientsTable.name)
      .orderBy(desc(sql`count(${patientVisitsTable.id})`))
      .execute();

    // Get most common diagnoses
    const commonDiagnoses = await db
      .select({
        diagnosis: patientVisitsTable.diagnosis,
        count: sql<number>`count(*)::integer`
      })
      .from(patientVisitsTable)
      .where(
        and(
          gte(patientVisitsTable.visit_date, input.start_date),
          lte(patientVisitsTable.visit_date, input.end_date),
          sql`${patientVisitsTable.diagnosis} IS NOT NULL`
        )
      )
      .groupBy(patientVisitsTable.diagnosis)
      .orderBy(desc(sql`count(*)`))
      .limit(10)
      .execute();

    // Get patient demographics
    const demographics = await db
      .select({
        gender: patientsTable.gender,
        count: sql<number>`count(*)::integer`
      })
      .from(patientsTable)
      .groupBy(patientsTable.gender)
      .execute();

    // Get age distribution (approximate)
    const ageDistribution = await db
      .select({
        age_group: sql<string>`
          case 
            when extract(year from age(${patientsTable.date_of_birth})) < 18 then 'Under 18'
            when extract(year from age(${patientsTable.date_of_birth})) < 30 then '18-30'
            when extract(year from age(${patientsTable.date_of_birth})) < 50 then '30-50'
            when extract(year from age(${patientsTable.date_of_birth})) < 65 then '50-65'
            else '65+'
          end
        `,
        count: sql<number>`count(*)::integer`
      })
      .from(patientsTable)
      .groupBy(sql`
        case 
          when extract(year from age(${patientsTable.date_of_birth})) < 18 then 'Under 18'
          when extract(year from age(${patientsTable.date_of_birth})) < 30 then '18-30'
          when extract(year from age(${patientsTable.date_of_birth})) < 50 then '30-50'
          when extract(year from age(${patientsTable.date_of_birth})) < 65 then '50-65'
          else '65+'
        end
      `)
      .execute();

    const reportData = {
      period: {
        start_date: input.start_date,
        end_date: input.end_date
      },
      summary: {
        new_patients: newPatients[0]?.count || 0,
        total_visits: visitFrequency.reduce((sum, item) => sum + item.visit_count, 0)
      },
      visit_frequency: visitFrequency.map(item => ({
        patient_name: item.patient_name,
        visit_count: item.visit_count,
        last_visit: item.last_visit
      })),
      common_diagnoses: commonDiagnoses.map(item => ({
        diagnosis: item.diagnosis,
        count: item.count
      })),
      demographics: {
        gender_distribution: demographics.map(item => ({
          gender: item.gender,
          count: item.count
        })),
        age_distribution: ageDistribution.map(item => ({
          age_group: item.age_group,
          count: item.count
        }))
      }
    };

    // For this implementation, return JSON data as string
    // In production, this would generate actual PDF/Excel files
    if (input.format === 'excel') {
      return JSON.stringify(reportData, null, 2);
    } else {
      return Buffer.from(JSON.stringify(reportData, null, 2));
    }
  } catch (error) {
    console.error('Patient report generation failed:', error);
    throw error;
  }
}

export async function generateReceiptData(transactionId: number): Promise<any> {
  try {
    // Get clinic information from settings
    const clinicSettings = await db
      .select()
      .from(settingsTable)
      .where(sql`${settingsTable.key} IN ('clinic_name', 'clinic_address', 'clinic_phone')`)
      .execute();

    const settingsMap = clinicSettings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);

    // Get transaction details with patient information
    const transactionDetails = await db
      .select({
        transaction_id: transactionsTable.id,
        total_amount: transactionsTable.total_amount,
        payment_method: transactionsTable.payment_method,
        payment_status: transactionsTable.payment_status,
        notes: transactionsTable.notes,
        created_at: transactionsTable.created_at,
        patient_name: patientsTable.name,
        patient_phone: patientsTable.phone
      })
      .from(transactionsTable)
      .innerJoin(patientsTable, eq(transactionsTable.patient_id, patientsTable.id))
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    if (transactionDetails.length === 0) {
      throw new Error(`Transaction with ID ${transactionId} not found`);
    }

    const transaction = transactionDetails[0];

    // Get service items
    const serviceItems = await db
      .select({
        name: servicesTable.name,
        quantity: transactionServicesTable.quantity,
        price_per_unit: transactionServicesTable.price_per_unit,
        total_price: transactionServicesTable.total_price
      })
      .from(transactionServicesTable)
      .innerJoin(servicesTable, eq(transactionServicesTable.service_id, servicesTable.id))
      .where(eq(transactionServicesTable.transaction_id, transactionId))
      .execute();

    // Get medicine items
    const medicineItems = await db
      .select({
        name: medicinesTable.name,
        unit: medicinesTable.unit,
        quantity: transactionMedicinesTable.quantity,
        price_per_unit: transactionMedicinesTable.price_per_unit,
        total_price: transactionMedicinesTable.total_price
      })
      .from(transactionMedicinesTable)
      .innerJoin(medicinesTable, eq(transactionMedicinesTable.medicine_id, medicinesTable.id))
      .where(eq(transactionMedicinesTable.transaction_id, transactionId))
      .execute();

    // Format items for receipt
    const items = [
      ...serviceItems.map(item => ({
        type: 'service',
        name: item.name,
        quantity: item.quantity,
        unit: 'layanan',
        price_per_unit: parseFloat(item.price_per_unit),
        total_price: parseFloat(item.total_price)
      })),
      ...medicineItems.map(item => ({
        type: 'medicine',
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        price_per_unit: parseFloat(item.price_per_unit),
        total_price: parseFloat(item.total_price)
      }))
    ];

    return {
      clinic_info: {
        name: settingsMap['clinic_name'] || 'Rumah Khitan Super Modern Pak Nopi',
        address: settingsMap['clinic_address'] || '',
        phone: settingsMap['clinic_phone'] || ''
      },
      transaction: {
        id: transaction.transaction_id,
        total_amount: parseFloat(transaction.total_amount),
        payment_method: transaction.payment_method,
        payment_status: transaction.payment_status,
        notes: transaction.notes,
        created_at: transaction.created_at
      },
      patient: {
        name: transaction.patient_name,
        phone: transaction.patient_phone
      },
      items,
      footer_message: 'Terima kasih atas kepercayaan Anda!'
    };
  } catch (error) {
    console.error('Receipt data generation failed:', error);
    throw error;
  }
}