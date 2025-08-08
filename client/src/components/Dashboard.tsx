import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/utils/trpc';
import { Users, Pill, DollarSign, AlertTriangle, Calendar, TrendingUp, CreditCard } from 'lucide-react';
import type { DashboardStats } from '../../../server/src/schema';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await trpc.getDashboardStats.query();
      setStats(result);
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardStats();
    
    // Refresh stats every 5 minutes
    const interval = setInterval(loadDashboardStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadDashboardStats]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
              <div className="h-4 w-4 bg-gray-200 rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-32"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">🏥 Dashboard Rumah Khitan</h2>
        <p className="text-blue-100">
          Selamat datang di sistem manajemen klinik. Berikut adalah ringkasan operasional hari ini.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Pasien
            </CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {stats?.total_patients || 0}
            </div>
            <p className="text-xs text-gray-500">
              Jumlah pasien terdaftar
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Transaksi Hari Ini
            </CardTitle>
            <Calendar className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {stats?.total_transactions_today || 0}
            </div>
            <p className="text-xs text-gray-500">
              Transaksi yang dilakukan hari ini
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Pendapatan Hari Ini
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              Rp {(stats?.total_revenue_today || 0).toLocaleString('id-ID')}
            </div>
            <p className="text-xs text-gray-500">
              Total pendapatan hari ini
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Stok Menipis
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {stats?.low_stock_medicines || 0}
            </div>
            <p className="text-xs text-gray-500">
              Obat dengan stok di bawah minimum
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Obat Kadaluarsa
            </CardTitle>
            <Pill className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {stats?.expired_medicines || 0}
            </div>
            <p className="text-xs text-gray-500">
              Obat yang sudah kadaluarsa
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Transaksi Pending
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {stats?.pending_transactions || 0}
            </div>
            <p className="text-xs text-gray-500">
              Transaksi menunggu pembayaran
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {(stats?.low_stock_medicines || 0) > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Peringatan Stok Menipis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-700">
              Terdapat {stats?.low_stock_medicines} obat dengan stok di bawah minimum. 
              Segera lakukan pengisian ulang stok untuk menjaga ketersediaan obat.
            </p>
          </CardContent>
        </Card>
      )}

      {(stats?.expired_medicines || 0) > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <Pill className="h-5 w-5" />
              Peringatan Obat Kadaluarsa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700">
              Terdapat {stats?.expired_medicines} obat yang sudah kadaluarsa. 
              Segera periksa dan keluarkan dari inventory untuk menjaga keamanan pasien.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Aksi Cepat</CardTitle>
          <CardDescription>
            Akses cepat ke fitur yang sering digunakan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer">
              <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <span className="text-sm font-medium text-blue-800">Daftar Pasien Baru</span>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors cursor-pointer">
              <CreditCard className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <span className="text-sm font-medium text-green-800">Transaksi Baru</span>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer">
              <Pill className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <span className="text-sm font-medium text-purple-800">Cek Stok Obat</span>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors cursor-pointer">
              <TrendingUp className="h-8 w-8 text-orange-600 mx-auto mb-2" />
              <span className="text-sm font-medium text-orange-800">Lihat Laporan</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}