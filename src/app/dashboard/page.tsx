'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Dashboard from '@/components/ProfessionalDashboard'

function DashboardContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const clientId = searchParams?.get('clientId')
  const [clientInfo, setClientInfo] = useState<any>(null)
  const [loading, setLoading] = useState(!!clientId)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role === 'admin' && !clientId) {
      // Admins without clientId go to Team Overview
      router.push('/admin')
    }
  }, [status, session, router, clientId])

  // Fetch client info if admin is viewing a specific client
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'admin' && clientId) {
      fetchClientInfo()
    }
  }, [status, session, clientId])

  const fetchClientInfo = async () => {
    try {
      const response = await fetch(`/api/clients/list`)
      const data = await response.json()

      if (data.success) {
        const client = data.clients.find((c: any) => c.slug === clientId)
        if (client) {
          setClientInfo(client)
        }
      }
    } catch (error) {
      console.error('Error fetching client info:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null // Will redirect
  }

  // Admin viewing a specific client
  if (session.user.role === 'admin' && clientId && clientInfo) {
    console.log('[Dashboard Page] Admin viewing client:', {
      clientId,
      clientInfoId: clientInfo.id,
      clientInfoName: clientInfo.name,
      clientInfoSlug: clientInfo.slug
    });

    return (
      <div>
        {/* Back Button */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Team Overview</span>
          </button>
        </div>

        <Dashboard
          user={{
            id: clientInfo.slug,
            email: clientInfo.contact_email || '',
            companyName: clientInfo.name,
            role: 'admin' // Pass admin role so they can see all tabs
          }}
        />
      </div>
    )
  }

  // Regular client user - show their dashboard
  if (session.user.role === 'client') {
    return <Dashboard user={{
      id: session.user.clientSlug || '',
      email: session.user.email || '',
      companyName: session.user.clientName || '',
      role: session.user.role
    }} />
  }

  return null
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
