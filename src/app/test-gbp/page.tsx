'use client';

import { Suspense, useEffect, useState } from 'react';
import GoogleBusinessConnect from '@/components/GoogleBusinessConnect';
import { useSearchParams } from 'next/navigation';

function TestGBPContent() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check for success/error messages
    const gbpConnected = searchParams.get('gbp_connected');
    const error = searchParams.get('error');

    if (gbpConnected === 'true') {
      setMessage('Google Business Profile connected successfully!');
    } else if (error) {
      setMessage(`Error: ${error}`);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Test Google Business Profile Connection
        </h1>
        <p className="text-gray-600 mb-8">
          Use this page to test the OAuth2 flow for connecting Google Business Profile.
        </p>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.includes('success')
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {message}
          </div>
        )}

        <GoogleBusinessConnect
          clientId="coreposture"
          onSuccess={() => {
            console.log('Connection successful!');
          }}
        />

        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Steps:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Click Connect Google Business button above</li>
            <li>You will be redirected to Google sign-in</li>
            <li>Sign in with your business email (e.g., seo@mychiropractice.com)</li>
            <li>Grant permissions to access Google Business Profile</li>
            <li>You will be redirected back here with success message</li>
          </ol>
        </div>

        <div className="mt-6 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-900 mb-2">Important:</h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-yellow-800">
            <li>Make sure the email you use has Owner or Manager access to the Google Business Profile</li>
            <li>The email should be added to the business location beforehand</li>
            <li>After connection, the dashboard will be able to fetch GBP metrics automatically</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function TestGBPPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <TestGBPContent />
    </Suspense>
  );
}
