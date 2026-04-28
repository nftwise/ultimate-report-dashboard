'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mail, Loader, Send, X, Plus, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface EmailReportButtonProps {
  dashboardData: any;
  period: string;
  className?: string;
}

export function EmailReportButton({ dashboardData, period, className = '' }: EmailReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [emails, setEmails] = useState<string[]>(['']);
  const [isLoading, setIsLoading] = useState(false);
  const [attachPDF, setAttachPDF] = useState(true);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    checkEmailConfig();
  }, []);

  const checkEmailConfig = async () => {
    try {
      const response = await fetch('/api/email-report');
      const result = await response.json();
      if (result.success) {
        setEmailConfigured(result.data.emailConfigured);
      }
    } catch (error) {
      console.error('Failed to check email config:', error);
    }
  };

  const addEmailField = () => {
    setEmails([...emails, '']);
  };

  const removeEmailField = (index: number) => {
    if (emails.length > 1) {
      setEmails(emails.filter((_, i) => i !== index));
    }
  };

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSendReport = async () => {
    // Validate emails
    const validEmails = emails.filter(email => email.trim() && isValidEmail(email.trim()));
    
    if (validEmails.length === 0) {
      setMessage({ type: 'error', text: 'Please enter at least one valid email address' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/email-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emails: validEmails,
          period,
          attachPDF,
          dashboardData,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        // Reset form after successful send
        setTimeout(() => {
          setIsOpen(false);
          setEmails(['']);
          setMessage(null);
        }, 2000);
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to send email report' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred. Please try again.' });
      console.error('Email report error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!emailConfigured) {
    return null; // Don't show button if email is not configured
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className={`flex items-center gap-2 ${className}`}
      >
        <Mail className="w-4 h-4" />
        Email Report
      </Button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg font-semibold">Send Email Report</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {message && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                  message.type === 'success' 
                    ? 'bg-green-50 border border-green-200 text-green-700' 
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {message.type === 'success' ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  {message.text}
                </div>
              )}

              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">
                  Email Recipients
                </label>
                
                {emails.map((email, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => updateEmail(index, e.target.value)}
                      placeholder="recipient@company.com"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    {emails.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEmailField(index)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addEmailField}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                >
                  <Plus className="w-3 w-3" />
                  Add another email
                </Button>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  id="attachPDF"
                  type="checkbox"
                  checked={attachPDF}
                  onChange={(e) => setAttachPDF(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <label 
                  htmlFor="attachPDF" 
                  className="text-sm text-gray-700 cursor-pointer"
                >
                  Attach PDF report
                </label>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Report includes:</p>
                  <ul className="text-xs space-y-1">
                    <li>• Key performance metrics</li>
                    <li>• Period: {getPeriodText(period)}</li>
                    <li>• {attachPDF ? 'PDF attachment included' : 'HTML email only'}</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendReport}
                  disabled={isLoading || emails.every(email => !email.trim())}
                  className="flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Report
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function getPeriodText(period: string): string {
  switch (period) {
    case 'today':
      return 'Today';
    case '7days':
      return 'Last 7 Days';
    case '30days':
      return 'Last 30 Days';
    case '90days':
      return 'Last 90 Days';
    default:
      return period;
  }
}