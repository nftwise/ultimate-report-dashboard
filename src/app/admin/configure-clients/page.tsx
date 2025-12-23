'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Check, AlertCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Client {
  id: string;
  name: string;
  slug: string;
  ga_property_id?: string;
  gads_customer_id?: string;
  gsc_site_url?: string;
  gbp_location_id?: string;
}

export default function ConfigureClientsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/admin/get-all-configs');
      const data = await response.json();
      if (data.success) {
        setClients(data.clients);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch clients');
    } finally {
      setLoading(false);
    }
  };

  const updateClient = (clientId: string, field: string, value: string) => {
    setClients(prev =>
      prev.map(c =>
        c.id === clientId ? { ...c, [field]: value } : c
      )
    );
  };

  const saveClient = async (client: Client) => {
    setSaving(client.id);
    setError(null);
    setSaved(null);

    try {
      const response = await fetch('/api/admin/auto-configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configurations: [{
            clientId: client.id,
            gaPropertyId: client.ga_property_id || null,
            gadsCustomerId: client.gads_customer_id || null,
            gscSiteUrl: client.gsc_site_url || null,
            gbpLocationId: client.gbp_location_id || null
          }]
        })
      });

      const data = await response.json();
      if (data.success) {
        setSaved(client.id);
        setTimeout(() => setSaved(null), 3000);
      } else {
        setError(data.error || 'Failed to save');
      }
    } catch (err) {
      setError('Failed to save configuration');
    } finally {
      setSaving(null);
    }
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            onClick={() => router.push('/admin')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Button>
          <h1 className="text-2xl font-bold">Configure Client Services</h1>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-600">{error}</span>
          </div>
        )}

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">GA Property ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Google Ads ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">GSC URL</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">GBP Location</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredClients.map((client) => (
                  <tr key={client.id} className={!client.ga_property_id ? 'bg-yellow-50' : ''}>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-gray-900">{client.name}</div>
                        <div className="text-sm text-gray-500">{client.slug}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={client.ga_property_id || ''}
                        onChange={(e) => updateClient(client.id, 'ga_property_id', e.target.value)}
                        placeholder="e.g., 305884406"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={client.gads_customer_id || ''}
                        onChange={(e) => updateClient(client.id, 'gads_customer_id', e.target.value)}
                        placeholder="e.g., 1144073048"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={client.gsc_site_url || ''}
                        onChange={(e) => updateClient(client.id, 'gsc_site_url', e.target.value)}
                        placeholder="https://example.com"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={client.gbp_location_id || ''}
                        onChange={(e) => updateClient(client.id, 'gbp_location_id', e.target.value)}
                        placeholder="Location ID"
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        size="sm"
                        onClick={() => saveClient(client)}
                        disabled={saving === client.id}
                        className={saved === client.id ? 'bg-green-600 hover:bg-green-700' : ''}
                      >
                        {saving === client.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        ) : saved === client.id ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">How to find these IDs:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li><strong>GA Property ID:</strong> In Google Analytics, go to Admin &gt; Property Settings. The ID is the number after "properties/"</li>
            <li><strong>Google Ads ID:</strong> In Google Ads, click on the account name. The Customer ID is shown in the format XXX-XXX-XXXX (remove dashes)</li>
            <li><strong>GSC URL:</strong> The website URL exactly as it appears in Google Search Console</li>
            <li><strong>GBP Location:</strong> In Google Business Profile, the location ID from the URL</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
