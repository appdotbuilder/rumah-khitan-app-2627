import { z } from 'zod';

// Patient schema
export const patientSchema = z.object({
  id: z.number(),
  name: z.string(),
  date_of_birth: z.coerce.date(),
  gender: z.enum(['Laki-laki', 'Perempuan']),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  emergency_contact: z.string().nullable(),
  medical_notes: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Patient = z.infer<typeof patientSchema>;

// Input schema for creating patients
export const createPatientInputSchema = z.object({
  name: z.string().min(1, "Nama pasien harus diisi"),
  date_of_birth: z.coerce.date(),
  gender: z.enum(['Laki-laki', 'Perempuan']),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  emergency_contact: z.string().nullable(),
  medical_notes: z.string().nullable()
});

export type CreatePatientInput = z.infer<typeof createPatientInputSchema>;

// Input schema for updating patients
export const updatePatientInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1, "Nama pasien harus diisi").optional(),
  date_of_birth: z.coerce.date().optional(),
  gender: z.enum(['Laki-laki', 'Perempuan']).optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  emergency_contact: z.string().nullable().optional(),
  medical_notes: z.string().nullable().optional()
});

export type UpdatePatientInput = z.infer<typeof updatePatientInputSchema>;

// Medicine schema
export const medicineSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  unit: z.string(), // e.g., "tablet", "botol", "strip"
  price_per_unit: z.number(),
  stock_quantity: z.number().int(),
  minimum_stock: z.number().int(),
  expiry_date: z.coerce.date().nullable(),
  supplier: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Medicine = z.infer<typeof medicineSchema>;

// Input schema for creating medicines
export const createMedicineInputSchema = z.object({
  name: z.string().min(1, "Nama obat harus diisi"),
  description: z.string().nullable(),
  unit: z.string().min(1, "Satuan harus diisi"),
  price_per_unit: z.number().positive("Harga per unit harus lebih dari 0"),
  stock_quantity: z.number().int().nonnegative("Jumlah stok tidak boleh negatif"),
  minimum_stock: z.number().int().nonnegative("Minimum stok tidak boleh negatif"),
  expiry_date: z.coerce.date().nullable(),
  supplier: z.string().nullable()
});

export type CreateMedicineInput = z.infer<typeof createMedicineInputSchema>;

// Input schema for updating medicines
export const updateMedicineInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1, "Nama obat harus diisi").optional(),
  description: z.string().nullable().optional(),
  unit: z.string().min(1, "Satuan harus diisi").optional(),
  price_per_unit: z.number().positive("Harga per unit harus lebih dari 0").optional(),
  stock_quantity: z.number().int().nonnegative("Jumlah stok tidak boleh negatif").optional(),
  minimum_stock: z.number().int().nonnegative("Minimum stok tidak boleh negatif").optional(),
  expiry_date: z.coerce.date().nullable().optional(),
  supplier: z.string().nullable().optional()
});

export type UpdateMedicineInput = z.infer<typeof updateMedicineInputSchema>;

// Stock movement schema
export const stockMovementSchema = z.object({
  id: z.number(),
  medicine_id: z.number(),
  movement_type: z.enum(['masuk', 'keluar']),
  quantity: z.number().int(),
  reference_id: z.number().nullable(), // reference to transaction if it's an outgoing movement
  notes: z.string().nullable(),
  created_at: z.coerce.date()
});

export type StockMovement = z.infer<typeof stockMovementSchema>;

// Input schema for creating stock movements
export const createStockMovementInputSchema = z.object({
  medicine_id: z.number(),
  movement_type: z.enum(['masuk', 'keluar']),
  quantity: z.number().int().positive("Jumlah harus lebih dari 0"),
  reference_id: z.number().nullable(),
  notes: z.string().nullable()
});

export type CreateStockMovementInput = z.infer<typeof createStockMovementInputSchema>;

// Service schema
export const serviceSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Service = z.infer<typeof serviceSchema>;

// Input schema for creating services
export const createServiceInputSchema = z.object({
  name: z.string().min(1, "Nama layanan harus diisi"),
  description: z.string().nullable(),
  price: z.number().positive("Harga harus lebih dari 0"),
  is_active: z.boolean().default(true)
});

export type CreateServiceInput = z.infer<typeof createServiceInputSchema>;

