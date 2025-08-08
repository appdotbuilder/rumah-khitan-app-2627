import { db } from '../db';
import { 
  patientsTable, 
  transactionsTable, 
  medicinesTable,
  transactionServicesTable,
  servicesTable
} from '../db/schema';
import { type DashboardStats } from '../schema';
import { sql, count, eq, and, gte, lte, lt, desc, sum } from 'drizzle-orm';

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get total patients count
    const totalPatientsResult = await db.select({ count: count() })
      .from(patientsTable)
      .execute();

    // Get today's transactions count
    const todayTransactionsResult = await db.select({ count: count() })
      .from(transactionsTable)
      .where(gte(transactionsTable.created_at, today))
      .execute();

    // Get today's revenue (only paid transactions)
    const todayRevenueResult = await db.select({ 
      total: sum(transactionsTable.total_amount) 
    })
      .from(transactionsTable)
      .where(
        and(
          gte(transactionsTable.created_at, today),
          eq(transactionsTable.payment_status, 'paid')
        )
      )
      .execute();

    // Get low stock medicines count
    const lowStockResult = await db.select({ count: count() })
      .from(medicinesTable)
      .where(sql`${medicinesTable.stock_quantity} <= ${medicinesTable.minimum_stock}`)
      .execute();

    // Get expired medicines count
    const expiredResult = await db.select({ count: count() })
      .from(medicinesTable)
      .where(lt(medicinesTable.expiry_date, today.toISOString().split('T')[0]))
      .execute();

    // Get pending transactions count
    const pendingTransactionsResult = await db.select({ count: count() })
      .from(transactionsTable)
      .where(eq(transactionsTable.payment_status, 'pending'))
      .execute();

    return {
      total_patients: totalPatientsResult[0]?.count || 0,
      total_transactions_today: todayTransactionsResult[0]?.count || 0,
      total_revenue_today: parseFloat(todayRevenueResult[0]?.total || '0'),
      low_stock_medicines: lowStockResult[0]?.count || 0,
      expired_medicines: expiredResult[0]?.count || 0,
      pending_transactions: pendingTransactionsResult[0]?.count || 0
    };
  } catch (error) {
    console.error('Dashboard stats calculation failed:', error);
    throw error;
  }
}

export async function getDailyRevenue(date?: Date): Promise<number> {
  try {
    const targetDate = date || new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const result = await db.select({ 
      total: sum(transactionsTable.total_amount) 
    })
      .from(transactionsTable)
      .where(
        and(
          gte(transactionsTable.created_at, targetDate),
          lt(transactionsTable.created_at, nextDay),
          eq(transactionsTable.payment_status, 'paid')
        )
      )
      .execute();

    return parseFloat(result[0]?.total || '0');
  } catch (error) {
    console.error('Daily revenue calculation failed:', error);
    throw error;
  }
}

export async function getMonthlyRevenue(year: number, month: number): Promise<number> {
  try {
    const startDate = new Date(year, month - 1, 1); // month is 1-based, Date constructor is 0-based
    const endDate = new Date(year, month, 1); // First day of next month

    const result = await db.select({ 
      total: sum(transactionsTable.total_amount) 
    })
      .from(transactionsTable)
      .where(
        and(
          gte(transactionsTable.created_at, startDate),
          lt(transactionsTable.created_at, endDate),
          eq(transactionsTable.payment_status, 'paid')
        )
      )
      .execute();

    return parseFloat(result[0]?.total || '0');
  } catch (error) {
    console.error('Monthly revenue calculation failed:', error);
    throw error;
  }
}

export async function getTopServices(limit: number = 5): Promise<Array<{ service_name: string; total_usage: number; total_revenue: number }>> {
  try {
    const result = await db.select({
      service_name: servicesTable.name,
      total_usage: sum(transactionServicesTable.quantity),
      total_revenue: sum(transactionServicesTable.total_price)
    })
      .from(transactionServicesTable)
      .innerJoin(servicesTable, eq(transactionServicesTable.service_id, servicesTable.id))
      .innerJoin(transactionsTable, eq(transactionServicesTable.transaction_id, transactionsTable.id))
      .where(eq(transactionsTable.payment_status, 'paid'))
      .groupBy(servicesTable.id, servicesTable.name)
      .orderBy(desc(sum(transactionServicesTable.quantity)))
      .limit(limit)
      .execute();

    return result.map(row => ({
      service_name: row.service_name,
      total_usage: parseInt(row.total_usage || '0'),
      total_revenue: parseFloat(row.total_revenue || '0')
    }));
  } catch (error) {
    console.error('Top services calculation failed:', error);
    throw error;
  }
}