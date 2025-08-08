import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/utils/trpc';
import { 
  Settings as SettingsIcon, 
  Save, 
  Upload, 
  Palette, 
  Building, 
  Phone,
  Mail,
  MapPin,
  Globe,
  Printer,
  Database,
  Shield
} from 'lucide-react';
import type { Settings as SettingsType, UpdateSettingsInput } from '../../../server/src/schema';

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Settings form data
  const [clinicInfo, setClinicInfo] = useState({
    clinic_name: 'Rumah Khitan Super Modern Pak Nopi',
    clinic_address: '',
    clinic_phone: '',
    clinic_email: '',
    clinic_website: ''
  });

  const [systemSettings, setSystemSettings] = useState({
    currency: 'IDR',
    timezone: 'Asia/Jakarta',
    date_format: 'DD/MM/YYYY',
    receipt_footer: 'Terima kasih atas kunjungan Anda!'
  });

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await trpc.getSettings.query();
      setSettings(result);
      
      // Parse settings into form data
      const settingsMap = result.reduce((acc: any, setting: SettingsType) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {});

      setClinicInfo({
        clinic_name: settingsMap.clinic_name || 'Rumah Khitan Super Modern Pak Nopi',
        clinic_address: settingsMap.clinic_address || '',
        clinic_phone: settingsMap.clinic_phone || '',
        clinic_email: settingsMap.clinic_email || '',
        clinic_website: settingsMap.clinic_website || ''
      });

      setSystemSettings({
        currency: settingsMap.currency || 'IDR',
        timezone: settingsMap.timezone || 'Asia/Jakarta',
        date_format: settingsMap.date_format || 'DD/MM/YYYY',
        receipt_footer: settingsMap.receipt_footer || 'Terima kasih atas kunjungan Anda!'
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSetting = async (key: string, value: string, description?: string) => {
    try {
      const updateData: UpdateSettingsInput = {
        key,
        value,
        description
      };
      await trpc.updateSetting.mutate(updateData);
    } catch (error) {
      console.error(`Failed to save setting ${key}:`, error);
      throw error;
    }
  };

  const saveClinicInfo = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        saveSetting('clinic_name', clinicInfo.clinic_name, 'Nama klinik/rumah sakit'),
        saveSetting('clinic_address', clinicInfo.clinic_address, 'Alamat lengkap klinik'),
        saveSetting('clinic_phone', clinicInfo.clinic_phone, 'Nomor telepon klinik'),
        saveSetting('clinic_email', clinicInfo.clinic_email, 'Email klinik'),
        saveSetting('clinic_website', clinicInfo.clinic_website, 'Website klinik')
      ]);
      
      alert('Informasi klinik berhasil disimpan!');
      await loadSettings();
    } catch (error) {
      alert('Gagal menyimpan informasi klinik. Silakan coba lagi.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveSystemSettings = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        saveSetting('currency', systemSettings.currency, 'Mata uang default'),
        saveSetting('timezone', systemSettings.timezone, 'Zona waktu sistem'),
        saveSetting('date_format', systemSettings.date_format, 'Format tanggal'),
        saveSetting('receipt_footer', systemSettings.receipt_footer, 'Footer pada struk pembayaran')
      ]);
      
      alert('Pengaturan sistem berhasil disimpan!');
      await loadSettings();
    } catch (error) {
      alert('Gagal menyimpan pengaturan sistem. Silakan coba lagi.');
    } finally {
      setIsSaving(false);
    }
  };

  const initializeDefaultSettings = async () => {
    setIsSaving(true);
    try {
      await trpc.initializeDefaultSettings.mutate();
      alert('Pengaturan default berhasil diinisialisasi!');
      await loadSettings();
    } catch (error) {
      alert('Gagal menginisialisasi pengaturan default.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // In a real application, this would upload to a server
      alert('Fitur upload logo sedang dalam pengembangan. Logo akan disimpan dan ditampilkan di aplikasi.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-48"></div>
              <div className="h-4 bg-gray-200 rounded w-64"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <SettingsIcon className="h-6 w-6" />
          ⚙️ Pengaturan Sistem
        </h2>
        <p className="text-indigo-100">
          Kelola pengaturan klinik, branding, dan konfigurasi sistem
        </p>
      </div>

      {/* Clinic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Informasi Klinik
          </CardTitle>
          <CardDescription>
            Pengaturan informasi dasar klinik yang akan ditampilkan di aplikasi dan struk pembayaran
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clinic_name">Nama Klinik *</Label>
              <Input
                id="clinic_name"
                value={clinicInfo.clinic_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setClinicInfo(prev => ({ ...prev, clinic_name: e.target.value }))
                }
                placeholder="Nama klinik atau rumah sakit"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clinic_phone">Nomor Telepon</Label>
              <Input
                id="clinic_phone"
                value={clinicInfo.clinic_phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setClinicInfo(prev => ({ ...prev, clinic_phone: e.target.value }))
                }
                placeholder="Contoh: (021) 12345678"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clinic_address">Alamat Lengkap</Label>
            <Textarea
              id="clinic_address"
              value={clinicInfo.clinic_address}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setClinicInfo(prev => ({ ...prev, clinic_address: e.target.value }))
              }
              placeholder="Alamat lengkap klinik"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clinic_email">Email</Label>
              <Input
                id="clinic_email"
                type="email"
                value={clinicInfo.clinic_email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setClinicInfo(prev => ({ ...prev, clinic_email: e.target.value }))
                }
                placeholder="email@klinik.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clinic_website">Website</Label>
              <Input
                id="clinic_website"
                value={clinicInfo.clinic_website}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setClinicInfo(prev => ({ ...prev, clinic_website: e.target.value }))
                }
                placeholder="https://www.klinik.com"
              />
            </div>
          </div>

          <Button 
            onClick={saveClinicInfo} 
            disabled={isSaving}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Menyimpan...' : 'Simpan Informasi Klinik'}
          </Button>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Branding & Logo
          </CardTitle>
          <CardDescription>
            Pengaturan tampilan dan identitas visual klinik
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4 p-4 border-2 border-dashed border-gray-300 rounded-lg">
            <div className="flex-1">
              <h3 className="font-medium">Logo Klinik</h3>
              <p className="text-sm text-gray-600">
                Upload logo klinik (format: PNG, JPG, maksimal 2MB)
              </p>
              <Badge variant="secondary" className="mt-2">
                Rekomendasi: 200x80 piksel
              </Badge>
            </div>
            <div className="flex-shrink-0">
              <label htmlFor="logo-upload" className="cursor-pointer">
                <Button asChild>
                  <span className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload Logo
                  </span>
                </Button>
              </label>
              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </div>
          </div>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              💡 <strong>Tips:</strong> Logo akan ditampilkan di header aplikasi dan pada struk pembayaran. 
              Pastikan logo memiliki kontras yang baik dan mudah dibaca.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* System Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Pengaturan Sistem
          </CardTitle>
          <CardDescription>
            Konfigurasi sistem dan format tampilan data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Mata Uang</Label>
              <Input
                id="currency"
                value={systemSettings.currency}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSystemSettings(prev => ({ ...prev, currency: e.target.value }))
                }
                placeholder="IDR"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Zona Waktu</Label>
              <Input
                id="timezone"
                value={systemSettings.timezone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSystemSettings(prev => ({ ...prev, timezone: e.target.value }))
                }
                placeholder="Asia/Jakarta"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date_format">Format Tanggal</Label>
            <Input
              id="date_format"
              value={systemSettings.date_format}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSystemSettings(prev => ({ ...prev, date_format: e.target.value }))
              }
              placeholder="DD/MM/YYYY"
            />
            <p className="text-xs text-gray-500">
              Format: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
            </p>
          </div>

          <Button 
            onClick={saveSystemSettings} 
            disabled={isSaving}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan Sistem'}
          </Button>
        </CardContent>
      </Card>

      {/* Receipt Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Pengaturan Struk Pembayaran
          </CardTitle>
          <CardDescription>
            Konfigurasi tampilan dan format struk pembayaran
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="receipt_footer">Footer Struk</Label>
            <Textarea
              id="receipt_footer"
              value={systemSettings.receipt_footer}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setSystemSettings(prev => ({ ...prev, receipt_footer: e.target.value }))
              }
              placeholder="Terima kasih atas kunjungan Anda!"
              rows={3}
            />
            <p className="text-xs text-gray-500">
              Pesan yang akan ditampilkan di bagian bawah struk pembayaran
            </p>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">Preview Struk:</h4>
            <div className="bg-white p-4 border rounded font-mono text-sm">
              <div className="text-center mb-2">
                <strong>{clinicInfo.clinic_name}</strong><br />
                {clinicInfo.clinic_address && <span>{clinicInfo.clinic_address}<br /></span>}
                {clinicInfo.clinic_phone && <span>Tel: {clinicInfo.clinic_phone}</span>}
              </div>
              <div className="border-t border-dashed my-2 pt-2">
                <div>Struk: #12345</div>
                <div>Tanggal: 01/01/2024</div>
                <div>Pasien: Contoh Pasien</div>
              </div>
              <div className="border-t border-dashed my-2 pt-2">
                <div className="flex justify-between">
                  <span>Konsultasi</span>
                  <span>Rp 100.000</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-1">
                  <span>TOTAL:</span>
                  <span>Rp 100.000</span>
                </div>
              </div>
              <div className="border-t border-dashed my-2 pt-2 text-center text-xs">
                {systemSettings.receipt_footer}
              </div>
            </div>
          </div>

          <Button 
            onClick={saveSystemSettings} 
            disabled={isSaving}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan Struk'}
          </Button>
        </CardContent>
      </Card>

      {/* System Maintenance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Pemeliharaan Sistem
          </CardTitle>
          <CardDescription>
            Tools untuk pemeliharaan dan reset sistem
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={initializeDefaultSettings}
              disabled={isSaving}
              className="h-20 flex flex-col gap-2"
            >
              <Database className="h-5 w-5" />
              <span className="text-sm">Reset Pengaturan Default</span>
            </Button>

            <Button
              variant="outline"
              onClick={loadSettings}
              disabled={isLoading}
              className="h-20 flex flex-col gap-2"
            >
              <SettingsIcon className="h-5 w-5" />
              <span className="text-sm">Refresh Pengaturan</span>
            </Button>
          </div>

          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-800">
              ⚠️ <strong>Peringatan:</strong> Reset pengaturan default akan mengembalikan semua pengaturan 
              ke nilai awal. Pastikan Anda telah membackup konfigurasi penting sebelum melakukan reset.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Current Settings Display */}
      <Card>
        <CardHeader>
          <CardTitle>Pengaturan Saat Ini</CardTitle>
          <CardDescription>
            Daftar semua pengaturan yang tersimpan di sistem
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settings.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Belum ada pengaturan tersimpan</p>
          ) : (
            <div className="space-y-2">
              {settings.map((setting: SettingsType) => (
                <div key={setting.key} className="flex justify-between items-center p-2 border rounded">
                  <div>
                    <span className="font-medium">{setting.key}</span>
                    {setting.description && (
                      <p className="text-xs text-gray-500">{setting.description}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {setting.value.length > 30 ? `${setting.value.substring(0, 30)}...` : setting.value}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}