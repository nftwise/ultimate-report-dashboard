'use client';

import { useState } from 'react';
import { AdminClientSwitcher } from '@/components/AdminClientSwitcher';
import ProfessionalDashboard from '@/components/ProfessionalDashboard';
import { LogOut } from 'lucide-react';

export default function AdminDashboardPage() {
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                View and manage all client dashboards
              </p>
            </div>
            <button
              onClick={() => window.location.href = '/login'}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>

          {/* Client Switcher */}
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
      <div className="max-w-7xl mx-auto px-6 py-6">
        {selectedClientId ? (
          <div>
            {/* Show the regular dashboard for selected client */}
            <ProfessionalDashboard user={{ id: selectedClientId }} />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📊</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Select a Client
            </h3>
            <p className="text-gray-600">
              Choose a client from the dropdown above to view their dashboard
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
