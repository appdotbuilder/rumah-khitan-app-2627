import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean,
  pgEnum,
  date
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const genderEnum = pgEnum('gender', ['Laki-laki', 'Perempuan']);
export const movementTypeEnum = pgEnum('movement_type', ['masuk', 'keluar']);
export const paymentMethodEnum = pgEnum('payment_method', ['tunai', 'transfer', 'kartu']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'paid', 'cancelled']);

// Patients table
export const patientsTable = pgTable('patients', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  date_of_birth: date('date_of_birth').notNull(),
  gender: genderEnum('gender').notNull(),
  phone: text('phone'),
  address: text('address'),
  emergency_contact: text('emergency_contact'),
  medical_notes: text('medical_notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Medicines table
export const medicinesTable = pgTable('medicines', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  unit: text('unit').notNull(), // tablet, botol, strip, etc.
  price_per_unit: numeric('price_per_unit', { precision: 10, scale: 2 }).notNull(),
  stock_quantity: integer('stock_quantity').notNull(),
  minimum_stock: integer('minimum_stock').notNull(),
  expiry_date: date('expiry_date'),
  supplier: text('supplier'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Stock movements table
export const stockMovementsTable = pgTable('stock_movements', {
  id: serial('id').primaryKey(),
  medicine_id: integer('medicine_id').notNull(),
  movement_type: movementTypeEnum('movement_type').notNull(),
  quantity: integer('quantity').notNull(),
  reference_id: integer('reference_id'), // reference to transaction if outgoing
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Services table
export const servicesTable = pgTable('services', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Transactions table
export const transactionsTable = pgTable('transactions', {
  id: serial('id').primaryKey(),
  patient_id: integer('patient_id').notNull(),
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  payment_method: paymentMethodEnum('payment_method').notNull(),
  payment_status: paymentStatusEnum('payment_status').default('pending').notNull(),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Transaction services junction table
export const transactionServicesTable = pgTable('transaction_services', {
  id: serial('id').primaryKey(),
  transaction_id: integer('transaction_id').notNull(),
  service_id: integer('service_id').notNull(),
  quantity: integer('quantity').notNull(),
  price_per_unit: numeric('price_per_unit', { precision: 10, scale: 2 }).notNull(),
  total_price: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Transaction medicines junction table
export const transactionMedicinesTable = pgTable('transaction_medicines', {
  id: serial('id').primaryKey(),
  transaction_id: integer('transaction_id').notNull(),
  medicine_id: integer('medicine_id').notNull(),
  quantity: integer('quantity').notNull(),
  price_per_unit: numeric('price_per_unit', { precision: 10, scale: 2 }).notNull(),
  total_price: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Patient visits table
export const patientVisitsTable = pgTable('patient_visits', {
  id: serial('id').primaryKey(),
  patient_id: integer('patient_id').notNull(),
  transaction_id: integer('transaction_id'),
  visit_date: timestamp('visit_date').defaultNow().notNull(),
  diagnosis: text('diagnosis'),
  treatment: text('treatment'),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Settings table for customizable branding
export const settingsTable = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  description: text('description'),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Define relations
export const patientsRelations = relations(patientsTable, ({ many }) => ({
  transactions: many(transactionsTable),
  visits: many(patientVisitsTable)
}));

export const medicinesRelations = relations(medicinesTable, ({ many }) => ({
  stockMovements: many(stockMovementsTable),
  transactionMedicines: many(transactionMedicinesTable)
}));

export const stockMovementsRelations = relations(stockMovementsTable, ({ one }) => ({
  medicine: one(medicinesTable, {
    fields: [stockMovementsTable.medicine_id],
    references: [medicinesTable.id]
  }),
  transaction: one(transactionsTable, {
    fields: [stockMovementsTable.reference_id],
    references: [transactionsTable.id]
  })
}));

export const servicesRelations = relations(servicesTable, ({ many }) => ({
  transactionServices: many(transactionServicesTable)
}));

export const transactionsRelations = relations(transactionsTable, ({ one, many }) => ({
  patient: one(patientsTable, {
    fields: [transactionsTable.patient_id],
    references: [patientsTable.id]
  }),
  services: many(transactionServicesTable),
  medicines: many(transactionMedicinesTable),
  stockMovements: many(stockMovementsTable),
  visit: one(patientVisitsTable, {
    fields: [transactionsTable.id],
    references: [patientVisitsTable.transaction_id]
  })
}));

export const transactionServicesRelations = relations(transactionServicesTable, ({ one }) => ({
  transaction: one(transactionsTable, {
    fields: [transactionServicesTable.transaction_id],
    references: [transactionsTable.id]
  }),
  service: one(servicesTable, {
    fields: [transactionServicesTable.service_id],
    references: [servicesTable.id]
  })
}));

export const transactionMedicinesRelations = relations(transactionMedicinesTable, ({ one }) => ({
  transaction: one(transactionsTable, {
    fields: [transactionMedicinesTable.transaction_id],
    references: [transactionsTable.id]
  }),
  medicine: one(medicinesTable, {
    fields: [transactionMedicinesTable.medicine_id],
    references: [medicinesTable.id]
  })
}));

export const patientVisitsRelations = relations(patientVisitsTable, ({ one }) => ({
  patient: one(patientsTable, {
    fields: [patientVisitsTable.patient_id],
    references: [patientsTable.id]
  }),
  transaction: one(transactionsTable, {
    fields: [patientVisitsTable.transaction_id],
    references: [transactionsTable.id]
  })
}));

// TypeScript types for the table schemas
export type Patient = typeof patientsTable.$inferSelect;
export type NewPatient = typeof patientsTable.$inferInsert;

export type Medicine = typeof medicinesTable.$inferSelect;
export type NewMedicine = typeof medicinesTable.$inferInsert;

export type StockMovement = typeof stockMovementsTable.$inferSelect;
export type NewStockMovement = typeof stockMovementsTable.$inferInsert;

export type Service = typeof servicesTable.$inferSelect;
export type NewService = typeof servicesTable.$inferInsert;

export type Transaction = typeof transactionsTable.$inferSelect;
export type NewTransaction = typeof transactionsTable.$inferInsert;

export type TransactionService = typeof transactionServicesTable.$inferSelect;
export type NewTransactionService = typeof transactionServicesTable.$inferInsert;

export type TransactionMedicine = typeof transactionMedicinesTable.$inferSelect;
export type NewTransactionMedicine = typeof transactionMedicinesTable.$inferInsert;

export type PatientVisit = typeof patientVisitsTable.$inferSelect;
export type NewPatientVisit = typeof patientVisitsTable.$inferInsert;

export type Settings = typeof settingsTable.$inferSelect;
export type NewSettings = typeof settingsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  patients: patientsTable,
  medicines: medicinesTable,
  stockMovements: stockMovementsTable,
  services: servicesTable,
  transactions: transactionsTable,
  transactionServices: transactionServicesTable,
  transactionMedicines: transactionMedicinesTable,
  patientVisits: patientVisitsTable,
  settings: settingsTable
};

export const tableRelations = {
  patientsRelations,
  medicinesRelations,
  stockMovementsRelations,
  servicesRelations,
  transactionsRelations,
  transactionServicesRelations,
  transactionMedicinesRelations,
  patientVisitsRelations
};