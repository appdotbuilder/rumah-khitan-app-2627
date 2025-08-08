import { db } from '../db';
import { settingsTable } from '../db/schema';
import { type UpdateSettingsInput, type Settings } from '../schema';
import { eq } from 'drizzle-orm';

export async function getSettings(): Promise<Settings[]> {
  try {
    const results = await db.select()
      .from(settingsTable)
      .execute();

    return results.map(setting => ({
      ...setting,
      updated_at: new Date(setting.updated_at)
    }));
  } catch (error) {
    console.error('Get settings failed:', error);
    throw error;
  }
}

export async function getSettingByKey(key: string): Promise<Settings | null> {
  try {
    const results = await db.select()
      .from(settingsTable)
      .where(eq(settingsTable.key, key))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const setting = results[0];
    return {
      ...setting,
      updated_at: new Date(setting.updated_at)
    };
  } catch (error) {
    console.error('Get setting by key failed:', error);
    throw error;
  }
}

export async function updateSetting(input: UpdateSettingsInput): Promise<Settings> {
  try {
    // Check if setting already exists
    const existing = await getSettingByKey(input.key);
    
    if (existing) {
      // Update existing setting
      const results = await db.update(settingsTable)
        .set({
          value: input.value,
          description: input.description,
          updated_at: new Date()
        })
        .where(eq(settingsTable.key, input.key))
        .returning()
        .execute();

      const updated = results[0];
      return {
        ...updated,
        updated_at: new Date(updated.updated_at)
      };
    } else {
      // Create new setting
      const results = await db.insert(settingsTable)
        .values({
          key: input.key,
          value: input.value,
          description: input.description || null,
          updated_at: new Date()
        })
        .returning()
        .execute();

      const created = results[0];
      return {
        ...created,
        updated_at: new Date(created.updated_at)
      };
    }
  } catch (error) {
    console.error('Update setting failed:', error);
    throw error;
  }
}

export async function initializeDefaultSettings(): Promise<void> {
  try {
    // Check if any settings exist
    const existingSettings = await getSettings();
    
    if (existingSettings.length > 0) {
      // Settings already exist, don't initialize
      return;
    }

    const defaultSettings = [
      { key: 'clinic_name', value: 'Rumah Khitan Super Modern Pak Nopi', description: 'Nama klinik' },
      { key: 'address', value: '', description: 'Alamat klinik' },
      { key: 'phone', value: '', description: 'Nomor telepon klinik' },
      { key: 'logo_url', value: '', description: 'URL logo klinik' },
      { key: 'receipt_footer', value: 'Terima kasih atas kepercayaan Anda', description: 'Footer struk pembayaran' },
      { key: 'low_stock_threshold_days', value: '7', description: 'Peringatan stok menipis (hari)' },
      { key: 'expiry_warning_days', value: '30', description: 'Peringatan obat kedaluwarsa (hari)' }
    ];

    // Insert all default settings
    await db.insert(settingsTable)
      .values(defaultSettings.map(setting => ({
        ...setting,
        updated_at: new Date()
      })))
      .execute();
  } catch (error) {
    console.error('Initialize default settings failed:', error);
    throw error;
  }
}