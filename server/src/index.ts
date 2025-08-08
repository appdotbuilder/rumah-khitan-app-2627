import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createPatientInputSchema,
  updatePatientInputSchema,
  patientSearchInputSchema,
  createMedicineInputSchema,
  updateMedicineInputSchema,
  medicineSearchInputSchema,
  createStockMovementInputSchema,
  createServiceInputSchema,
  updateServiceInputSchema,
  createTransactionInputSchema,
  transactionSearchInputSchema,
  createPatientVisitInputSchema,
  updateSettingsInputSchema,
  reportInputSchema
} from './schema';

// Import handlers
import { createPatient } from './handlers/create_patient';
import { getPatients, getPatientById } from './handlers/get_patients';
import { updatePatient } from './handlers/update_patient';

import { createMedicine } from './handlers/create_medicine';
import { getMedicines, getMedicineById, getLowStockMedicines, getExpiredMedicines } from './handlers/get_medicines';
import { updateMedicine } from './handlers/update_medicine';

import { createStockMovement, getStockMovements, adjustStock } from './handlers/stock_management';

import { createService } from './handlers/create_service';
import { getServices, getServiceById } from './handlers/get_services';
import { updateService } from './handlers/update_service';

import { createTransaction } from './handlers/create_transaction';
import { getTransactions, getTransactionById, getTodayTransactions, getPendingTransactions } from './handlers/get_transactions';
import { updateTransactionStatus, addTransactionNotes } from './handlers/update_transaction';

import { createPatientVisit, getPatientVisits, getVisitById, updatePatientVisit } from './handlers/patient_visits';

import { getDashboardStats, getDailyRevenue, getMonthlyRevenue, getTopServices } from './handlers/dashboard';

import { getSettings, getSettingByKey, updateSetting, initializeDefaultSettings } from './handlers/settings';

import { generateSalesReport, generateInventoryReport, generatePatientReport, generateReceiptData } from './handlers/reports';

