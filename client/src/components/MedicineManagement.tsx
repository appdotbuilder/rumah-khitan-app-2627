import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/utils/trpc';
import { 
  Plus, 
  Search, 
  Edit, 
  AlertTriangle, 
  Package, 
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign
} from 'lucide-react';
import type { Medicine, CreateMedicineInput, MedicineSearchInput, CreateStockMovementInput } from '../../../server/src/schema';

export default function MedicineManagement() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [lowStockMedicines, setLowStockMedicines] = useState<Medicine[]>([]);
  const [expiredMedicines, setExpiredMedicines] = useState<Medicine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);

  const [formData, setFormData] = useState<CreateMedicineInput>({
    name: '',
    description: null,
    unit: '',
    price_per_unit: 0,
    stock_quantity: 0,
    minimum_stock: 5,
    expiry_date: null,
    supplier: null
  });

  const [stockMovementData, setStockMovementData] = useState<CreateStockMovementInput>({
    medicine_id: 0,
    movement_type: 'masuk',
    quantity: 0,
    reference_id: null,
    notes: null
  });

  const loadMedicines = useCallback(async (searchParams?: MedicineSearchInput) => {
    try {
      setIsLoading(true);
      const params = searchParams || { limit: 50, offset: 0, low_stock_only: false, expired_only: false };
      const result = await trpc.getMedicines.query(params);
      setMedicines(result);
    } catch (error) {
      console.error('Failed to load medicines:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadLowStockMedicines = useCallback(async () => {
    try {
      const result = await trpc.getLowStockMedicines.query();
      setLowStockMedicines(result);
    } catch (error) {
      console.error('Failed to load low stock medicines:', error);
    }
  }, []);

  const loadExpiredMedicines = useCallback(async () => {
    try {
      const result = await trpc.getExpiredMedicines.query();
      setExpiredMedicines(result);
    } catch (error) {
      console.error('Failed to load expired medicines:', error);
    }
  }, []);

  useEffect(() => {
    loadMedicines();
    loadLowStockMedicines();
    loadExpiredMedicines();
  }, [loadMedicines, loadLowStockMedicines, loadExpiredMedicines]);

  const handleSearch = useCallback(async () => {
    if (searchQuery.trim()) {
      await loadMedicines({ query: searchQuery.trim(), limit: 50, offset: 0, low_stock_only: false, expired_only: false });
    } else {
      await loadMedicines();
    }
  }, [searchQuery, loadMedicines]);

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
      if (editingMedicine) {
        const response = await trpc.updateMedicine.mutate({
          id: editingMedicine.id,
          ...formData
        });
        setMedicines((prev: Medicine[]) => 
          prev.map(m => m.id === editingMedicine.id ? response : m)
        );
      } else {
        const response = await trpc.createMedicine.mutate(formData);
        setMedicines((prev: Medicine[]) => [response, ...prev]);
      }
      
      // Reset form and close dialog
      setFormData({
        name: '',
        description: null,
        unit: '',
        price_per_unit: 0,
        stock_quantity: 0,
        minimum_stock: 5,
        expiry_date: null,
        supplier: null
      });
      setEditingMedicine(null);
      setIsDialogOpen(false);
      
      // Refresh related data
      loadLowStockMedicines();
    } catch (error) {
      console.error('Failed to save medicine:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStockMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedicine) return;

    setIsLoading(true);
    try {
      await trpc.createStockMovement.mutate({
        ...stockMovementData,
        medicine_id: selectedMedicine.id
      });
      
      // Reload medicines and related data
      await loadMedicines();
      await loadLowStockMedicines();
      
      setStockMovementData({
        medicine_id: 0,
        movement_type: 'masuk',
        quantity: 0,
        reference_id: null,
        notes: null
      });
      setSelectedMedicine(null);
      setIsStockDialogOpen(false);
    } catch (error) {
      console.error('Failed to create stock movement:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (medicine: Medicine) => {
    setEditingMedicine(medicine);
    setFormData({
      name: medicine.name,
      description: medicine.description,
      unit: medicine.unit,
      price_per_unit: medicine.price_per_unit,
      stock_quantity: medicine.stock_quantity,
      minimum_stock: medicine.minimum_stock,
      expiry_date: medicine.expiry_date,
      supplier: medicine.supplier
    });
    setIsDialogOpen(true);
  };

  const openStockDialog = (medicine: Medicine) => {
    setSelectedMedicine(medicine);
    setStockMovementData(prev => ({
      ...prev,
      medicine_id: medicine.id,
      movement_type: 'masuk',
      quantity: 0,
      notes: null
    }));
    setIsStockDialogOpen(true);
  };

  const isExpiringSoon = (expiryDate: Date | null) => {
    if (!expiryDate) return false;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysDiff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24));
    return daysDiff <= 30 && daysDiff > 0;
  };

  const isExpired = (expiryDate: Date | null) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">💊 Manajemen Obat</h2>
          <p className="text-gray-600">Kelola inventori obat dan pergerakan stok</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4" />
              Tambah Obat
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingMedicine ? 'Edit Obat' : 'Tambah Obat Baru'}
                </DialogTitle>
                <DialogDescription>
                  {editingMedicine ? 'Edit informasi obat' : 'Masukkan informasi obat baru'}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nama Obat *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreateMedicineInput) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="Nama obat"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="unit">Satuan *</Label>
                    <Input
                      id="unit"
                      value={formData.unit}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreateMedicineInput) => ({ ...prev, unit: e.target.value }))
                      }
                      placeholder="tablet, botol, strip, dll"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Deskripsi</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setFormData((prev: CreateMedicineInput) => ({ 
                        ...prev, 
                        description: e.target.value || null 
                      }))
                    }
                    placeholder="Deskripsi obat, kegunaan, dll"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Harga per Unit *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price_per_unit}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreateMedicineInput) => ({ 
                          ...prev, 
                          price_per_unit: parseFloat(e.target.value) || 0 
                        }))
                      }
                      placeholder="0"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="stock">Jumlah Stok *</Label>
                    <Input
                      id="stock"
                      type="number"
                      min="0"
                      value={formData.stock_quantity}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreateMedicineInput) => ({ 
                          ...prev, 
                          stock_quantity: parseInt(e.target.value) || 0 
                        }))
                      }
                      placeholder="0"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min_stock">Minimum Stok *</Label>
                    <Input
                      id="min_stock"
                      type="number"
                      min="0"
                      value={formData.minimum_stock}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreateMedicineInput) => ({ 
                          ...prev, 
                          minimum_stock: parseInt(e.target.value) || 0 
                        }))
                      }
                      placeholder="5"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="expiry">Tanggal Kadaluarsa</Label>
                    <Input
                      id="expiry"
                      type="date"
                      value={formData.expiry_date instanceof Date ? 
                        formData.expiry_date.toISOString().split('T')[0] : 
                        formData.expiry_date || ''
                      }
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreateMedicineInput) => ({ 
                          ...prev, 
                          expiry_date: e.target.value ? new Date(e.target.value) : null 
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier</Label>
                  <Input
                    id="supplier"
                    value={formData.supplier || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreateMedicineInput) => ({ 
                        ...prev, 
                        supplier: e.target.value || null 
                      }))
                    }
                    placeholder="Nama supplier"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingMedicine(null);
                  }}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Menyimpan...' : editingMedicine ? 'Update' : 'Simpan'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stock Movement Dialog */}
      <Dialog open={isStockDialogOpen} onOpenChange={setIsStockDialogOpen}>
        <DialogContent>
          <form onSubmit={handleStockMovement}>
            <DialogHeader>
              <DialogTitle>Pergerakan Stok</DialogTitle>
              <DialogDescription>
                Tambah atau kurangi stok untuk: {selectedMedicine?.name}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Jenis Pergerakan</Label>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="movement_type"
                      value="masuk"
                      checked={stockMovementData.movement_type === 'masuk'}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setStockMovementData(prev => ({ ...prev, movement_type: e.target.value as 'masuk' | 'keluar' }))
                      }
                    />
                    <span className="text-green-600">📈 Stok Masuk</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="movement_type"
                      value="keluar"
                      checked={stockMovementData.movement_type === 'keluar'}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setStockMovementData(prev => ({ ...prev, movement_type: e.target.value as 'masuk' | 'keluar' }))
                      }
                    />
                    <span className="text-red-600">📉 Stok Keluar</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Jumlah *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={stockMovementData.quantity}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setStockMovementData(prev => ({ 
                      ...prev, 
                      quantity: parseInt(e.target.value) || 0 
                    }))
                  }
                  placeholder="0"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Catatan</Label>
                <Textarea
                  id="notes"
                  value={stockMovementData.notes || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setStockMovementData(prev => ({ 
                      ...prev, 
                      notes: e.target.value || null 
                    }))
                  }
                  placeholder="Alasan pergerakan stok"
                  rows={2}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsStockDialogOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">Semua Obat</TabsTrigger>
          <TabsTrigger value="low-stock" className="flex items-center gap-2">
            Stok Menipis
            {lowStockMedicines.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {lowStockMedicines.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="expired" className="flex items-center gap-2">
            Kadaluarsa
            {expiredMedicines.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {expiredMedicines.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="search">Pencarian</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5" />
                Cari Obat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Cari berdasarkan nama obat..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <MedicineList 
            medicines={medicines} 
            isLoading={isLoading} 
            onEdit={handleEdit}
            onStockMovement={openStockDialog}
          />
        </TabsContent>

        <TabsContent value="low-stock" className="space-y-4">
          <MedicineList 
            medicines={lowStockMedicines} 
            isLoading={isLoading} 
            onEdit={handleEdit}
            onStockMovement={openStockDialog}
            showAlert="low-stock"
          />
        </TabsContent>

        <TabsContent value="expired" className="space-y-4">
          <MedicineList 
            medicines={expiredMedicines} 
            isLoading={isLoading} 
            onEdit={handleEdit}
            onStockMovement={openStockDialog}
            showAlert="expired"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface MedicineListProps {
  medicines: Medicine[];
  isLoading: boolean;
  onEdit: (medicine: Medicine) => void;
  onStockMovement: (medicine: Medicine) => void;
  showAlert?: 'low-stock' | 'expired';
}

function MedicineList({ medicines, isLoading, onEdit, onStockMovement, showAlert }: MedicineListProps) {
  const isExpiringSoon = (expiryDate: Date | null) => {
    if (!expiryDate) return false;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysDiff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24));
    return daysDiff <= 30 && daysDiff > 0;
  };

  const isExpired = (expiryDate: Date | null) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  if (isLoading) {
    return (
      <div className="grid gap-4">
        {[...Array(3)].map((_, i) => (
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
        ))}
      </div>
    );
  }

  if (medicines.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500 text-center">
            {showAlert === 'low-stock' ? 'Tidak ada obat dengan stok menipis' :
             showAlert === 'expired' ? 'Tidak ada obat yang kadaluarsa' :
             'Belum ada obat terdaftar'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {medicines.map((medicine: Medicine) => (
        <Card 
          key={medicine.id} 
          className={`hover:shadow-md transition-shadow ${
            isExpired(medicine.expiry_date) ? 'border-red-200 bg-red-50' :
            isExpiringSoon(medicine.expiry_date) ? 'border-orange-200 bg-orange-50' :
            medicine.stock_quantity <= medicine.minimum_stock ? 'border-yellow-200 bg-yellow-50' :
            ''
          }`}
        >
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {medicine.name}
                  </h3>
                  
                  <Badge variant="outline">
                    {medicine.unit}
                  </Badge>
                  
                  {medicine.stock_quantity <= medicine.minimum_stock && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Stok Menipis
                    </Badge>
                  )}
                  
                  {isExpired(medicine.expiry_date) && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Kadaluarsa
                    </Badge>
                  )}
                  
                  {isExpiringSoon(medicine.expiry_date) && !isExpired(medicine.expiry_date) && (
                    <Badge variant="secondary" className="flex items-center gap-1 bg-orange-100 text-orange-800">
                      <Calendar className="h-3 w-3" />
                      Segera Kadaluarsa
                    </Badge>
                  )}
                </div>
                
                {medicine.description && (
                  <p className="text-gray-600 text-sm">{medicine.description}</p>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span>Rp {medicine.price_per_unit.toLocaleString('id-ID')}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-blue-600" />
                    <span>Stok: {medicine.stock_quantity}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <span>Min: {medicine.minimum_stock}</span>
                  </div>
                  
                  {medicine.expiry_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-purple-600" />
                      <span>Exp: {new Date(medicine.expiry_date).toLocaleDateString('id-ID')}</span>
                    </div>
                  )}
                </div>

                {medicine.supplier && (
                  <p className="text-sm text-gray-500">
                    Supplier: {medicine.supplier}
                  </p>
                )}

                <div className="text-xs text-gray-400">
                  Ditambahkan: {medicine.created_at.toLocaleDateString('id-ID')}
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onEdit(medicine)}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => onStockMovement(medicine)}
                  className="flex items-center gap-2"
                >
                  <TrendingUp className="h-4 w-4" />
                  Stok
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}