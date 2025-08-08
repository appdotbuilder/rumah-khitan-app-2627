import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { settingsTable } from '../db/schema';
import { type UpdateSettingsInput } from '../schema';
import { getSettings, getSettingByKey, updateSetting, initializeDefaultSettings } from '../handlers/settings';
import { eq } from 'drizzle-orm';

describe('Settings Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getSettings', () => {
    it('should return empty array when no settings exist', async () => {
      const result = await getSettings();
      expect(result).toEqual([]);
    });

    it('should return all settings', async () => {
      // Insert test settings
      await db.insert(settingsTable)
        .values([
          { key: 'clinic_name', value: 'Test Clinic', description: 'Test clinic name', updated_at: new Date() },
          { key: 'address', value: '123 Test St', description: 'Test address', updated_at: new Date() }
        ])
        .execute();

      const result = await getSettings();
      
      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('clinic_name');
      expect(result[0].value).toBe('Test Clinic');
      expect(result[0].description).toBe('Test clinic name');
      expect(result[0].updated_at).toBeInstanceOf(Date);
      
      expect(result[1].key).toBe('address');
      expect(result[1].value).toBe('123 Test St');
      expect(result[1].description).toBe('Test address');
      expect(result[1].updated_at).toBeInstanceOf(Date);
    });
  });

  describe('getSettingByKey', () => {
    beforeEach(async () => {
      // Insert test setting
      await db.insert(settingsTable)
        .values({
          key: 'clinic_name',
          value: 'Test Clinic',
          description: 'Test clinic name',
          updated_at: new Date()
        })
        .execute();
    });

    it('should return setting when key exists', async () => {
      const result = await getSettingByKey('clinic_name');
      
      expect(result).not.toBeNull();
      expect(result?.key).toBe('clinic_name');
      expect(result?.value).toBe('Test Clinic');
      expect(result?.description).toBe('Test clinic name');
      expect(result?.updated_at).toBeInstanceOf(Date);
      expect(result?.id).toBeDefined();
    });

    it('should return null when key does not exist', async () => {
      const result = await getSettingByKey('nonexistent_key');
      expect(result).toBeNull();
    });
  });

  describe('updateSetting', () => {
    it('should create new setting when key does not exist', async () => {
      const input: UpdateSettingsInput = {
        key: 'new_setting',
        value: 'new value',
        description: 'New setting description'
      };

      const result = await updateSetting(input);

      expect(result.key).toBe('new_setting');
      expect(result.value).toBe('new value');
      expect(result.description).toBe('New setting description');
      expect(result.updated_at).toBeInstanceOf(Date);
      expect(result.id).toBeDefined();

      // Verify it was saved to database
      const saved = await db.select()
        .from(settingsTable)
        .where(eq(settingsTable.key, 'new_setting'))
        .execute();

      expect(saved).toHaveLength(1);
      expect(saved[0].key).toBe('new_setting');
      expect(saved[0].value).toBe('new value');
      expect(saved[0].description).toBe('New setting description');
    });

    it('should update existing setting when key exists', async () => {
      // Insert existing setting
      const existing = await db.insert(settingsTable)
        .values({
          key: 'existing_setting',
          value: 'old value',
          description: 'Old description',
          updated_at: new Date('2023-01-01')
        })
        .returning()
        .execute();

      const input: UpdateSettingsInput = {
        key: 'existing_setting',
        value: 'updated value',
        description: 'Updated description'
      };

      const result = await updateSetting(input);

      expect(result.key).toBe('existing_setting');
      expect(result.value).toBe('updated value');
      expect(result.description).toBe('Updated description');
      expect(result.updated_at).toBeInstanceOf(Date);
      expect(result.updated_at.getTime()).toBeGreaterThan(new Date('2023-01-01').getTime());
      expect(result.id).toBe(existing[0].id);

      // Verify it was updated in database
      const saved = await db.select()
        .from(settingsTable)
        .where(eq(settingsTable.key, 'existing_setting'))
        .execute();

      expect(saved).toHaveLength(1);
      expect(saved[0].value).toBe('updated value');
      expect(saved[0].description).toBe('Updated description');
    });

    it('should handle null description when updating', async () => {
      const input: UpdateSettingsInput = {
        key: 'no_description_setting',
        value: 'some value'
      };

      const result = await updateSetting(input);

      expect(result.key).toBe('no_description_setting');
      expect(result.value).toBe('some value');
      expect(result.description).toBeNull();
      expect(result.updated_at).toBeInstanceOf(Date);
      expect(result.id).toBeDefined();
    });
  });

  describe('initializeDefaultSettings', () => {
    it('should create default settings when none exist', async () => {
      await initializeDefaultSettings();

      const settings = await getSettings();
      
      expect(settings.length).toBeGreaterThan(0);
      
      // Check specific default settings
      const clinicName = settings.find(s => s.key === 'clinic_name');
      expect(clinicName).toBeDefined();
      expect(clinicName?.value).toBe('Rumah Khitan Super Modern Pak Nopi');
      expect(clinicName?.description).toBe('Nama klinik');

      const address = settings.find(s => s.key === 'address');
      expect(address).toBeDefined();
      expect(address?.value).toBe('');
      expect(address?.description).toBe('Alamat klinik');

      const phone = settings.find(s => s.key === 'phone');
      expect(phone).toBeDefined();
      expect(phone?.value).toBe('');
      expect(phone?.description).toBe('Nomor telepon klinik');

      const logoUrl = settings.find(s => s.key === 'logo_url');
      expect(logoUrl).toBeDefined();
      expect(logoUrl?.value).toBe('');
      expect(logoUrl?.description).toBe('URL logo klinik');

      const receiptFooter = settings.find(s => s.key === 'receipt_footer');
      expect(receiptFooter).toBeDefined();
      expect(receiptFooter?.value).toBe('Terima kasih atas kepercayaan Anda');
      expect(receiptFooter?.description).toBe('Footer struk pembayaran');

      const lowStockThreshold = settings.find(s => s.key === 'low_stock_threshold_days');
      expect(lowStockThreshold).toBeDefined();
      expect(lowStockThreshold?.value).toBe('7');
      expect(lowStockThreshold?.description).toBe('Peringatan stok menipis (hari)');

      const expiryWarning = settings.find(s => s.key === 'expiry_warning_days');
      expect(expiryWarning).toBeDefined();
      expect(expiryWarning?.value).toBe('30');
      expect(expiryWarning?.description).toBe('Peringatan obat kedaluwarsa (hari)');
    });

    it('should not create default settings when some already exist', async () => {
      // Insert one setting first
      await db.insert(settingsTable)
        .values({
          key: 'existing_setting',
          value: 'existing value',
          description: 'Existing setting',
          updated_at: new Date()
        })
        .execute();

      await initializeDefaultSettings();

      const settings = await getSettings();
      
      // Should only have the one existing setting, no defaults added
      expect(settings).toHaveLength(1);
      expect(settings[0].key).toBe('existing_setting');
      expect(settings[0].value).toBe('existing value');
    });

    it('should be idempotent - running twice should not create duplicates', async () => {
      await initializeDefaultSettings();
      await initializeDefaultSettings();

      const settings = await getSettings();
      
      // Should still only have the default settings count (7)
      expect(settings).toHaveLength(7);
      
      // Verify no duplicates by checking unique keys
      const keys = settings.map(s => s.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });
});