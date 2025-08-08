import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/utils/trpc';
import { 
  Plus, 
  Minus, 
  Search, 
  ShoppingCart, 
  CreditCard, 
  Receipt,
  User,
  Pill,
  Stethoscope,
  Printer,
  Check,
  X,
  Clock
} from 'lucide-react';
import type { 
  Patient, 
  Medicine, 
  Service, 
  Transaction,
  CreateTransactionInput 
} from '../../../server/src/schema';

interface CartItem {
  type: 'service' | 'medicine';
  id: number;
  name: string;
  price: number;
  quantity: number;
  unit?: string;
  max_quantity?: number;
}

export default function CashierSystem() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'tunai' | 'transfer' | 'kartu'>('tunai');
  const [notes, setNotes] = useState<string>('');
  const [searchPatientQuery, setSearchPatientQuery] = useState('');
  const [searchItemQuery, setSearchItemQuery] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);

  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [patientsResult, medicinesResult, servicesResult, transactionsResult] = await Promise.all([
        trpc.getPatients.query({ limit: 100, offset: 0 }),
        trpc.getMedicines.query({ limit: 100, offset: 0, low_stock_only: false, expired_only: false }),
        trpc.getServices.query(true), // Only active services
        trpc.getTodayTransactions.query()
      ]);
      
      setPatients(patientsResult);
      setMedicines(medicinesResult);
      setServices(servicesResult);
      setTransactions(transactionsResult);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchPatientQuery.toLowerCase())
  );

  const filteredItems = [
    ...services
      .filter(service => 
        service.name.toLowerCase().includes(searchItemQuery.toLowerCase()) &&
        service.is_active
      )
      .map(service => ({
        type: 'service' as const,
        id: service.id,
        name: service.name,
        price: service.price,
        description: service.description
      })),
    ...medicines
      .filter(medicine => 
        medicine.name.toLowerCase().includes(searchItemQuery.toLowerCase()) &&
        medicine.stock_quantity > 0
      )
      .map(medicine => ({
        type: 'medicine' as const,
        id: medicine.id,
        name: medicine.name,
        price: medicine.price_per_unit,
        unit: medicine.unit,
        stock: medicine.stock_quantity
      }))
  ];

  const addToCart = (item: { type: 'service' | 'medicine'; id: number; name: string; price: number; unit?: string; stock?: number }) => {
    const existingItem = cart.find(cartItem => 
      cartItem.type === item.type && cartItem.id === item.id
    );

    if (existingItem) {
      setCart(prev => prev.map(cartItem =>
        cartItem.type === item.type && cartItem.id === item.id
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      ));
    } else {
      setCart(prev => [...prev, {
        type: item.type,
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        unit: item.unit,
        max_quantity: item.stock
      }]);
    }
  };

  const updateCartQuantity = (type: 'service' | 'medicine', id: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(type, id);
      return;
    }

    setCart(prev => prev.map(item =>
      item.type === type && item.id === id
        ? { ...item, quantity }
        : item
    ));
  };

  const removeFromCart = (type: 'service' | 'medicine', id: number) => {
    setCart(prev => prev.filter(item => !(item.type === type && item.id === id)));
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handleCheckout = async () => {
    if (!selectedPatient || cart.length === 0) return;

    setIsLoading(true);
    try {
      const transactionData: CreateTransactionInput = {
        patient_id: selectedPatient.id,
        payment_method: paymentMethod,
        payment_status: 'paid',
        notes: notes || null,
        services: cart.filter(item => item.type === 'service').map(item => ({
          service_id: item.id,
          quantity: item.quantity
        })),
        medicines: cart.filter(item => item.type === 'medicine').map(item => ({
          medicine_id: item.id,
          quantity: item.quantity
        }))
      };

      const response = await trpc.createTransaction.mutate(transactionData);
      
      // Reset form
      setCart([]);
      setNotes('');
      setLastTransaction(response);
      setShowReceipt(true);
      
      // Refresh data
      loadInitialData();
    } catch (error) {
      console.error('Failed to create transaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTransactionStatus = async (transactionId: number, status: 'paid' | 'cancelled') => {
    try {
      await trpc.updateTransactionStatus.mutate({ id: transactionId, status });
      // Refresh transactions
      const updatedTransactions = await trpc.getTodayTransactions.query();
      setTransactions(updatedTransactions);
    } catch (error) {
      console.error('Failed to update transaction status:', error);
    }
  };

  const printReceipt = async (transactionId: number) => {
    try {
      // In a real application, this would integrate with a thermal printer
      // For now, we'll open a print dialog
      const receiptData = await trpc.generateReceiptData.query(transactionId);
      
      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Struk Pembayaran</title>
              <style>
                body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 20px; }
                .center { text-align: center; }
                .left { text-align: left; }
                .right { text-align: right; }
                .line { border-top: 1px dashed #000; margin: 10px 0; }
                table { width: 100%; }
                .total { font-weight: bold; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="center">
                <h2>RUMAH KHITAN SUPER MODERN PAK NOPI</h2>
                <p>Sistem Klinik Modern</p>
                <div class="line"></div>
              </div>
              
              <div class="left">
                <p>Struk: #${receiptData.transaction_id}</p>
                <p>Tanggal: ${new Date(receiptData.date).toLocaleDateString('id-ID')}</p>
                <p>Pasien: ${receiptData.patient_name}</p>
                <p>Kasir: Admin</p>
              </div>
              
              <div class="line"></div>
              
              <table>
                ${receiptData.items.map((item: any) => `
                  <tr>
                    <td>${item.name}</td>
                    <td class="right">${item.quantity}x</td>
                    <td class="right">Rp ${item.total.toLocaleString('id-ID')}</td>
                  </tr>
                `).join('')}
              </table>
              
              <div class="line"></div>
              
              <table class="total">
                <tr>
                  <td>TOTAL:</td>
                  <td class="right">Rp ${receiptData.total.toLocaleString('id-ID')}</td>
                </tr>
                <tr>
                  <td>Pembayaran:</td>
                  <td class="right">${receiptData.payment_method.toUpperCase()}</td>
                </tr>
              </table>
              
              <div class="line"></div>
              <div class="center">
                <p>Terima kasih atas kunjungan Anda!</p>
                <p>Semoga lekas sembuh</p>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (error) {
      console.error('Failed to generate receipt:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <CreditCard className="h-6 w-6" />
          💰 Sistem Kasir
        </h2>
        <p className="text-green-100">
          Proses pembayaran dan cetak struk untuk pasien
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Patient & Items Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Pilih Pasien
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input
                  placeholder="Cari nama pasien..."
                  value={searchPatientQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchPatientQuery(e.target.value)}
                  className="mb-2"
                />
                
                {selectedPatient && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-green-800">{selectedPatient.name}</h3>
                        <p className="text-sm text-green-600">
                          {selectedPatient.gender} | {selectedPatient.phone || 'No phone'}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPatient(null)}
                      >
                        Ganti
                      </Button>
                    </div>
                  </div>
                )}
                
                {!selectedPatient && (
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {filteredPatients.slice(0, 5).map((patient: Patient) => (
                      <div
                        key={patient.id}
                        className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedPatient(patient)}
                      >
                        <h3 className="font-medium">{patient.name}</h3>
                        <p className="text-sm text-gray-600">
                          {patient.gender} | {patient.phone || 'No phone'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Items Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Pilih Layanan & Obat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Cari layanan atau obat..."
                value={searchItemQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchItemQuery(e.target.value)}
                className="mb-4"
              />
              
              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredItems.map((item: any) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {item.type === 'service' ? (
                          <Stethoscope className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Pill className="h-4 w-4 text-green-600" />
                        )}
                        <h3 className="font-medium">{item.name}</h3>
                        {item.type === 'medicine' && (
                          <Badge variant="outline" className="text-xs">
                            Stok: {item.stock}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        Rp {item.price.toLocaleString('id-ID')}
                        {item.unit && ` per ${item.unit}`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => addToCart(item)}
                      disabled={Boolean(!selectedPatient || (item.type === 'medicine' && (item.stock === undefined || item.stock === 0)))}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Cart & Checkout */}
        <div className="space-y-6">
          {/* Shopping Cart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Keranjang
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Keranjang kosong</p>
              ) : (
                <div className="space-y-3">
                  {cart.map((item: CartItem) => (
                    <div key={`${item.type}-${item.id}`} className="flex justify-between items-center p-2 border rounded">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{item.name}</h4>
                        <p className="text-xs text-gray-600">
                          Rp {item.price.toLocaleString('id-ID')}
                          {item.unit && ` per ${item.unit}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateCartQuantity(item.type, item.id, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-medium min-w-[2rem] text-center">
                          {item.quantity}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateCartQuantity(item.type, item.id, item.quantity + 1)}
                          disabled={Boolean(item.max_quantity && item.quantity >= item.max_quantity)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeFromCart(item.type, item.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-3 border-t">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total:</span>
                      <span>Rp {calculateTotal().toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Checkout */}
          {cart.length > 0 && selectedPatient && (
            <Card>
              <CardHeader>
                <CardTitle>Pembayaran</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Metode Pembayaran</Label>
                  <Select value={paymentMethod} onValueChange={(value: 'tunai' | 'transfer' | 'kartu') => setPaymentMethod(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tunai">💵 Tunai</SelectItem>
                      <SelectItem value="transfer">🏦 Transfer</SelectItem>
                      <SelectItem value="kartu">💳 Kartu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Catatan (opsional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                    placeholder="Catatan tambahan..."
                    rows={2}
                  />
                </div>

                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={handleCheckout}
                  disabled={isLoading}
                >
                  {isLoading ? 'Memproses...' : `Bayar Rp ${calculateTotal().toLocaleString('id-ID')}`}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Today's Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Transaksi Hari Ini
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Belum ada transaksi hari ini</p>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction: Transaction) => (
                <div key={transaction.id} className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">Transaksi #{transaction.id}</h3>
                    <p className="text-sm text-gray-600">
                      {new Date(transaction.created_at).toLocaleTimeString('id-ID')} | 
                      Rp {transaction.total_amount.toLocaleString('id-ID')}
                    </p>
                    <Badge 
                      variant={
                        transaction.payment_status === 'paid' ? 'default' : 
                        transaction.payment_status === 'pending' ? 'secondary' : 'destructive'
                      }
                      className="mt-1"
                    >
                      {transaction.payment_status === 'paid' ? '✅ Lunas' :
                       transaction.payment_status === 'pending' ? '⏳ Pending' : '❌ Dibatalkan'}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => printReceipt(transaction.id)}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                    {transaction.payment_status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => updateTransactionStatus(transaction.id, 'paid')}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateTransactionStatus(transaction.id, 'cancelled')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Transaksi Berhasil!
            </DialogTitle>
            <DialogDescription>
              Transaksi telah berhasil diproses. Cetak struk pembayaran?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {lastTransaction && (
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 mb-2">
                  Rp {lastTransaction.total_amount.toLocaleString('id-ID')}
                </div>
                <p className="text-gray-600">
                  Transaksi #{lastTransaction.id} - {selectedPatient?.name}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceipt(false)}>
              Tutup
            </Button>
            <Button onClick={() => {
              if (lastTransaction) printReceipt(lastTransaction.id);
              setShowReceipt(false);
            }}>
              <Printer className="h-4 w-4 mr-2" />
              Cetak Struk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}