import { deletePatient, deleteMedicine, deleteService, deleteTransaction } from './handlers/delete_records';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Patient management
  createPatient: publicProcedure
    .input(createPatientInputSchema)
    .mutation(({ input }) => createPatient(input)),
    
  getPatients: publicProcedure
    .input(patientSearchInputSchema.optional())
    .query(({ input }) => getPatients(input)),
    
  getPatientById: publicProcedure
    .input(z.number())
    .query(({ input }) => getPatientById(input)),
    
  updatePatient: publicProcedure
    .input(updatePatientInputSchema)
    .mutation(({ input }) => updatePatient(input)),
    
  deletePatient: publicProcedure
    .input(z.number())
    .mutation(({ input }) => deletePatient(input)),

  // Medicine/Inventory management
  createMedicine: publicProcedure
    .input(createMedicineInputSchema)
    .mutation(({ input }) => createMedicine(input)),
    
  getMedicines: publicProcedure
    .input(medicineSearchInputSchema.optional())
    .query(({ input }) => getMedicines(input)),
    
  getMedicineById: publicProcedure
    .input(z.number())
    .query(({ input }) => getMedicineById(input)),
    
  updateMedicine: publicProcedure
    .input(updateMedicineInputSchema)
    .mutation(({ input }) => updateMedicine(input)),
    
  deleteMedicine: publicProcedure
    .input(z.number())
    .mutation(({ input }) => deleteMedicine(input)),
    
  getLowStockMedicines: publicProcedure
    .query(() => getLowStockMedicines()),
    
  getExpiredMedicines: publicProcedure
    .query(() => getExpiredMedicines()),

  // Stock management
  createStockMovement: publicProcedure
    .input(createStockMovementInputSchema)
    .mutation(({ input }) => createStockMovement(input)),
    
  getStockMovements: publicProcedure
    .input(z.number().optional())
    .query(({ input }) => getStockMovements(input)),
    
  adjustStock: publicProcedure
    .input(z.object({
      medicineId: z.number(),
      newQuantity: z.number().int().nonnegative(),
      notes: z.string().optional()
    }))
    .mutation(({ input }) => adjustStock(input.medicineId, input.newQuantity, input.notes)),

  // Service management
  createService: publicProcedure
    .input(createServiceInputSchema)
    .mutation(({ input }) => createService(input)),
    
  getServices: publicProcedure
    .input(z.boolean().default(false))
    .query(({ input }) => getServices(input)),
    
  getServiceById: publicProcedure
    .input(z.number())
    .query(({ input }) => getServiceById(input)),
    
  updateService: publicProcedure
    .input(updateServiceInputSchema)
    .mutation(({ input }) => updateService(input)),
    
  deleteService: publicProcedure
    .input(z.number())
    .mutation(({ input }) => deleteService(input)),

  // Transaction/Cashier system
  createTransaction: publicProcedure
    .input(createTransactionInputSchema)
    .mutation(({ input }) => createTransaction(input)),
    
  getTransactions: publicProcedure
    .input(transactionSearchInputSchema.optional())
    .query(({ input }) => getTransactions(input)),
    
  getTransactionById: publicProcedure
    .input(z.number())
    .query(({ input }) => getTransactionById(input)),
    
  getTodayTransactions: publicProcedure
    .query(() => getTodayTransactions()),
    
  getPendingTransactions: publicProcedure
    .query(() => getPendingTransactions()),
    
  updateTransactionStatus: publicProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(['pending', 'paid', 'cancelled'])
    }))
    .mutation(({ input }) => updateTransactionStatus(input.id, input.status)),
    
  addTransactionNotes: publicProcedure
    .input(z.object({
      id: z.number(),
      notes: z.string()
    }))
    .mutation(({ input }) => addTransactionNotes(input.id, input.notes)),
    
  deleteTransaction: publicProcedure
    .input(z.number())
    .mutation(({ input }) => deleteTransaction(input)),

  // Patient visits
  createPatientVisit: publicProcedure
    .input(createPatientVisitInputSchema)
    .mutation(({ input }) => createPatientVisit(input)),
    
  getPatientVisits: publicProcedure
    .input(z.number())
    .query(({ input }) => getPatientVisits(input)),
    
  getVisitById: publicProcedure
    .input(z.number())
    .query(({ input }) => getVisitById(input)),
    
  updatePatientVisit: publicProcedure
    .input(z.object({
      id: z.number(),
      diagnosis: z.string().optional(),
      treatment: z.string().optional(),
      notes: z.string().optional()
    }))
    .mutation(({ input }) => updatePatientVisit(input.id, input.diagnosis, input.treatment, input.notes)),

  // Dashboard
  getDashboardStats: publicProcedure
    .query(() => getDashboardStats()),
    
  getDailyRevenue: publicProcedure
    .input(z.coerce.date().optional())
    .query(({ input }) => getDailyRevenue(input)),
    
  getMonthlyRevenue: publicProcedure
    .input(z.object({
      year: z.number().int(),
      month: z.number().int().min(1).max(12)
    }))
    .query(({ input }) => getMonthlyRevenue(input.year, input.month)),
    
  getTopServices: publicProcedure
    .input(z.number().int().positive().default(5))
    .query(({ input }) => getTopServices(input)),

  // Settings/Branding
  getSettings: publicProcedure
    .query(() => getSettings()),
    
  getSettingByKey: publicProcedure
    .input(z.string())
    .query(({ input }) => getSettingByKey(input)),
    
  updateSetting: publicProcedure
    .input(updateSettingsInputSchema)
    .mutation(({ input }) => updateSetting(input)),
    
  initializeDefaultSettings: publicProcedure
    .mutation(() => initializeDefaultSettings()),

  // Reports
  generateSalesReport: publicProcedure
    .input(reportInputSchema)
    .mutation(({ input }) => generateSalesReport(input)),
    
  generateInventoryReport: publicProcedure
    .input(reportInputSchema)
    .mutation(({ input }) => generateInventoryReport(input)),
    
  generatePatientReport: publicProcedure
    .input(reportInputSchema)
    .mutation(({ input }) => generatePatientReport(input)),
    
  generateReceiptData: publicProcedure
    .input(z.number())
    .query(({ input }) => generateReceiptData(input)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  
  // Initialize default settings on startup if needed
  try {
    await initializeDefaultSettings();
    console.log('Default settings initialized');
  } catch (error) {
    console.log('Settings already exist or initialization failed:', error);
  }
  
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors({
        origin: process.env['CLIENT_URL'] || 'http://localhost:3000',
        credentials: true,
      })(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  
  server.listen(port);
  console.log(`🏥 Rumah Khitan Super Modern Pak Nopi - TRPC server listening at port: ${port}`);
  console.log(`📊 Dashboard: ${process.env['CLIENT_URL'] || 'http://localhost:3000'}`);
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});