// Input schema for updating services
export const updateServiceInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1, "Nama layanan harus diisi").optional(),
  description: z.string().nullable().optional(),
  price: z.number().positive("Harga harus lebih dari 0").optional(),
  is_active: z.boolean().optional()
});

export type UpdateServiceInput = z.infer<typeof updateServiceInputSchema>;

// Transaction schema
export const transactionSchema = z.object({
  id: z.number(),
  patient_id: z.number(),
  total_amount: z.number(),
  payment_method: z.enum(['tunai', 'transfer', 'kartu']),
  payment_status: z.enum(['pending', 'paid', 'cancelled']),
  notes: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Transaction = z.infer<typeof transactionSchema>;

// Input schema for creating transactions
export const createTransactionInputSchema = z.object({
  patient_id: z.number(),
  payment_method: z.enum(['tunai', 'transfer', 'kartu']),
  payment_status: z.enum(['pending', 'paid', 'cancelled']).default('pending'),
  notes: z.string().nullable(),
  services: z.array(z.object({
    service_id: z.number(),
    quantity: z.number().int().positive()
  })),
  medicines: z.array(z.object({
    medicine_id: z.number(),
    quantity: z.number().int().positive()
  })).optional()
});

export type CreateTransactionInput = z.infer<typeof createTransactionInputSchema>;

// Transaction item schema for services
export const transactionServiceSchema = z.object({
  id: z.number(),
  transaction_id: z.number(),
  service_id: z.number(),
  quantity: z.number().int(),
  price_per_unit: z.number(),
  total_price: z.number(),
  created_at: z.coerce.date()
});

export type TransactionService = z.infer<typeof transactionServiceSchema>;

// Transaction item schema for medicines
export const transactionMedicineSchema = z.object({
  id: z.number(),
  transaction_id: z.number(),
  medicine_id: z.number(),
  quantity: z.number().int(),
  price_per_unit: z.number(),
  total_price: z.number(),
  created_at: z.coerce.date()
});

export type TransactionMedicine = z.infer<typeof transactionMedicineSchema>;

// Patient visit schema
export const patientVisitSchema = z.object({
  id: z.number(),
  patient_id: z.number(),
  transaction_id: z.number().nullable(),
  visit_date: z.coerce.date(),
  diagnosis: z.string().nullable(),
  treatment: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.coerce.date()
});

export type PatientVisit = z.infer<typeof patientVisitSchema>;

// Input schema for creating patient visits
export const createPatientVisitInputSchema = z.object({
  patient_id: z.number(),
  transaction_id: z.number().nullable(),
  visit_date: z.coerce.date().default(new Date()),
  diagnosis: z.string().nullable(),
  treatment: z.string().nullable(),
  notes: z.string().nullable()
});

export type CreatePatientVisitInput = z.infer<typeof createPatientVisitInputSchema>;

// Settings schema for customizable branding
export const settingsSchema = z.object({
  id: z.number(),
  key: z.string(),
  value: z.string(),
  description: z.string().nullable(),
  updated_at: z.coerce.date()
});

export type Settings = z.infer<typeof settingsSchema>;

// Input schema for updating settings
export const updateSettingsInputSchema = z.object({
  key: z.string(),
  value: z.string(),
  description: z.string().nullable().optional()
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;

// Dashboard stats schema
export const dashboardStatsSchema = z.object({
  total_patients: z.number(),
  total_transactions_today: z.number(),
  total_revenue_today: z.number(),
  low_stock_medicines: z.number(),
  expired_medicines: z.number(),
  pending_transactions: z.number()
});

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;

// Search and filter schemas
export const patientSearchInputSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0)
});

export type PatientSearchInput = z.infer<typeof patientSearchInputSchema>;

export const medicineSearchInputSchema = z.object({
  query: z.string().optional(),
  low_stock_only: z.boolean().default(false),
  expired_only: z.boolean().default(false),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0)
});

export type MedicineSearchInput = z.infer<typeof medicineSearchInputSchema>;

export const transactionSearchInputSchema = z.object({
  patient_id: z.number().optional(),
  payment_status: z.enum(['pending', 'paid', 'cancelled']).optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0)
});

export type TransactionSearchInput = z.infer<typeof transactionSearchInputSchema>;

// Report generation schemas
export const reportInputSchema = z.object({
  type: z.enum(['sales', 'inventory', 'patients']),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  format: z.enum(['pdf', 'excel']).default('pdf')
});

export type ReportInput = z.infer<typeof reportInputSchema>;