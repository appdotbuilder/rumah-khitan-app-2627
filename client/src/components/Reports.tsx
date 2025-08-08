import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/utils/trpc';
import { 
  FileText, 
  Download, 
  Calendar, 
  TrendingUp, 
  DollarSign,
  Users,
  Package,
  BarChart3,
  FileSpreadsheet,
  Printer
} from 'lucide-react';
import type { ReportInput } from '../../../server/src/schema';

export default function Reports() {
  const [isLoading, setIsLoading] = useState(false);
  const [dailyRevenue, setDailyRevenue] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [topServices, setTopServices] = useState<any[]>([]);
  
  const [reportData, setReportData] = useState<ReportInput>({
    type: 'sales',
    start_date: new Date(new Date().setDate(new Date().getDate() - 30)),
    end_date: new Date(),
    format: 'pdf'
  });

  const loadAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Get last 30 days of daily revenue
      const dailyRevenuePromises = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dailyRevenuePromises.push(trpc.getDailyRevenue.query(date));
      }
      
      const dailyRevenueResults = await Promise.all(dailyRevenuePromises);
      setDailyRevenue(dailyRevenueResults.map((revenue, index) => ({
        date: new Date(new Date().setDate(new Date().getDate() - (29 - index))),
        revenue: revenue || 0
      })));
      
      // Get current month's revenue
      const currentDate = new Date();
      const monthlyRevenueResult = await trpc.getMonthlyRevenue.query({
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1
      });
      setMonthlyRevenue([{
        month: currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
        revenue: monthlyRevenueResult
      }]);
      
      // Get top services
      const topServicesResult = await trpc.getTopServices.query(10);
      setTopServices(topServicesResult);
      
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const generateReport = async () => {
    setIsLoading(true);
    try {
      let reportResult;
      
      switch (reportData.type) {
        case 'sales':
          reportResult = await trpc.generateSalesReport.mutate(reportData);
          break;
        case 'inventory':
          reportResult = await trpc.generateInventoryReport.mutate(reportData);
          break;
        case 'patients':
          reportResult = await trpc.generatePatientReport.mutate(reportData);
          break;
        default:
          throw new Error('Invalid report type');
      }
      
      // In a real application, this would download or display the generated report
      console.log('Report generated:', reportResult);
      alert(`Laporan ${reportData.type} berhasil dibuat! (Fitur download sedang dalam pengembangan)`);
      
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Gagal membuat laporan. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const totalDailyRevenue = dailyRevenue.reduce((sum, day) => sum + day.revenue, 0);
  const averageDailyRevenue = dailyRevenue.length > 0 ? totalDailyRevenue / dailyRevenue.length : 0;
  const maxDailyRevenue = Math.max(...dailyRevenue.map(day => day.revenue));
  const minDailyRevenue = Math.min(...dailyRevenue.map(day => day.revenue));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <FileText className="h-6 w-6" />
          📊 Laporan & Analitik
        </h2>
        <p className="text-purple-100">
          Analisis performa klinik dan generate laporan untuk keperluan bisnis
        </p>
      </div>

      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="analytics">Analitik</TabsTrigger>
          <TabsTrigger value="reports">Generate Laporan</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-6">
          {/* Revenue Analytics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total Pendapatan (30 hari)
                </CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  Rp {totalDailyRevenue.toLocaleString('id-ID')}
                </div>
                <p className="text-xs text-gray-500">
                  30 hari terakhir
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Rata-rata Harian
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  Rp {averageDailyRevenue.toLocaleString('id-ID')}
                </div>
                <p className="text-xs text-gray-500">
                  Per hari (30 hari)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Hari Tertinggi
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  Rp {maxDailyRevenue.toLocaleString('id-ID')}
                </div>
                <p className="text-xs text-gray-500">
                  Penjualan tertinggi
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Hari Terendah
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  Rp {minDailyRevenue.toLocaleString('id-ID')}
                </div>
                <p className="text-xs text-gray-500">
                  Penjualan terendah
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Grafik Pendapatan Harian (30 Hari Terakhir)
              </CardTitle>
              <CardDescription>
                Trend pendapatan harian dalam 30 hari terakhir
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <p className="text-gray-500">Memuat data...</p>
                </div>
              ) : (
                <div className="h-64 flex items-end space-x-1 overflow-x-auto">
                  {dailyRevenue.map((day, index) => (
                    <div key={index} className="flex-1 min-w-[20px] flex flex-col items-center">
                      <div
                        className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600 min-h-[4px]"
                        style={{
                          height: `${Math.max(4, (day.revenue / maxDailyRevenue) * 200)}px`
                        }}
                        title={`${day.date.toLocaleDateString('id-ID')}: Rp ${day.revenue.toLocaleString('id-ID')}`}
                      />
                      <div className="text-xs text-gray-500 mt-1 transform rotate-45 origin-left">
                        {day.date.getDate()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Services */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Layanan Terpopuler
              </CardTitle>
              <CardDescription>
                10 layanan dengan penjualan tertinggi
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse flex justify-between">
                      <div className="h-4 bg-gray-200 rounded w-32"></div>
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                    </div>
                  ))}
                </div>
              ) : topServices.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Belum ada data layanan</p>
              ) : (
                <div className="space-y-3">
                  {topServices.map((service: any, index: number) => (
                    <div key={service.service_id} className="flex justify-between items-center p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="min-w-[2rem] text-center">
                          #{index + 1}
                        </Badge>
                        <div>
                          <h3 className="font-medium">{service.name}</h3>
                          <p className="text-sm text-gray-600">
                            {service.total_quantity} kali digunakan
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          Rp {service.total_revenue.toLocaleString('id-ID')}
                        </div>
                        <div className="text-xs text-gray-500">
                          Total pendapatan
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          {/* Report Generator */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Generator Laporan
              </CardTitle>
              <CardDescription>
                Buat laporan untuk periode tertentu dalam format PDF atau Excel
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Jenis Laporan</Label>
                    <Select
                      value={reportData.type}
                      onValueChange={(value: 'sales' | 'inventory' | 'patients') =>
                        setReportData(prev => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sales">📊 Laporan Penjualan</SelectItem>
                        <SelectItem value="inventory">📦 Laporan Inventori</SelectItem>
                        <SelectItem value="patients">👥 Laporan Pasien</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Format</Label>
                    <Select
                      value={reportData.format}
                      onValueChange={(value: 'pdf' | 'excel') =>
                        setReportData(prev => ({ ...prev, format: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">📄 PDF</SelectItem>
                        <SelectItem value="excel">📊 Excel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tanggal Mulai</Label>
                    <Input
                      type="date"
                      value={reportData.start_date instanceof Date ?
                        reportData.start_date.toISOString().split('T')[0] :
                        reportData.start_date
                      }
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setReportData(prev => ({
                          ...prev,
                          start_date: new Date(e.target.value)
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tanggal Selesai</Label>
                    <Input
                      type="date"
                      value={reportData.end_date instanceof Date ?
                        reportData.end_date.toISOString().split('T')[0] :
                        reportData.end_date
                      }
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setReportData(prev => ({
                          ...prev,
                          end_date: new Date(e.target.value)
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Report Preview Info */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-medium text-blue-800 mb-2">Preview Laporan:</h3>
                <div className="space-y-1 text-sm text-blue-700">
                  <p>
                    • Jenis: {
                      reportData.type === 'sales' ? 'Laporan Penjualan' :
                      reportData.type === 'inventory' ? 'Laporan Inventori' : 'Laporan Pasien'
                    }
                  </p>
                  <p>
                    • Periode: {reportData.start_date instanceof Date ?
                      reportData.start_date.toLocaleDateString('id-ID') :
                      reportData.start_date
                    } - {reportData.end_date instanceof Date ?
                      reportData.end_date.toLocaleDateString('id-ID') :
                      reportData.end_date
                    }
                  </p>
                  <p>• Format: {reportData.format === 'pdf' ? 'PDF' : 'Excel'}</p>
                </div>
              </div>

              <Button
                onClick={generateReport}
                disabled={isLoading}
                className="w-full bg-purple-600 hover:bg-purple-700 flex items-center gap-2"
              >
                {isLoading ? (
                  'Membuat Laporan...'
                ) : (
                  <>
                    {reportData.format === 'pdf' ? (
                      <Printer className="h-4 w-4" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" />
                    )}
                    Generate Laporan
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Quick Reports */}
          <Card>
            <CardHeader>
              <CardTitle>Laporan Cepat</CardTitle>
              <CardDescription>
                Generate laporan yang sering digunakan dengan sekali klik
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  variant="outline"
                  className="h-20 flex flex-col gap-2"
                  onClick={() => {
                    const today = new Date();
                    const yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);
                    
                    setReportData({
                      type: 'sales',
                      start_date: yesterday,
                      end_date: today,
                      format: 'pdf'
                    });
                    generateReport();
                  }}
                  disabled={isLoading}
                >
                  <Calendar className="h-5 w-5" />
                  <span className="text-sm">Penjualan Kemarin</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-20 flex flex-col gap-2"
                  onClick={() => {
                    const today = new Date();
                    const weekAgo = new Date(today);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    
                    setReportData({
                      type: 'sales',
                      start_date: weekAgo,
                      end_date: today,
                      format: 'pdf'
                    });
                    generateReport();
                  }}
                  disabled={isLoading}
                >
                  <BarChart3 className="h-5 w-5" />
                  <span className="text-sm">Penjualan Minggu Ini</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-20 flex flex-col gap-2"
                  onClick={() => {
                    const today = new Date();
                    const monthAgo = new Date(today);
                    monthAgo.setMonth(monthAgo.getMonth() - 1);
                    
                    setReportData({
                      type: 'inventory',
                      start_date: monthAgo,
                      end_date: today,
                      format: 'excel'
                    });
                    generateReport();
                  }}
                  disabled={isLoading}
                >
                  <Package className="h-5 w-5" />
                  <span className="text-sm">Inventori Bulanan</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}