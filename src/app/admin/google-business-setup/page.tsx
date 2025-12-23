'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, CheckCircle, XCircle, FileText } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  slug: string;
}

interface Location {
  name: string;
  title: string;
  address: string;
  primaryPhone: string;
  locationState: string;
}

interface ConnectionStatus {
  connected: boolean;
  locations: Location[];
  accounts: any[];
  error?: string;
}

export default function GoogleBusinessSetupPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<Record<string, ConnectionStatus>>({});
  const [checkingClient, setCheckingClient] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

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

  const checkConnection = async (clientId: string) => {
    setCheckingClient(clientId);
    try {
      const response = await fetch(`/api/google-business/locations?clientId=${clientId}`);
      const data = await response.json();

      setConnectionStatus(prev => ({
        ...prev,
        [clientId]: {
          connected: data.success,
          locations: data.data?.locations || [],
          accounts: data.data?.accounts || [],
          error: data.error,
        }
      }));
    } catch (error: any) {
      setConnectionStatus(prev => ({
        ...prev,
        [clientId]: {
          connected: false,
          locations: [],
          accounts: [],
          error: error.message,
        }
      }));
    } finally {
      setCheckingClient(null);
    }
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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Google Business Profile Setup
          </h1>
          <p className="text-gray-600">
            Connect Google Business Profile for each client to fetch performance metrics.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Locations
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clients.map((client) => {
                const status = connectionStatus[client.id];

                return (
                  <tr key={client.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{client.name}</div>
                      <div className="text-sm text-gray-500">{client.slug}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {status ? (
                        status.connected ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3" />
                            Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <XCircle className="w-3 h-3" />
                            Not Connected
                          </span>
                        )
                      ) : (
                        <span className="text-sm text-gray-400">Unknown</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {status?.locations && status.locations.length > 0 ? (
                        <div className="space-y-2">
                          {status.locations.map((loc, idx) => (
                            <div key={idx} className="text-sm">
                              <div className="font-medium text-gray-900">{loc.title}</div>
                              <div className="text-gray-500 text-xs">{loc.address}</div>
                              <div className="text-gray-400 text-xs">ID: {loc.name}</div>
                            </div>
                          ))}
                        </div>
                      ) : status?.connected ? (
                        <span className="text-sm text-yellow-600">No locations found</span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleConnect(client.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Connect
                        </button>
                        <button
                          onClick={() => checkConnection(client.id)}
                          disabled={checkingClient === client.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`w-4 h-4 ${checkingClient === client.id ? 'animate-spin' : ''}`} />
                          Check
                        </button>
                      </div>
                      {status?.error && (
                        <div className="mt-2 text-xs text-red-600">{status.error}</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2"><FileText className="w-4 h-4" /> Instructions:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Click "Connect" for a client</li>
            <li>Sign in with the Google account that has Owner/Manager access to the business</li>
            <li>Grant permissions</li>
            <li>After redirect, click "Check" to verify connection and see available locations</li>
            <li>If you see locations, the setup is complete!</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
