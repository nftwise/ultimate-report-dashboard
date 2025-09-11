
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      companyName: string;
      googleAnalyticsPropertyId?: string;
      googleAdsCustomerId?: string;
      callrailAccountId?: string;
    }
  }

  interface User {
    id: string;
    email: string;
    name: string;
    companyName: string;
    googleAnalyticsPropertyId?: string;
    googleAdsCustomerId?: string;
    callrailAccountId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    companyName?: string;
    googleAnalyticsPropertyId?: string;
    googleAdsCustomerId?: string;
    callrailAccountId?: string;
  }
}