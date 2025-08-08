import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { servicesTable } from '../db/schema';
import { getServices, getServiceById } from '../handlers/get_services';

describe('getServices', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no services exist', async () => {
    const result = await getServices();
    expect(result).toEqual([]);
  });

  it('should return all services when activeOnly is false', async () => {
    // Create test services with mixed active states
    await db.insert(servicesTable).values([
      {
        name: 'Active Service',
        description: 'An active service',
        price: '50.00',
        is_active: true
      },
      {
        name: 'Inactive Service',
        description: 'An inactive service',
        price: '75.00',
        is_active: false
      }
    ]).execute();

    const result = await getServices(false);

    expect(result).toHaveLength(2);
    expect(result[0].name).toEqual('Active Service');
    expect(result[0].price).toEqual(50.00);
    expect(typeof result[0].price).toEqual('number');
    expect(result[0].is_active).toEqual(true);
    
    expect(result[1].name).toEqual('Inactive Service');
    expect(result[1].price).toEqual(75.00);
    expect(result[1].is_active).toEqual(false);
  });

  it('should return only active services when activeOnly is true', async () => {
    // Create test services with mixed active states
    await db.insert(servicesTable).values([
      {
        name: 'Active Service 1',
        description: 'First active service',
        price: '25.50',
        is_active: true
      },
      {
        name: 'Active Service 2',
        description: 'Second active service',
        price: '100.00',
        is_active: true
      },
      {
        name: 'Inactive Service',
        description: 'An inactive service',
        price: '75.00',
        is_active: false
      }
    ]).execute();

    const result = await getServices(true);

    expect(result).toHaveLength(2);
    expect(result.every(service => service.is_active)).toBe(true);
    expect(result[0].name).toEqual('Active Service 1');
    expect(result[0].price).toEqual(25.50);
    expect(result[1].name).toEqual('Active Service 2');
    expect(result[1].price).toEqual(100.00);
  });

  it('should convert numeric price field correctly', async () => {
    await db.insert(servicesTable).values({
      name: 'Test Service',
      description: 'Service for price testing',
      price: '123.45',
      is_active: true
    }).execute();

    const result = await getServices();

    expect(result).toHaveLength(1);
    expect(result[0].price).toEqual(123.45);
    expect(typeof result[0].price).toEqual('number');
  });

  it('should handle services with null description', async () => {
    await db.insert(servicesTable).values({
      name: 'Service Without Description',
      description: null,
      price: '30.00',
      is_active: true
    }).execute();

    const result = await getServices();

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Service Without Description');
    expect(result[0].description).toBeNull();
    expect(result[0].price).toEqual(30.00);
  });

  it('should include all required fields', async () => {
    await db.insert(servicesTable).values({
      name: 'Complete Service',
      description: 'Service with all fields',
      price: '99.99',
      is_active: true
    }).execute();

    const result = await getServices();

    expect(result).toHaveLength(1);
    const service = result[0];
    expect(service.id).toBeDefined();
    expect(service.name).toEqual('Complete Service');
    expect(service.description).toEqual('Service with all fields');
    expect(service.price).toEqual(99.99);
    expect(service.is_active).toEqual(true);
    expect(service.created_at).toBeInstanceOf(Date);
    expect(service.updated_at).toBeInstanceOf(Date);
  });
});

describe('getServiceById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null when service does not exist', async () => {
    const result = await getServiceById(999);
    expect(result).toBeNull();
  });

  it('should return service when it exists', async () => {
    const insertResult = await db.insert(servicesTable).values({
      name: 'Test Service',
      description: 'Service for ID testing',
      price: '45.50',
      is_active: true
    }).returning().execute();

    const serviceId = insertResult[0].id;
    const result = await getServiceById(serviceId);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(serviceId);
    expect(result!.name).toEqual('Test Service');
    expect(result!.description).toEqual('Service for ID testing');
    expect(result!.price).toEqual(45.50);
    expect(typeof result!.price).toEqual('number');
    expect(result!.is_active).toEqual(true);
  });

  it('should return inactive service by ID', async () => {
    const insertResult = await db.insert(servicesTable).values({
      name: 'Inactive Service',
      description: 'Service that is inactive',
      price: '25.00',
      is_active: false
    }).returning().execute();

    const serviceId = insertResult[0].id;
    const result = await getServiceById(serviceId);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(serviceId);
    expect(result!.name).toEqual('Inactive Service');
    expect(result!.is_active).toEqual(false);
    expect(result!.price).toEqual(25.00);
  });

  it('should convert numeric price field correctly', async () => {
    const insertResult = await db.insert(servicesTable).values({
      name: 'Price Test Service',
      description: 'For testing price conversion',
      price: '87.65',
      is_active: true
    }).returning().execute();

    const serviceId = insertResult[0].id;
    const result = await getServiceById(serviceId);

    expect(result).not.toBeNull();
    expect(result!.price).toEqual(87.65);
    expect(typeof result!.price).toEqual('number');
  });

  it('should handle service with null description', async () => {
    const insertResult = await db.insert(servicesTable).values({
      name: 'No Description Service',
      description: null,
      price: '15.75',
      is_active: true
    }).returning().execute();

    const serviceId = insertResult[0].id;
    const result = await getServiceById(serviceId);

    expect(result).not.toBeNull();
    expect(result!.name).toEqual('No Description Service');
    expect(result!.description).toBeNull();
    expect(result!.price).toEqual(15.75);
  });

  it('should include all required fields', async () => {
    const insertResult = await db.insert(servicesTable).values({
      name: 'Full Service',
      description: 'Complete service record',
      price: '200.00',
      is_active: true
    }).returning().execute();

    const serviceId = insertResult[0].id;
    const result = await getServiceById(serviceId);

    expect(result).not.toBeNull();
    const service = result!;
    expect(service.id).toEqual(serviceId);
    expect(service.name).toEqual('Full Service');
    expect(service.description).toEqual('Complete service record');
    expect(service.price).toEqual(200.00);
    expect(service.is_active).toEqual(true);
    expect(service.created_at).toBeInstanceOf(Date);
    expect(service.updated_at).toBeInstanceOf(Date);
  });
});