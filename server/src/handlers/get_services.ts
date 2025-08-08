import { type Service } from '../schema';

export async function getServices(activeOnly: boolean = false): Promise<Service[]> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching available services from the database.
    // If activeOnly is true, it should only return services where is_active = true.
    // This is used in the transaction creation interface to show available services.
    return Promise.resolve([]);
}

export async function getServiceById(id: number): Promise<Service | null> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching a specific service by its ID.
    // It should return null if the service is not found.
    return Promise.resolve(null);
}