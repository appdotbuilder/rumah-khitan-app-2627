import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/utils/trpc';
import { Plus, Search, Edit, Calendar, Phone, MapPin, AlertCircle } from 'lucide-react';
import type { Patient, CreatePatientInput, PatientSearchInput } from '../../../server/src/schema';

export default function PatientManagement() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  const [formData, setFormData] = useState<CreatePatientInput>({
    name: '',
    date_of_birth: new Date(),
    gender: 'Laki-laki',
    phone: null,
    address: null,
    emergency_contact: null,
    medical_notes: null
  });

  const loadPatients = useCallback(async (searchParams?: PatientSearchInput) => {
    try {
      setIsLoading(true);
      const params = searchParams || { limit: 50, offset: 0 };
      const result = await trpc.getPatients.query(params);
      setPatients(result);
    } catch (error) {
      console.error('Failed to load patients:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const handleSearch = useCallback(async () => {
    if (searchQuery.trim()) {
      await loadPatients({ query: searchQuery.trim(), limit: 50, offset: 0 });
    } else {
      await loadPatients();
    }
  }, [searchQuery, loadPatients]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, handleSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingPatient) {
        const response = await trpc.updatePatient.mutate({
          id: editingPatient.id,
          ...formData
        });
        setPatients((prev: Patient[]) => 
          prev.map(p => p.id === editingPatient.id ? response : p)
        );
      } else {
        const response = await trpc.createPatient.mutate(formData);
        setPatients((prev: Patient[]) => [response, ...prev]);
      }
      
      // Reset form and close dialog
      setFormData({
        name: '',
        date_of_birth: new Date(),
        gender: 'Laki-laki',
        phone: null,
        address: null,
        emergency_contact: null,
        medical_notes: null
      });
      setEditingPatient(null);
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to save patient:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (patient: Patient) => {
    setEditingPatient(patient);
    setFormData({
      name: patient.name,
      date_of_birth: patient.date_of_birth,
      gender: patient.gender,
      phone: patient.phone,
      address: patient.address,
      emergency_contact: patient.emergency_contact,
      medical_notes: patient.medical_notes
    });
    setIsDialogOpen(true);
  };

  const calculateAge = (birthDate: Date) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">👥 Manajemen Pasien</h2>
          <p className="text-gray-600">Kelola data pasien dan riwayat kunjungan</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4" />
              Tambah Pasien
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingPatient ? 'Edit Pasien' : 'Tambah Pasien Baru'}
                </DialogTitle>
                <DialogDescription>
                  {editingPatient ? 'Edit informasi pasien' : 'Masukkan informasi pasien baru'}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nama Lengkap *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreatePatientInput) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="Masukkan nama lengkap"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="gender">Jenis Kelamin *</Label>
                    <Select 
                      value={formData.gender} 
                      onValueChange={(value: 'Laki-laki' | 'Perempuan') =>
                        setFormData((prev: CreatePatientInput) => ({ ...prev, gender: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                        <SelectItem value="Perempuan">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birth_date">Tanggal Lahir *</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={formData.date_of_birth instanceof Date ? 
                      formData.date_of_birth.toISOString().split('T')[0] : 
                      formData.date_of_birth
                    }
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreatePatientInput) => ({ 
                        ...prev, 
                        date_of_birth: new Date(e.target.value) 
                      }))
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Nomor Telepon</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreatePatientInput) => ({ 
                        ...prev, 
                        phone: e.target.value || null 
                      }))
                    }
                    placeholder="Contoh: 081234567890"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Alamat</Label>
                  <Textarea
                    id="address"
                    value={formData.address || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setFormData((prev: CreatePatientInput) => ({ 
                        ...prev, 
                        address: e.target.value || null 
                      }))
                    }
                    placeholder="Masukkan alamat lengkap"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emergency_contact">Kontak Darurat</Label>
                  <Input
                    id="emergency_contact"
                    value={formData.emergency_contact || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreatePatientInput) => ({ 
                        ...prev, 
                        emergency_contact: e.target.value || null 
                      }))
                    }
                    placeholder="Nama dan nomor kontak darurat"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="medical_notes">Catatan Medis</Label>
                  <Textarea
                    id="medical_notes"
                    value={formData.medical_notes || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setFormData((prev: CreatePatientInput) => ({ 
                        ...prev, 
                        medical_notes: e.target.value || null 
                      }))
                    }
                    placeholder="Alergi, riwayat penyakit, dll."
                    rows={3}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingPatient(null);
                    setFormData({
                      name: '',
                      date_of_birth: new Date(),
                      gender: 'Laki-laki',
                      phone: null,
                      address: null,
                      emergency_contact: null,
                      medical_notes: null
                    });
                  }}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Menyimpan...' : editingPatient ? 'Update' : 'Simpan'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Cari Pasien
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Cari berdasarkan nama..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Patient List */}
      <div className="grid gap-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="h-6 bg-gray-200 rounded w-48"></div>
                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                    <div className="h-4 bg-gray-200 rounded w-64"></div>
                  </div>
                  <div className="h-9 w-20 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : patients.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-center">
                {searchQuery ? 'Tidak ada pasien yang ditemukan' : 'Belum ada pasien terdaftar'}
              </p>
            </CardContent>
          </Card>
        ) : (
          patients.map((patient: Patient) => (
            <Card key={patient.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold text-gray-900">
                        {patient.name}
                      </h3>
                      <Badge variant={patient.gender === 'Laki-laki' ? 'default' : 'secondary'}>
                        {patient.gender}
                      </Badge>
                      <Badge variant="outline">
                        {calculateAge(patient.date_of_birth)} tahun
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Lahir: {new Date(patient.date_of_birth).toLocaleDateString('id-ID')}
                      </div>
                      
                      {patient.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {patient.phone}
                        </div>
                      )}
                      
                      {patient.address && (
                        <div className="flex items-center gap-2 md:col-span-2">
                          <MapPin className="h-4 w-4" />
                          {patient.address}
                        </div>
                      )}
                      
                      {patient.emergency_contact && (
                        <div className="flex items-center gap-2 md:col-span-2">
                          <AlertCircle className="h-4 w-4" />
                          Kontak Darurat: {patient.emergency_contact}
                        </div>
                      )}
                    </div>

                    {patient.medical_notes && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          <strong>Catatan Medis:</strong> {patient.medical_notes}
                        </p>
                      </div>
                    )}

                    <div className="text-xs text-gray-400">
                      Terdaftar: {patient.created_at.toLocaleDateString('id-ID')}
                    </div>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleEdit(patient)}
                    className="flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}