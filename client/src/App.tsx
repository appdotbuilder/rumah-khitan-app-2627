import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Dashboard from '@/components/Dashboard';
import PatientManagement from '@/components/PatientManagement';
import MedicineManagement from '@/components/MedicineManagement';
import CashierSystem from '@/components/CashierSystem';
import Reports from '@/components/Reports';
import Settings from '@/components/Settings';
import { 
  LayoutDashboard, 
  Users, 
  Pill, 
  CreditCard, 
  FileText, 
  Settings as SettingsIcon,
  Stethoscope
} from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Stethoscope className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Rumah Khitan Super Modern Pak Nopi
                </h1>
                <p className="text-sm text-gray-600">Sistem Manajemen Klinik</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              🟢 Online
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 lg:w-fit lg:grid-cols-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="patients" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Pasien</span>
            </TabsTrigger>
            <TabsTrigger value="medicines" className="flex items-center gap-2">
              <Pill className="h-4 w-4" />
              <span className="hidden sm:inline">Obat</span>
            </TabsTrigger>
            <TabsTrigger value="cashier" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Kasir</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Laporan</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Pengaturan</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="dashboard" className="space-y-4">
              <Dashboard />
            </TabsContent>

            <TabsContent value="patients" className="space-y-4">
              <PatientManagement />
            </TabsContent>

            <TabsContent value="medicines" className="space-y-4">
              <MedicineManagement />
            </TabsContent>

            <TabsContent value="cashier" className="space-y-4">
              <CashierSystem />
            </TabsContent>

            <TabsContent value="reports" className="space-y-4">
              <Reports />
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Settings />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

export default App;