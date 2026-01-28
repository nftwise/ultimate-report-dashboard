'use client';

import { useState } from 'react';
import { AdminClientSwitcher } from '@/components/AdminClientSwitcher';
import ProfessionalDashboard from '@/components/ProfessionalDashboard';
import { LogOut, BarChart3, Users, TrendingUp } from 'lucide-react';

export default function AdminDashboardPage() {
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)' }}>
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-cyan-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">HealthFlow</h1>
                <p className="text-xs text-slate-500 font-medium">Multi-Client Dashboard</p>
              </div>
            </div>
            <button
              onClick={() => window.location.href = '/login'}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-red-600 hover:bg-red-50/50 rounded-lg transition duration-200"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Client Selection Card */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-900">Select Client</h2>
            </div>
            <div className="max-w-md">
              <AdminClientSwitcher
                currentClientId={selectedClientId}
                onClientChange={(clientId) => {
                  console.log('Selected client:', clientId);
                  setSelectedClientId(clientId);
                }}
              />
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        {selectedClientId ? (
          <div className="animate-fadeIn">
            <ProfessionalDashboard user={{ id: selectedClientId }} />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <TrendingUp className="w-10 h-10 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              Select a Client to Begin
            </h3>
            <p className="text-slate-600 max-w-sm mx-auto">
              Choose a client from the dropdown above to view their comprehensive marketing analytics and performance metrics.
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
}
