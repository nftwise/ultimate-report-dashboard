'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function TestAllBusinessesPage() {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch real clients from API
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

  const businesses = clients;

  const handleConnect = (businessId: string) => {
    // Redirect to OAuth with business ID
    window.location.href = `/api/auth/google-business?clientId=${businessId}`;
  };

  const checkBusiness = async (businessId: string, businessName: string) => {
    try {
      const response = await fetch(`/api/google-business/locations?clientId=${businessId}`);
      const data = await response.json();

      return {
        id: businessId,
        name: businessName,
        success: data.success,
        connected: data.success && !data.error,
        accounts: data.data?.accounts || [],
        locations: data.data?.locations || [],
        error: data.error,
      };
    } catch (error: any) {
      return {
        id: businessId,
        name: businessName,
        success: false,
        connected: false,
        accounts: [],
        locations: [],
        error: error.message,
      };
    }
  };

  const testAllBusinesses = async () => {
    setTesting(true);
    const results = [];

    for (const business of businesses) {
      const result = await checkBusiness(business.id, business.name);
      results.push(result);
    }

    setTestResults(results);
    setTesting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading clients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Test All Google Business Profiles
          </h1>
          <p className="text-gray-600 mb-4">
            Check which businesses have connected Google Business Profile and see their locations.
          </p>
          {businesses.length > 0 && (
            <button
              onClick={testAllBusinesses}
              disabled={testing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {testing ? 'Testing...' : 'Test All Businesses'}
            </button>
          )}
        </div>

        {/* Quick Connect Buttons */}
        {businesses.length > 0 ? (
          <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Connect</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {businesses.map((business) => (
                <button
                  key={business.id}
                  onClick={() => handleConnect(business.id)}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <span className="font-medium text-gray-900">{business.name}</span>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Click to connect with different Google accounts to see which one has access to locations.
            </p>
          </div>
        ) : (
          <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 text-center">No clients found.</p>
          </div>
        )}

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="space-y-4">
            {testResults.map((result) => (
              <div
                key={result.id}
                className={`bg-white rounded-xl shadow-sm border-2 p-6 ${
                  result.locations.length > 0
                    ? 'border-green-200'
                    : result.connected
                    ? 'border-yellow-200'
                    : 'border-red-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{result.name}</h3>
                    <p className="text-sm text-gray-500">ID: {result.id}</p>
                  </div>
                  <div>
                    {result.locations.length > 0 ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-4 h-4" />
                        {result.locations.length} Location(s)
                      </span>
                    ) : result.connected ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                        <AlertCircle className="w-4 h-4" />
                        No Locations
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                        <XCircle className="w-4 h-4" />
                        Not Connected
                      </span>
                    )}
                  </div>
                </div>

                {/* Accounts */}
                {result.accounts.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Accounts:</h4>
                    {result.accounts.map((account: any, idx: number) => (
                      <div key={idx} className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg mb-2">
                        <div><strong>Name:</strong> {account.accountName}</div>
                        <div className="text-xs text-gray-500">{account.name}</div>
                        <div><strong>Type:</strong> {account.type}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Locations */}
                {result.locations.length > 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-green-900 mb-3">✅ Locations Found:</h4>
                    {result.locations.map((location: any, idx: number) => (
                      <div key={idx} className="bg-white p-4 rounded-lg mb-3 last:mb-0">
                        <div className="font-semibold text-gray-900 mb-2">{location.title}</div>
                        <div className="text-sm space-y-1">
                          <div className="text-gray-600">📍 {location.address}</div>
                          <div className="text-gray-600">📞 {location.primaryPhone}</div>
                          <div className="text-gray-600">🌐 {location.websiteUri || 'N/A'}</div>
                          <div className="text-xs text-gray-500 mt-2 font-mono bg-gray-50 p-2 rounded">
                            {location.name}
                          </div>
                          <div className="text-xs font-medium text-green-700 mt-2">
                            Status: {location.locationState}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : result.connected ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      ⚠️ Connected but no locations found. This account may not have any business locations or the email doesn't have access.
                    </p>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">
                      ❌ Not connected. Click "Quick Connect" above to authorize this business.
                    </p>
                    {result.error && (
                      <p className="text-xs text-red-600 mt-2">Error: {result.error}</p>
                    )}
                  </div>
                )}

                {/* Connect Button */}
                <button
                  onClick={() => handleConnect(result.id)}
                  className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Reconnect / Change Account
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3">📝 How to Use:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li><strong>Click "Test All Businesses"</strong> to see which ones are already connected</li>
            <li><strong>For businesses without locations:</strong> Click "Quick Connect" button</li>
            <li><strong>Try different Google accounts:</strong> Sign out and sign in with different emails to find which one has access</li>
            <li><strong>Look for green boxes</strong> - those businesses have locations and can fetch data!</li>
          </ol>

          <div className="mt-4 pt-4 border-t border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">💡 Tips:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
              <li>Try signing in with the Primary Owner email first</li>
              <li>If one business doesn't have data, try another business in the list</li>
              <li>Some accounts might be personal accounts without business locations</li>
              <li>You need Owner or Manager access to see locations</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
