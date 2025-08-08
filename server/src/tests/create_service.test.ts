import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { servicesTable } from '../db/schema';
import { type CreateServiceInput } from '../schema';
import { createService } from '../handlers/create_service';
import { eq } from 'drizzle-orm';

// Basic test input
const testInput: CreateServiceInput = {
  name: 'Konsultasi Dokter Umum',
  description: 'Pemeriksaan dan konsultasi dengan dokter umum',
  price: 50000,
  is_active: true
};

// Minimal test input
const minimalInput: CreateServiceInput = {
  name: 'Layanan Minimal',
  description: null,
  price: 25000,
  is_active: true
};

describe('createService', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a service with complete data', async () => {
    const result = await createService(testInput);

    // Basic field validation
    expect(result.name).toEqual('Konsultasi Dokter Umum');
    expect(result.description).toEqual(testInput.description);
    expect(result.price).toEqual(50000);
    expect(typeof result.price).toBe('number');
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a service with minimal data', async () => {
    const result = await createService(minimalInput);

    expect(result.name).toEqual('Layanan Minimal');
    expect(result.description).toBeNull();
    expect(result.price).toEqual(25000);
    expect(typeof result.price).toBe('number');
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save service to database', async () => {
    const result = await createService(testInput);

    // Query using proper drizzle syntax
    const services = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.id, result.id))
      .execute();

    expect(services).toHaveLength(1);
    expect(services[0].name).toEqual('Konsultasi Dokter Umum');
    expect(services[0].description).toEqual(testInput.description);
    expect(parseFloat(services[0].price)).toEqual(50000);
    expect(services[0].is_active).toEqual(true);
    expect(services[0].created_at).toBeInstanceOf(Date);
    expect(services[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle different price values correctly', async () => {
    const expensiveService: CreateServiceInput = {
      name: 'Layanan Premium',
      description: 'Layanan dengan harga tinggi',
      price: 999999.99,
      is_active: true
    };

    const result = await createService(expensiveService);

    expect(result.price).toEqual(999999.99);
    expect(typeof result.price).toBe('number');

    // Verify in database
    const services = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.id, result.id))
      .execute();

    expect(parseFloat(services[0].price)).toEqual(999999.99);
  });

  it('should handle inactive services', async () => {
    const inactiveService: CreateServiceInput = {
      name: 'Layanan Tidak Aktif',
      description: 'Layanan yang tidak aktif',
      price: 75000,
      is_active: false
    };

    const result = await createService(inactiveService);

    expect(result.is_active).toEqual(false);

    // Verify in database
    const services = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.id, result.id))
      .execute();

    expect(services[0].is_active).toEqual(false);
  });

  it('should apply default is_active value when not provided', async () => {
    const serviceWithDefault: CreateServiceInput = {
      name: 'Layanan Default',
      description: null,
      price: 30000,
      is_active: true // Zod schema has default(true)
    };

    const result = await createService(serviceWithDefault);
    expect(result.is_active).toEqual(true);
  });

  it('should create multiple services with unique IDs', async () => {
    const service1Input: CreateServiceInput = {
      name: 'Layanan 1',
      description: 'Deskripsi layanan 1',
      price: 40000,
      is_active: true
    };

    const service2Input: CreateServiceInput = {
      name: 'Layanan 2',
      description: 'Deskripsi layanan 2',
      price: 60000,
      is_active: true
    };

    const result1 = await createService(service1Input);
    const result2 = await createService(service2Input);

    expect(result1.id).toBeDefined();
    expect(result2.id).toBeDefined();
    expect(result1.id).not.toEqual(result2.id);

    // Verify both are saved
    const allServices = await db.select()
      .from(servicesTable)
      .execute();

    expect(allServices).toHaveLength(2);
    expect(allServices.map(s => s.name)).toContain('Layanan 1');
    expect(allServices.map(s => s.name)).toContain('Layanan 2');
  });
});