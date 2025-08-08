import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { servicesTable } from '../db/schema';
import { type UpdateServiceInput, type CreateServiceInput } from '../schema';
import { updateService } from '../handlers/update_service';
import { eq } from 'drizzle-orm';

// Helper function to create a test service
const createTestService = async (overrides: Partial<CreateServiceInput> = {}): Promise<number> => {
  const serviceData = {
    name: 'Test Service',
    description: 'A test service',
    price: 100000,
    is_active: true,
    ...overrides
  };

  const result = await db.insert(servicesTable)
    .values({
      ...serviceData,
      price: serviceData.price.toString(), // Convert to string for database
      created_at: new Date(),
      updated_at: new Date()
    })
    .returning()
    .execute();

  return result[0].id;
};

describe('updateService', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update service name', async () => {
    const serviceId = await createTestService();
    
    const updateInput: UpdateServiceInput = {
      id: serviceId,
      name: 'Updated Service Name'
    };

    const result = await updateService(updateInput);

    expect(result.id).toEqual(serviceId);
    expect(result.name).toEqual('Updated Service Name');
    expect(result.description).toEqual('A test service'); // Should remain unchanged
    expect(result.price).toEqual(100000);
    expect(result.is_active).toEqual(true);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update service price', async () => {
    const serviceId = await createTestService();
    
    const updateInput: UpdateServiceInput = {
      id: serviceId,
      price: 150000
    };

    const result = await updateService(updateInput);

    expect(result.id).toEqual(serviceId);
    expect(result.name).toEqual('Test Service'); // Should remain unchanged
    expect(result.price).toEqual(150000);
    expect(typeof result.price).toEqual('number'); // Verify numeric type
    expect(result.is_active).toEqual(true);
  });

  it('should update service description', async () => {
    const serviceId = await createTestService();
    
    const updateInput: UpdateServiceInput = {
      id: serviceId,
      description: 'Updated description'
    };

    const result = await updateService(updateInput);

    expect(result.id).toEqual(serviceId);
    expect(result.name).toEqual('Test Service'); // Should remain unchanged
    expect(result.description).toEqual('Updated description');
    expect(result.price).toEqual(100000);
  });

  it('should update service active status', async () => {
    const serviceId = await createTestService();
    
    const updateInput: UpdateServiceInput = {
      id: serviceId,
      is_active: false
    };

    const result = await updateService(updateInput);

    expect(result.id).toEqual(serviceId);
    expect(result.name).toEqual('Test Service'); // Should remain unchanged
    expect(result.is_active).toEqual(false);
    expect(result.price).toEqual(100000);
  });

  it('should update multiple fields at once', async () => {
    const serviceId = await createTestService();
    
    const updateInput: UpdateServiceInput = {
      id: serviceId,
      name: 'Comprehensive Update',
      description: 'Updated comprehensive description',
      price: 250000,
      is_active: false
    };

    const result = await updateService(updateInput);

    expect(result.id).toEqual(serviceId);
    expect(result.name).toEqual('Comprehensive Update');
    expect(result.description).toEqual('Updated comprehensive description');
    expect(result.price).toEqual(250000);
    expect(typeof result.price).toEqual('number'); // Verify numeric type
    expect(result.is_active).toEqual(false);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should handle null description', async () => {
    const serviceId = await createTestService({ description: 'Original description' });
    
    const updateInput: UpdateServiceInput = {
      id: serviceId,
      description: null
    };

    const result = await updateService(updateInput);

    expect(result.id).toEqual(serviceId);
    expect(result.description).toBeNull();
    expect(result.name).toEqual('Test Service'); // Should remain unchanged
  });

  it('should update database record correctly', async () => {
    const serviceId = await createTestService();
    
    const updateInput: UpdateServiceInput = {
      id: serviceId,
      name: 'Database Update Test',
      price: 175000
    };

    await updateService(updateInput);

    // Verify the database was updated correctly
    const services = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.id, serviceId))
      .execute();

    expect(services).toHaveLength(1);
    expect(services[0].name).toEqual('Database Update Test');
    expect(parseFloat(services[0].price)).toEqual(175000); // Database stores as string
    expect(services[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error when service does not exist', async () => {
    const updateInput: UpdateServiceInput = {
      id: 99999, // Non-existent ID
      name: 'Non-existent Service'
    };

    await expect(updateService(updateInput)).rejects.toThrow(/Service not found/i);
  });

  it('should handle decimal prices correctly', async () => {
    const serviceId = await createTestService();
    
    const updateInput: UpdateServiceInput = {
      id: serviceId,
      price: 99.99
    };

    const result = await updateService(updateInput);

    expect(result.price).toEqual(99.99);
    expect(typeof result.price).toEqual('number');

    // Verify database stores it correctly
    const services = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.id, serviceId))
      .execute();

    expect(parseFloat(services[0].price)).toEqual(99.99);
  });

  it('should update updated_at timestamp', async () => {
    const serviceId = await createTestService();
    
    // Get original timestamp
    const originalService = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.id, serviceId))
      .execute();

    const originalUpdatedAt = originalService[0].updated_at;

    // Wait a moment to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const updateInput: UpdateServiceInput = {
      id: serviceId,
      name: 'Timestamp Test'
    };

    const result = await updateService(updateInput);

    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should only update provided fields', async () => {
    const serviceId = await createTestService({
      name: 'Original Name',
      description: 'Original Description',
      price: 100000,
      is_active: true
    });

    // Update only the price
    const updateInput: UpdateServiceInput = {
      id: serviceId,
      price: 200000
    };

    const result = await updateService(updateInput);

    // Only price should be updated, other fields unchanged
    expect(result.name).toEqual('Original Name');
    expect(result.description).toEqual('Original Description');
    expect(result.price).toEqual(200000);
    expect(result.is_active).toEqual(true);
  });
});