'use client';

import { useState, useEffect } from 'react';
import { Building2, ChevronDown } from 'lucide-react';

interface Client {
  id: string;
  companyName: string;
  owner?: string;
  city?: string;
  googleAnalyticsPropertyId?: string;
  googleAdsCustomerId?: string;
}

interface AdminClientSwitcherProps {
  currentClientId?: string;
  onClientChange: (clientId: string) => void;
}

export function AdminClientSwitcher({ currentClientId, onClientChange }: AdminClientSwitcherProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  // Load all clients
  useEffect(() => {
    loadClients();
  }, []);

  // Update selected client when currentClientId changes
  useEffect(() => {
    if (currentClientId && clients.length > 0) {
      const client = clients.find(c => c.id === currentClientId);
      if (client) {
        setSelectedClient(client);
      }
    }
  }, [currentClientId, clients]);

  async function loadClients() {
    try {
      // Read from the clients.json file
      const response = await fetch('/api/clients/list');
      const data = await response.json();

      if (data.success && data.clients) {
        setClients(data.clients);

        // Set first client as default if none selected
        if (!currentClientId && data.clients.length > 0) {
          const firstClient = data.clients[0];
          setSelectedClient(firstClient);
          onClientChange(firstClient.id);
        }
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  }

  function selectClient(client: Client) {
    setSelectedClient(client);
    setIsOpen(false);
    onClientChange(client.id);
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm px-4 py-3">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Client Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white rounded-lg shadow-sm px-4 py-3 hover:shadow-md transition-shadow"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-left">
              <div className="text-sm text-gray-500 font-medium">Viewing Dashboard For:</div>
              <div className="font-semibold text-gray-900">
                {selectedClient?.companyName || 'Select Client'}
              </div>
              {selectedClient?.owner && (
                <div className="text-xs text-gray-500">
                  {selectedClient.owner} • {selectedClient.city}
                </div>
              )}
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-gray-400 transition-transform ${
              isOpen ? 'transform rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          ></div>

          {/* Dropdown */}
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-20 max-h-96 overflow-y-auto">
            <div className="p-2">
              <div className="text-xs font-semibold text-gray-500 uppercase px-3 py-2">
                Select Client ({clients.length} total)
              </div>

              {clients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => selectClient(client)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedClient?.id === client.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-50 text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      selectedClient?.id === client.id
                        ? 'bg-blue-100'
                        : 'bg-gray-100'
                    }`}>
                      <Building2 className={`w-4 h-4 ${
                        selectedClient?.id === client.id
                          ? 'text-blue-600'
                          : 'text-gray-600'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{client.companyName}</div>
                      {client.owner && (
                        <div className="text-xs text-gray-500 truncate">
                          {client.owner} • {client.city}
                        </div>
                      )}
                    </div>
                    {selectedClient?.id === client.id && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
