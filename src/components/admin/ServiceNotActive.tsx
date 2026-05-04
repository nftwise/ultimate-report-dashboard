'use client';

import { Mail, Phone } from 'lucide-react';

interface ServiceNotActiveProps {
  serviceName: string;
  description: string;
}

export default function ServiceNotActive({ serviceName, description }: ServiceNotActiveProps) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.95)',
      border: '1px solid rgba(44,36,25,0.08)',
      borderRadius: '20px',
      padding: '60px 40px',
      textAlign: 'center',
      boxShadow: '0 4px 20px rgba(44,36,25,0.06)',
      maxWidth: '520px',
      margin: '40px auto',
    }}>
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '16px',
        background: 'rgba(196,112,79,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 16px',
      }}>
        <Mail size={28} style={{ color: '#c4704f' }} />
      </div>

      <h3 style={{
        fontSize: '18px',
        fontWeight: 700,
        color: '#2c2419',
        marginBottom: '8px',
      }}>
        {serviceName} is not active
      </h3>

      <p style={{
        fontSize: '14px',
        color: '#9ca3af',
        maxWidth: '400px',
        margin: '0 auto 24px',
        lineHeight: '1.6',
      }}>
        {description}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        <a
          href="mailto:info@mychiropractice.com"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            borderRadius: '12px',
            background: 'rgba(196,112,79,0.1)',
            color: '#c4704f',
            border: '1px solid rgba(196,112,79,0.2)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          <Mail size={16} />
          info@mychiropractice.com
        </a>
        <a
          href="tel:9493851450"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 24px',
            borderRadius: '12px',
            background: 'rgba(44,36,25,0.04)',
            color: '#5c5850',
            border: '1px solid rgba(44,36,25,0.1)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          <Phone size={16} />
          949-385-1450
        </a>
      </div>
    </div>
  );
}
