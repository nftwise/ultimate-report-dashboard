'use client';

import React, { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { fmtCurrency } from '@/lib/format';

interface ConvertingSearchTerm {
  term: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  ctr: number;
  conversionRate: number;
}

interface TopConvertingSearchTermsProps {
  data: ConvertingSearchTerm[];
  limit?: number;
}

type SortKey = 'conversions' | 'impressions' | 'clicks' | 'ctr' | 'conversionRate' | 'cost';

const ITEMS_PER_PAGE = 10;

export default function TopConvertingSearchTerms({
  data,
  limit = 200
}: TopConvertingSearchTermsProps) {
  const [sortBy, setSortBy] = useState<SortKey>('conversions');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
    setPage(1);
  };

  const sortIcon = (key: SortKey) => {
    if (sortBy !== key) return <span style={{ opacity: 0.3, fontSize: '9px' }}>▼</span>;
    return <span style={{ fontSize: '9px', color: '#c4704f' }}>{sortDir === 'desc' ? '▼' : '▲'}</span>;
  };

  const thStyle = (key: SortKey): React.CSSProperties => ({
    padding: '12px',
    textAlign: 'center',
    fontWeight: '700',
    color: sortBy === key ? '#c4704f' : '#5c5850',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    userSelect: 'none',
  });

  const allTerms = useMemo(() => {
    return (data || []).filter(term => term.conversions > 0);
  }, [data]);

  const sortedTerms = useMemo(() => {
    return [...allTerms].sort((a, b) => {
      const valA = a[sortBy] as number;
      const valB = b[sortBy] as number;
      return sortDir === 'desc' ? valB - valA : valA - valB;
    }).slice(0, limit);
  }, [allTerms, sortBy, sortDir, limit]);

  const totalPages = Math.ceil(sortedTerms.length / ITEMS_PER_PAGE);
  const paginated = sortedTerms.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const totalConversions = allTerms.reduce((sum, t) => sum + t.conversions, 0);
  const totalCost = allTerms.reduce((sum, t) => sum + t.cost, 0);

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(44, 36, 25, 0.1)',
      borderRadius: '24px',
      padding: '24px',
      boxShadow: '0 4px 20px rgba(44, 36, 25, 0.08)'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <p style={{
          fontSize: '11px',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: '#5c5850',
          margin: '0 0 8px 0'
        }}>
          Top Converting Search Terms
        </p>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#2c2419',
          margin: '0 0 16px 0',
          letterSpacing: '-0.02em'
        }}>
          What Customers Are Searching For
        </h3>

        {/* Summary Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginTop: '12px'
        }}>
          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            borderRadius: '8px',
            padding: '12px',
            borderLeft: '3px solid #10b981'
          }}>
            <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>
              Unique Terms
            </p>
            <p style={{ fontSize: '18px', fontWeight: '700', color: '#10b981', margin: 0 }}>
              {allTerms.length}
            </p>
          </div>

          <div style={{
            background: 'rgba(217, 168, 84, 0.08)',
            borderRadius: '8px',
            padding: '12px',
            borderLeft: '3px solid #d9a854'
          }}>
            <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>
              Total Conversions
            </p>
            <p style={{ fontSize: '18px', fontWeight: '700', color: '#d9a854', margin: 0 }}>
              {totalConversions}
            </p>
          </div>

          <div style={{
            background: 'rgba(157, 181, 160, 0.08)',
            borderRadius: '8px',
            padding: '12px',
            borderLeft: '3px solid #9db5a0'
          }}>
            <p style={{ fontSize: '10px', color: '#5c5850', margin: '0 0 4px 0', fontWeight: '600' }}>
              Total Cost
            </p>
            <p style={{ fontSize: '18px', fontWeight: '700', color: '#9db5a0', margin: 0 }}>
              {fmtCurrency(totalCost)}
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      {sortedTerms.length > 0 ? (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(44, 36, 25, 0.15)', background: 'rgba(44, 36, 25, 0.03)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: '#5c5850', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
                    #
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', color: '#5c5850', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Search Term
                  </th>
                  <th style={thStyle('impressions')} onClick={() => handleSort('impressions')}>
                    Impressions {sortIcon('impressions')}
                  </th>
                  <th style={thStyle('clicks')} onClick={() => handleSort('clicks')}>
                    Clicks {sortIcon('clicks')}
                  </th>
                  <th style={thStyle('ctr')} onClick={() => handleSort('ctr')}>
                    CTR {sortIcon('ctr')}
                  </th>
                  <th style={thStyle('conversions')} onClick={() => handleSort('conversions')}>
                    Conv. {sortIcon('conversions')}
                  </th>
                  <th style={thStyle('conversionRate')} onClick={() => handleSort('conversionRate')}>
                    Lead Rate {sortIcon('conversionRate')}
                  </th>
                  <th style={thStyle('cost')} onClick={() => handleSort('cost')}>
                    Cost {sortIcon('cost')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((term, index) => {
                  const globalIndex = (page - 1) * ITEMS_PER_PAGE + index;
                  return (
                    <tr
                      key={term.term}
                      style={{ borderBottom: '1px solid rgba(44, 36, 25, 0.08)', transition: 'background-color 150ms ease' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(245, 241, 237, 0.5)'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <td style={{ padding: '12px', fontWeight: '700', color: '#2c2419', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: globalIndex < 3 ? '#c4704f' : 'rgba(44,36,25,0.08)',
                          color: globalIndex < 3 ? '#fff' : '#5c5850',
                          fontSize: '11px', fontWeight: '700'
                        }}>
                          {globalIndex + 1}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontWeight: '600', color: '#2c2419', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {term.term}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', color: '#5c5850', whiteSpace: 'nowrap' }}>
                        {term.impressions.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#9db5a0', whiteSpace: 'nowrap' }}>
                        {term.clicks.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#d9a854', whiteSpace: 'nowrap' }}>
                        {term.ctr.toFixed(2)}%
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: '700', color: '#10b981', whiteSpace: 'nowrap' }}>
                        {term.conversions}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#c4704f', whiteSpace: 'nowrap' }}>
                        {term.conversionRate.toFixed(2)}%
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#2c2419', whiteSpace: 'nowrap' }}>
                        {fmtCurrency(term.cost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(44,36,25,0.08)' }}>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>
              Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, sortedTerms.length)} of {sortedTerms.length}
            </span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                    border: '1px solid rgba(44,36,25,0.15)',
                    background: page === 1 ? 'rgba(44,36,25,0.03)' : '#fff',
                    color: page === 1 ? '#d1d5db' : '#2c2419',
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  ← Prev
                </button>
                <span style={{ padding: '5px 10px', fontSize: '12px', color: '#5c5850' }}>
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                    border: '1px solid rgba(44,36,25,0.15)',
                    background: page === totalPages ? 'rgba(44,36,25,0.03)' : '#fff',
                    color: page === totalPages ? '#d1d5db' : '#2c2419',
                    cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
          <TrendingUp size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
          <p>No search terms with conversions found for this period</p>
        </div>
      )}
    </div>
  );
}
