'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import AdminLayout from '@/components/admin/AdminLayout';
import ClientTabBar from '@/components/admin/ClientTabBar';
import { fmtNum } from '@/lib/format';
import { ExternalLink, Newspaper, RefreshCw, TrendingUp } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface BingRanking {
  query: string;
  position: number | null;
  page_title: string | null;
  page_url: string | null;
  date: string;
}

interface BingNews {
  headline: string;
  url: string;
  publisher: string;
  published_at: string;
  snippet: string;
}

interface Client {
  id: string;
  name: string;
  slug: string;
  city: string;
}

export default function GeoPage() {
  const params = useParams();
  const clientSlug = params?.clientSlug as string;

  const [client, setClient] = useState<Client | null>(null);
  const [rankings, setRankings] = useState<BingRanking[]>([]);
  const [news, setNews] = useState<BingNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    if (clientSlug) fetchData();
  }, [clientSlug]);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch client info
      const { data: clientData } = await supabase
        .from('clients')
        .select('id, name, slug, city')
        .eq('slug', clientSlug)
        .single();
      if (!clientData) return;
      setClient(clientData);

      // Fetch latest rankings (most recent date)
      const { data: latestDate } = await supabase
        .from('bing_search_rankings')
        .select('date')
        .eq('client_id', clientData.id)
        .order('date', { ascending: false })
        .limit(1);

      if (latestDate && latestDate.length > 0) {
        const date = latestDate[0].date;
        setLastSync(date);
        setHasData(true);

        const { data: rankData } = await supabase
          .from('bing_search_rankings')
          .select('query, position, page_title, page_url, date')
          .eq('client_id', clientData.id)
          .eq('date', date)
          .order('position', { ascending: true, nullsFirst: false });

        setRankings(rankData || []);

        // Fetch news (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data: newsData } = await supabase
          .from('bing_news_mentions')
          .select('headline, url, publisher, published_at, snippet')
          .eq('client_id', clientData.id)
          .gte('published_at', thirtyDaysAgo.toISOString())
          .order('published_at', { ascending: false })
          .limit(10);

        setNews(newsData || []);
      } else {
        setHasData(false);
      }
    } catch (err) {
      console.error('[GeoPage] Error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function triggerSync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/cron/sync-bing?slug=${clientSlug}`, {
        method: 'GET',
        headers: { authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}` },
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      }
    } catch (err) {
      console.error('[GeoPage] Sync error:', err);
    } finally {
      setSyncing(false);
    }
  }

  // Derived metrics
  const ranked = rankings.filter(r => r.position !== null);
  const top5 = ranked.filter(r => r.position! <= 5).length;
  const top10 = ranked.filter(r => r.position! <= 10).length;
  const top20 = ranked.filter(r => r.position! <= 20).length;
  const notRanked = rankings.filter(r => r.position === null).length;
  const avgPosition = ranked.length > 0
    ? (ranked.reduce((s, r) => s + r.position!, 0) / ranked.length).toFixed(1)
    : null;

  const fmtDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    } catch { return d; }
  };

  const positionColor = (pos: number | null) => {
    if (pos === null) return '#9ca3af';
    if (pos <= 3) return '#059669';
    if (pos <= 10) return '#d9a854';
    return '#9ca3af';
  };

  const positionBg = (pos: number | null) => {
    if (pos === null) return 'rgba(156,163,175,0.1)';
    if (pos <= 3) return 'rgba(5,150,105,0.1)';
    if (pos <= 10) return 'rgba(217,168,84,0.1)';
    return 'rgba(156,163,175,0.1)';
  };

  return (
    <AdminLayout>
      <ClientTabBar
        clientSlug={clientSlug}
        clientName={client?.name}
        clientCity={client?.city}
        activeTab="geo"
      />

      {/* Content */}
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2c2419', margin: '0 0 4px 0' }}>
              GEO · AI Search Visibility
            </h2>
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>
              Bing Web Search rankings · Bing News mentions
              {lastSync && <span> · Last synced: {fmtDate(lastSync)}</span>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '5px', background: 'rgba(0,120,212,0.08)', color: '#0078d4', fontWeight: 600 }}>
              Bing Search API v7
            </span>
            <button
              onClick={triggerSync}
              disabled={syncing}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '9px',
                background: syncing ? '#d4a68a' : '#c4704f',
                color: '#fff', border: 'none', cursor: syncing ? 'not-allowed' : 'pointer',
                fontSize: '12px', fontWeight: 600, opacity: syncing ? 0.8 : 1,
              }}
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px', color: '#9ca3af', fontSize: '14px' }}>
            Loading Bing data…
          </div>
        ) : !hasData ? (
          /* ── Empty state ── */
          <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.08)', borderRadius: '20px', padding: '60px 40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(44,36,25,0.06)' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔎</div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#2c2419', marginBottom: '8px' }}>No Bing data yet</h3>
            <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '24px', maxWidth: '420px', margin: '0 auto 24px' }}>
              Click <strong>Sync Now</strong> to fetch this client&apos;s Bing rankings and news mentions.
              Requires GSC site URL to be configured and keywords in the GSC data.
            </p>
            <button
              onClick={triggerSync}
              disabled={syncing}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '12px 28px', borderRadius: '12px',
                background: '#c4704f', color: '#fff', border: 'none',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <RefreshCw size={15} />
              {syncing ? 'Syncing…' : 'Run First Sync'}
            </button>
          </div>
        ) : (
          <>
            {/* ── KPI Row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
              {[
                { label: 'Top 5 Keywords', value: top5, color: '#059669', border: '#10b981', sub: 'on Bing' },
                { label: 'Top 10 Keywords', value: top10, color: '#d9a854', border: '#d9a854', sub: 'on Bing' },
                { label: 'Top 20 Keywords', value: top20, color: '#5c5850', border: '#9ca3af', sub: 'on Bing' },
                { label: 'Avg Position', value: avgPosition ?? '—', color: '#0078d4', border: '#0078d4', sub: 'across ranked KWs' },
                { label: 'Not Ranked', value: notRanked, color: '#9ca3af', border: '#e5e7eb', sub: 'top 20 not found' },
                { label: 'News Mentions', value: news.length, color: '#c4704f', border: '#c4704f', sub: 'last 30 days' },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'rgba(255,255,255,0.95)',
                  border: '1px solid rgba(44,36,25,0.08)',
                  borderLeft: `3px solid ${s.border}`,
                  borderRadius: '14px', padding: '16px 18px',
                  boxShadow: '0 2px 12px rgba(44,36,25,0.06)',
                }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', marginBottom: '6px' }}>{s.label}</div>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: s.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* ── Rankings + News grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>

              {/* Rankings Table */}
              <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.08)', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 20px rgba(44,36,25,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                  <TrendingUp size={15} style={{ color: '#0078d4' }} />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#2c2419' }}>Bing Organic Rankings</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: 'auto' }}>{rankings.length} keywords tracked</span>
                </div>

                <style>{`
                  .bing-table { width: 100%; border-collapse: collapse; }
                  .bing-table th { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; padding: 0 10px 10px; text-align: left; border-bottom: 1px solid rgba(44,36,25,0.08); }
                  .bing-table td { padding: 11px 10px; font-size: 13px; border-bottom: 1px solid rgba(44,36,25,0.05); vertical-align: middle; }
                  .bing-table tr:last-child td { border-bottom: none; }
                  .bing-table tr:hover td { background: rgba(0,120,212,0.02); }
                `}</style>

                <table className="bing-table">
                  <thead>
                    <tr>
                      <th style={{ width: '50%' }}>Keyword</th>
                      <th style={{ width: '15%', textAlign: 'center' }}>Pos</th>
                      <th style={{ width: '35%' }}>Page</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500, color: '#2c2419' }}>{r.query}</td>
                        <td style={{ textAlign: 'center' }}>
                          {r.position !== null ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: '28px', height: '28px', borderRadius: '7px',
                              fontSize: '12px', fontWeight: 700,
                              background: positionBg(r.position),
                              color: positionColor(r.position),
                            }}>
                              {r.position}
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#d1d5db' }}>—</span>
                          )}
                        </td>
                        <td>
                          {r.page_url ? (
                            <a href={r.page_url} target="_blank" rel="noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0078d4', fontSize: '11px', textDecoration: 'none', overflow: 'hidden' }}
                              onClick={e => e.stopPropagation()}
                            >
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {r.page_title || r.page_url}
                              </span>
                              <ExternalLink size={10} style={{ flexShrink: 0 }} />
                            </a>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#d1d5db' }}>Not in top 20</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {rankings.length === 0 && (
                      <tr><td colSpan={3} style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>No rankings data</td></tr>
                    )}
                  </tbody>
                </table>

                {/* Position distribution bar */}
                {ranked.length > 0 && (
                  <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(44,36,25,0.06)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: '10px' }}>Position Distribution</div>
                    {[
                      { label: 'Top 3', count: ranked.filter(r => r.position! <= 3).length, color: '#059669' },
                      { label: 'Top 5', count: ranked.filter(r => r.position! > 3 && r.position! <= 5).length, color: '#10b981' },
                      { label: 'Top 10', count: ranked.filter(r => r.position! > 5 && r.position! <= 10).length, color: '#d9a854' },
                      { label: '11–20', count: ranked.filter(r => r.position! > 10).length, color: '#9ca3af' },
                    ].map(b => (
                      <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '7px' }}>
                        <span style={{ fontSize: '11px', color: '#5c5850', minWidth: '45px' }}>{b.label}</span>
                        <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'rgba(44,36,25,0.07)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: '3px', background: b.color, width: `${rankings.length > 0 ? (b.count / rankings.length) * 100 : 0}%`, transition: 'width 600ms ease' }} />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: b.color, minWidth: '16px', textAlign: 'right' }}>{b.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* News Mentions */}
              <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.08)', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 20px rgba(44,36,25,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                  <Newspaper size={15} style={{ color: '#c4704f' }} />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#2c2419' }}>Bing News Mentions</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: 'auto' }}>Last 30 days</span>
                </div>

                {news.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9ca3af', fontSize: '13px' }}>
                    No news mentions found in the last 30 days
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {news.map((n, i) => (
                      <a key={i} href={n.url} target="_blank" rel="noreferrer"
                        style={{ display: 'block', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(44,36,25,0.07)', background: 'rgba(245,241,237,0.4)', textDecoration: 'none', transition: 'background 150ms' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(196,112,79,0.04)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245,241,237,0.4)')}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#2c2419', lineHeight: 1.4 }}>{n.headline}</span>
                          <ExternalLink size={12} style={{ color: '#9ca3af', flexShrink: 0, marginTop: '2px' }} />
                        </div>
                        {n.snippet && (
                          <p style={{ fontSize: '12px', color: '#5c5850', margin: '0 0 6px', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                            {n.snippet}
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#9ca3af' }}>
                          {n.publisher && <span style={{ fontWeight: 600 }}>{n.publisher}</span>}
                          {n.published_at && <span>{fmtDate(n.published_at)}</span>}
                        </div>
                      </a>
                    ))}
                  </div>
                )}

                {/* Info note */}
                <div style={{ marginTop: '16px', padding: '10px 12px', background: 'rgba(0,120,212,0.04)', border: '1px solid rgba(0,120,212,0.12)', borderRadius: '8px', fontSize: '11px', color: '#5c5850' }}>
                  <strong style={{ color: '#0078d4' }}>Data source:</strong> Bing News Search API — articles mentioning &quot;{client?.name}&quot; indexed by Bing in the last 30 days.
                </div>
              </div>

            </div>

            {/* Bing vs Google note */}
            <div style={{ marginTop: '20px', padding: '14px 18px', background: 'rgba(107,70,193,0.04)', border: '1px solid rgba(107,70,193,0.12)', borderRadius: '12px', fontSize: '12px', color: '#5c5850' }}>
              <strong style={{ color: '#6b46c1' }}>Why Bing rankings matter for AI:</strong> Microsoft Copilot, ChatGPT Browse, and Perplexity all use Bing&apos;s index as a primary data source. A strong Bing ranking significantly increases the likelihood of being cited in AI-generated responses (GEO — Generative Engine Optimization).
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
