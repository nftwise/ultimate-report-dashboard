'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, FileText, Wifi, AlertCircle } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  slug: string;
}

interface MasterTokenStatus {
  connected: boolean;
  email?: string;
  hasRefreshToken?: boolean;
  updatedAt?: string;
  clientStatus?: Record<string, string>; // client_id -> latest date
}

export default function GoogleBusinessSetupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><p>Loading...</p></div>}>
      <GoogleBusinessSetupContent />
    </Suspense>
  );
}

function GoogleBusinessSetupContent() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [masterStatus, setMasterStatus] = useState<MasterTokenStatus | null>(null);
  const searchParams = useSearchParams();
  const justConnected = searchParams?.get('gbp_connected') === 'true';
  const errorMsg = searchParams?.get('error');

  useEffect(() => {
    fetchClients();
    fetchMasterStatus();
  }, []);

  const fetchMasterStatus = async () => {
    try {
      const res = await fetch('/api/admin/gbp-status');
      const data = await res.json();
      setMasterStatus(data);
    } catch {
      setMasterStatus({ connected: false });
    }
  };

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients/list');
      const data = await response.json();
      if (data.success) {
        setClients(data.clients);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (clientId: string) => {
    try {
      const response = await fetch(`/api/auth/google-business?clientId=${clientId}`);
      const data = await response.json();
      if (data.success) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Error connecting:', error);
    }
  };

  const getClientGbpStatus = (clientId: string): 'active' | 'no_data' => {
    if (!masterStatus?.clientStatus) return 'no_data';
    return masterStatus.clientStatus[clientId] ? 'active' : 'no_data';
  };

  const getLatestDate = (clientId: string): string | null => {
    return masterStatus?.clientStatus?.[clientId] || null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading clients...</p>
        </div>
      </div>
    );
  }

  const activeCount = clients.filter(c => getClientGbpStatus(c.id) === 'active').length;
  const noDataCount = clients.filter(c => getClientGbpStatus(c.id) === 'no_data').length;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Google Business Profile Setup
          </h1>
          <p className="text-gray-600">
            Manage GBP connections for all clients.
          </p>
        </div>

        {/* Master Token Status Banner */}
        {masterStatus && (
          <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 ${
            masterStatus.connected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <Wifi className={`w-5 h-5 ${masterStatus.connected ? 'text-green-600' : 'text-red-600'}`} />
            <div className="flex-1">
              <div className={`font-semibold text-sm ${masterStatus.connected ? 'text-green-800' : 'text-red-800'}`}>
                {masterStatus.connected ? 'GBP Agency Token: Active' : 'GBP Agency Token: Not Connected'}
              </div>
              {masterStatus.connected && (
                <div className="text-xs text-green-600 mt-0.5">
                  {masterStatus.email} &middot; Last updated: {masterStatus.updatedAt ? new Date(masterStatus.updatedAt).toLocaleString() : 'N/A'}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {masterStatus.connected && masterStatus.hasRefreshToken && (
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                  Auto-refresh enabled
                </span>
              )}
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                {activeCount} active &middot; {noDataCount} no data
              </span>
            </div>
          </div>
        )}

        {/* Success/Error Notifications */}
        {justConnected && (
          <div className="mb-6 p-4 rounded-xl border bg-green-50 border-green-200 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-800">
              Successfully connected! Token saved and cron will auto-refresh.
            </span>
          </div>
        )}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl border bg-red-50 border-red-200 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-red-800">
              OAuth error: {errorMsg} {searchParams?.get('msg') && `— ${searchParams.get('msg')}`}
            </span>
          </div>
        )}

        {/* Client Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GBP Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Latest Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clients.map((client) => {
                const gbpStatus = getClientGbpStatus(client.id);
                const latestDate = getLatestDate(client.id);

                return (
                  <tr key={client.id} className={gbpStatus === 'no_data' ? 'bg-red-50/30' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{client.name}</div>
                      <div className="text-sm text-gray-500">{client.slug}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {gbpStatus === 'active' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <AlertCircle className="w-3 h-3" />
                          No GBP Data
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {latestDate ? (
                        <span className="text-sm text-gray-700">{latestDate}</span>
                      ) : (
                        <span className="text-sm text-red-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {gbpStatus === 'active' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Connected
                        </span>
                      ) : (
                        <button
                          onClick={() => handleConnect(client.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium"
                        >
                          Connect
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2"><FileText className="w-4 h-4" /> How it works:</h3>
          <ul className="space-y-1 text-sm text-blue-800">
            <li>&bull; GBP uses a single <strong>agency master token</strong> to fetch data for all clients</li>
            <li>&bull; Cron automatically syncs data daily and refreshes the token</li>
            <li>&bull; Clients showing <strong>&quot;No GBP Data&quot;</strong> may not have a Google Business Profile linked</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
