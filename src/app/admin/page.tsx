'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus, Mail, Building, Database, Smartphone, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';

export default function AdminPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    companyName: '',
    googleAnalyticsPropertyId: '',
    googleAdsCustomerId: '',
    callrailAccountId: '',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setMessage({
          type: 'success',
          text: `User created successfully! ID: ${result.data.id}`,
        });
        // Reset form
        setFormData({
          email: '',
          password: '',
          companyName: '',
          googleAnalyticsPropertyId: '',
          googleAdsCustomerId: '',
          callrailAccountId: '',
        });
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Failed to create user',
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Network error occurred. Please try again.',
      });
      console.error('Admin create user error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Admin Dashboard
          </h1>
          <p className="text-gray-600">
            Create and manage client accounts for the reporting dashboard
          </p>
        </div>

        {/* Create User Form */}
        <Card className="shadow-lg">
          <CardHeader className="pb-6">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-white" />
              </div>
              Create New Client Account
            </CardTitle>
            <p className="text-gray-600">
              Add a new client with their API credentials for dashboard access
            </p>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Message */}
              {message.text && (
                <div className={`flex items-center gap-2 p-4 rounded-lg border ${
                  message.type === 'success' 
                    ? 'bg-green-50 border-green-200 text-green-700' 
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  {message.type === 'success' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                  {message.text}
                </div>
              )}

              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="client@company.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Secure password"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="companyName" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Company Name
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  value={formData.companyName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Company Inc."
                  required
                />
              </div>

              {/* API Configuration */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  API Configuration (Optional)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="googleAnalyticsPropertyId" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      GA4 Property ID
                    </label>
                    <input
                      id="googleAnalyticsPropertyId"
                      name="googleAnalyticsPropertyId"
                      type="text"
                      value={formData.googleAnalyticsPropertyId}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="123456789"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="googleAdsCustomerId" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Google Ads Customer ID
                    </label>
                    <input
                      id="googleAdsCustomerId"
                      name="googleAdsCustomerId"
                      type="text"
                      value={formData.googleAdsCustomerId}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="123-456-7890"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="callrailAccountId" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Smartphone className="w-4 h-4" />
                      CallRail Account ID
                    </label>
                    <input
                      id="callrailAccountId"
                      name="callrailAccountId"
                      type="text"
                      value={formData.callrailAccountId}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="ACC123..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Creating User...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4" />
                      Create Client Account
                    </div>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            Setup Instructions
          </h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>• <strong>Email & Password:</strong> Client login credentials</p>
            <p>• <strong>Company Name:</strong> Displayed in the dashboard header</p>
            <p>• <strong>GA4 Property ID:</strong> Google Analytics 4 property ID (found in GA4 Admin)</p>
            <p>• <strong>Google Ads Customer ID:</strong> 10-digit customer ID from Google Ads</p>
            <p>• <strong>CallRail Account ID:</strong> Account ID from CallRail dashboard</p>
          </div>
        </div>
      </div>
    </div>
  );
}