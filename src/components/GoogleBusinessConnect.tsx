'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';

interface GoogleBusinessConnectProps {
  clientId: string;
  onSuccess?: () => void;
}

export default function GoogleBusinessConnect({ clientId, onSuccess }: GoogleBusinessConnectProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get auth URL from API
      const response = await fetch(`/api/auth/google-business?clientId=${clientId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get auth URL');
      }

      // Redirect to Google OAuth
      window.location.href = data.authUrl;

    } catch (err: any) {
      console.error('Error connecting Google Business:', err);
      setError(err.message || 'Failed to connect');
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
          <ExternalLink className="w-6 h-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Connect Google Business Profile
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Connect your Google Business Profile to fetch performance metrics like views, actions, and search queries.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4" />
                Connect Google Business
              </>
            )}
          </button>

          <p className="text-xs text-gray-500 mt-3">
            You'll be redirected to Google to authorize access. Make sure you're logged in with your business email (e.g., seo@mychiropractice.com).
          </p>
        </div>
      </div>
    </div>
  );
}
