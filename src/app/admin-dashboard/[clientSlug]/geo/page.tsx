'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { createClient } from '@supabase/supabase-js';
import AdminLayout from '@/components/admin/AdminLayout';
import ClientTabBar from '@/components/admin/ClientTabBar';
import { fmtNum } from '@/lib/format';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { ExternalLink, Newspaper, RefreshCw, Upload, Bot, Globe } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface PageStat {
  page_url: string;
  clicks: number;
  impressions: number;
  avg_position: number | null;
  date: string;
}

interface AiCitationDaily {
  date: string;
  citations: number;
  cited_pages: number;
}

interface AiPageCitation {
  page_url: string;
  citations: number;
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
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const canImport = userRole === 'admin' || userRole === 'team';

  const [client, setClient] = useState<Client | null>(null);
  const [pageStats, setPageStats] = useState<PageStat[]>([]);
  const [aiDaily, setAiDaily] = useState<AiCitationDaily[]>([]);
  const [aiPages, setAiPages] = useState<AiPageCitation[]>([]);
  const [news, setNews] = useState<BingNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);

  // Import modal state
  const [showImport, setShowImport] = useState(false);
  const [importRaw, setImportRaw] = useState('');
  const [importPageRaw, setImportPageRaw] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  useEffect(() => {
    if (clientSlug) fetchData();
  }, [clientSlug]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: clientData } = await supabase
        .from('clients')
        .select('id, name, slug, city')
        .eq('slug', clientSlug)
        .single();
      if (!clientData) return;
      setClient(clientData);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyStr = thirtyDaysAgo.toISOString().split('T')[0];

      // BWT page stats — aggregate by page across date range
      const { data: psData } = await supabase
        .from('bing_page_stats')
        .select('page_url, clicks, impressions, avg_position, date')
        .eq('client_id', clientData.id)
        .gte('date', thirtyStr)
        .order('date', { ascending: false });

      // AI Citations daily
      const { data: aiData } = await supabase
        .from('bing_ai_citations')
        .select('date, citations, cited_pages')
        .eq('client_id', clientData.id)
        .order('date', { ascending: true });

      // AI Citations per page
      const { data: aiPageData } = await supabase
        .from('bing_ai_page_citations')
        .select('page_url, citations')
        .eq('client_id', clientData.id)
        .order('citations', { ascending: false })
        .limit(20);

      // News
      const { data: newsData } = await supabase
        .from('bing_news_mentions')
        .select('headline, url, publisher, published_at, snippet')
        .eq('client_id', clientData.id)
        .order('published_at', { ascending: false })
        .limit(10);

      const ps = psData || [];
      const ai = aiData || [];
      const aip = aiPageData || [];
      const n = newsData || [];

      setPageStats(ps);
      setAiDaily(ai);
      setAiPages(aip);
      setNews(n);

      const hasAny = ps.length > 0 || ai.length > 0 || n.length > 0;
      setHasData(hasAny);

      if (ps.length > 0) {
        const sorted = [...ps].sort((a, b) => b.date.localeCompare(a.date));
        setLastSync(sorted[0].date);
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
      const res = await fetch(`/api/cron/sync-bing?slug=${clientSlug}`);
      const data = await res.json();
      if (data.success) await fetchData();
    } catch (err) {
      console.error('[GeoPage] Sync error:', err);
    } finally {
      setSyncing(false);
    }
  }

  // Parse tab-separated citation data pasted from BWT dashboard
  // Format: "11/27/2025 12:00:00 AM\t63\t12\n..."
  function parseDailyCitations(raw: string) {
    return raw.trim().split('\n').map(line => {
      const parts = line.trim().split(/\t/);
      const dateStr = parts[0]?.trim();
      const citations = parseInt(parts[1] || '0', 10);
      const citedPages = parseInt(parts[2] || '0', 10);
      // Normalize date: "11/27/2025 12:00:00 AM" → "2025-11-27"
      const d = new Date(dateStr);
      const date = isNaN(d.getTime()) ? dateStr : d.toISOString().split('T')[0];
      return { date, citations, citedPages };
    }).filter(r => r.date && !isNaN(r.citations));
  }

  // Parse page citations: "https://example.com/page\t2070\n..."
  function parsePageCitations(raw: string) {
    return raw.trim().split('\n').map(line => {
      const parts = line.trim().split(/\t/);
      const pageUrl = parts[0]?.trim();
      const citations = parseInt(parts[1] || '0', 10);
      return { pageUrl, citations };
    }).filter(r => r.pageUrl && !isNaN(r.citations));
  }

  async function handleImport() {
    if (!client) return;
    setImporting(true);
    setImportMsg('');
    try {
      const dailyCitations = importRaw ? parseDailyCitations(importRaw) : [];
      const pageCitations = importPageRaw ? parsePageCitations(importPageRaw) : [];

      if (dailyCitations.length === 0 && pageCitations.length === 0) {
        setImportMsg('No valid data found. Check format: paste tab-separated data from BWT.');
        return;
      }

      const res = await fetch('/api/admin/import-bing-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, dailyCitations, pageCitations }),
      });
      const result = await res.json();
      if (result.success) {
        setImportMsg(`Saved: ${dailyCitations.length} daily rows, ${pageCitations.length} page rows.`);
        setImportRaw('');
        setImportPageRaw('');
        await fetchData();
        setTimeout(() => setShowImport(false), 1500);
      } else {
        setImportMsg(`Error: ${JSON.stringify(result)}`);
      }
    } catch (err: any) {
      setImportMsg(`Error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  }

  // Aggregate page stats by page URL (sum clicks/impressions, latest avg_position)
  const pageAgg = Object.values(
    pageStats.reduce<Record<string, { page_url: string; clicks: number; impressions: number; avg_position: number | null }>>((acc, r) => {
      if (!acc[r.page_url]) acc[r.page_url] = { page_url: r.page_url, clicks: 0, impressions: 0, avg_position: r.avg_position };
      acc[r.page_url].clicks += r.clicks;
      acc[r.page_url].impressions += r.impressions;
      if (r.avg_position !== null) acc[r.page_url].avg_position = r.avg_position;
      return acc;
    }, {})
  ).sort((a, b) => b.clicks - a.clicks).slice(0, 20);

  const totalClicks = pageAgg.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = pageAgg.reduce((s, r) => s + r.impressions, 0);
  const posPages = pageAgg.filter(r => r.avg_position !== null);
  const avgPos = posPages.length > 0
    ? (posPages.reduce((s, r) => s + r.avg_position!, 0) / posPages.length).toFixed(1)
    : null;

  const totalCitations = aiDaily.reduce((s, r) => s + r.citations, 0);
  const latestAiRow = aiDaily[aiDaily.length - 1];

  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    catch { return d; }
  };

  const fmtDateLong = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }); }
    catch { return d; }
  };

  const posColor = (p: number | null) => {
    if (p === null) return '#9ca3af';
    if (p <= 3) return '#059669';
    if (p <= 10) return '#d9a854';
    return '#9ca3af';
  };

  const shortUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

  return (
    <AdminLayout>
      <ClientTabBar
        clientSlug={clientSlug}
        clientName={client?.name}
        clientCity={client?.city}
        activeTab="geo"
      />

      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2c2419', margin: '0 0 4px 0' }}>
              GEO · AI Search Visibility
            </h2>
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>
              Bing Webmaster Tools organic data · Bing News · AI Citations
              {lastSync && <span> · Last BWT sync: {fmtDateLong(lastSync)}</span>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {canImport && (
              <button
                onClick={() => setShowImport(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '9px',
                  background: 'rgba(107,70,193,0.1)', color: '#6b46c1',
                  border: '1px solid rgba(107,70,193,0.2)', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 600,
                }}
              >
                <Upload size={13} />
                Import AI Citations
              </button>
            )}
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
              <RefreshCw size={13} />
              {syncing ? 'Syncing…' : 'Sync Bing'}
            </button>
          </div>
        </div>

        {/* Import Modal */}
        {showImport && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={e => { if (e.target === e.currentTarget) setShowImport(false); }}>
            <div style={{ background: '#fff', borderRadius: '20px', padding: '28px', width: '580px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#2c2419', margin: 0 }}>Import Bing AI Citations</h3>
                <button onClick={() => setShowImport(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#9ca3af', lineHeight: 1 }}>×</button>
              </div>

              <div style={{ fontSize: '12px', color: '#5c5850', padding: '10px 14px', background: 'rgba(107,70,193,0.05)', border: '1px solid rgba(107,70,193,0.12)', borderRadius: '8px', marginBottom: '18px' }}>
                <strong style={{ color: '#6b46c1' }}>How to export from BWT:</strong> Go to Bing Webmaster Tools → AI section → select date range → click Export (or copy data). Paste tab-separated rows below.
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#5c5850', display: 'block', marginBottom: '6px' }}>
                  Daily Citations (paste rows: Date · Citations · Cited Pages)
                </label>
                <textarea
                  value={importRaw}
                  onChange={e => setImportRaw(e.target.value)}
                  placeholder={'11/27/2025 12:00:00 AM\t63\t12\n11/28/2025 12:00:00 AM\t71\t14'}
                  rows={6}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(44,36,25,0.15)', fontSize: '12px', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#5c5850', display: 'block', marginBottom: '6px' }}>
                  Page-level Citations (paste rows: Page URL · Citations)
                </label>
                <textarea
                  value={importPageRaw}
                  onChange={e => setImportPageRaw(e.target.value)}
                  placeholder={'https://example.com/page-one\t2070\nhttps://example.com/page-two\t840'}
                  rows={6}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(44,36,25,0.15)', fontSize: '12px', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              {importMsg && (
                <div style={{ fontSize: '12px', padding: '8px 12px', borderRadius: '7px', marginBottom: '14px', background: importMsg.startsWith('Error') ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', color: importMsg.startsWith('Error') ? '#dc2626' : '#059669', border: `1px solid ${importMsg.startsWith('Error') ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}` }}>
                  {importMsg}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowImport(false)} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid rgba(44,36,25,0.15)', background: 'transparent', color: '#5c5850', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
                  Cancel
                </button>
                <button onClick={handleImport} disabled={importing} style={{ padding: '9px 20px', borderRadius: '8px', background: importing ? '#a78bfa' : '#6b46c1', color: '#fff', border: 'none', cursor: importing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
                  {importing ? 'Saving…' : 'Save to Database'}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px', color: '#9ca3af', fontSize: '14px' }}>
            Loading Bing data…
          </div>
        ) : !hasData ? (
          /* Empty state */
          <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.08)', borderRadius: '20px', padding: '60px 40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(44,36,25,0.06)' }}>
            <Bot size={36} style={{ color: '#0078d4', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#2c2419', marginBottom: '8px' }}>No Bing data yet</h3>
            <p style={{ fontSize: '14px', color: '#9ca3af', maxWidth: '420px', margin: '0 auto 24px' }}>
              Click <strong>Sync Bing</strong> to fetch organic page data from Bing Webmaster Tools.
              Then use <strong>Import AI Citations</strong> to add AI citation data from the BWT dashboard.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={triggerSync} disabled={syncing} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: '#c4704f', color: '#fff', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                <RefreshCw size={15} /> {syncing ? 'Syncing…' : 'Sync Bing Data'}
              </button>
              {canImport && (
                <button onClick={() => setShowImport(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: 'rgba(107,70,193,0.1)', color: '#6b46c1', border: '1px solid rgba(107,70,193,0.2)', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  <Upload size={15} /> Import AI Citations
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* KPI Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
              {[
                { label: 'Bing Clicks', value: fmtNum(totalClicks), color: '#0078d4', border: '#0078d4', sub: 'last 30 days' },
                { label: 'Bing Impressions', value: fmtNum(totalImpressions), color: '#5c5850', border: '#9ca3af', sub: 'last 30 days' },
                { label: 'Avg Position', value: avgPos ?? '—', color: avgPos ? (parseFloat(avgPos) <= 5 ? '#059669' : parseFloat(avgPos) <= 10 ? '#d9a854' : '#9ca3af') : '#9ca3af', border: '#0078d4', sub: 'Bing organic' },
                { label: 'AI Citations', value: fmtNum(totalCitations), color: '#6b46c1', border: '#6b46c1', sub: aiDaily.length > 0 ? `${aiDaily.length} days tracked` : 'import data' },
                { label: 'Cited Pages', value: fmtNum(aiPages.length), color: '#6b46c1', border: '#a78bfa', sub: 'unique pages' },
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

            {/* AI Citations Trend (if data) */}
            {aiDaily.length > 1 && (
              <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.08)', borderRadius: '20px', padding: '24px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(44,36,25,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                  <Bot size={15} style={{ color: '#6b46c1' }} />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#2c2419' }}>AI Citations Trend</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: 'auto' }}>Total: {fmtNum(totalCitations)} citations</span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={aiDaily} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6b46c1" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#6b46c1" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(44,36,25,0.07)" />
                    <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip
                      contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid rgba(44,36,25,0.1)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      labelFormatter={fmtDateLong}
                      formatter={(v: any, name: string) => [fmtNum(v), name === 'citations' ? 'Citations' : 'Cited Pages']}
                    />
                    <Area type="monotone" dataKey="citations" name="citations" stroke="#6b46c1" strokeWidth={2} fill="url(#aiGrad)" dot={false} />
                    <Area type="monotone" dataKey="cited_pages" name="cited_pages" stroke="#a78bfa" strokeWidth={1.5} fill="none" dot={false} strokeDasharray="4 2" />
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '11px', color: '#9ca3af' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '14px', height: '2px', background: '#6b46c1', display: 'inline-block' }} /> Total Citations</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '14px', height: '2px', background: '#a78bfa', display: 'inline-block', borderBottom: '2px dashed #a78bfa', borderTop: 'none' }} /> Cited Pages</span>
                </div>
              </div>
            )}

            {/* Grid: Bing Organic + AI Pages */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px', alignItems: 'start' }}>

              {/* Bing Organic Pages */}
              <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.08)', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 20px rgba(44,36,25,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                  <Globe size={15} style={{ color: '#0078d4' }} />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#2c2419' }}>Bing Organic Pages</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: 'auto' }}>Top by clicks · 30d</span>
                </div>

                {pageAgg.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af', fontSize: '13px' }}>No page stats yet — click Sync Bing</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Page', 'Clicks', 'Impr', 'Pos'].map(h => (
                          <th key={h} style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', padding: '0 8px 10px', textAlign: h === 'Page' ? 'left' : 'center', borderBottom: '1px solid rgba(44,36,25,0.08)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageAgg.slice(0, 15).map((r, i) => (
                        <tr key={i}>
                          <td style={{ padding: '9px 8px', borderBottom: '1px solid rgba(44,36,25,0.05)', maxWidth: '200px', overflow: 'hidden' }}>
                            <a href={r.page_url} target="_blank" rel="noreferrer" style={{ color: '#0078d4', fontSize: '11px', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {shortUrl(r.page_url)}
                            </a>
                          </td>
                          <td style={{ padding: '9px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#2c2419', borderBottom: '1px solid rgba(44,36,25,0.05)' }}>{fmtNum(r.clicks)}</td>
                          <td style={{ padding: '9px 8px', textAlign: 'center', fontSize: '12px', color: '#5c5850', borderBottom: '1px solid rgba(44,36,25,0.05)' }}>{fmtNum(r.impressions)}</td>
                          <td style={{ padding: '9px 8px', textAlign: 'center', borderBottom: '1px solid rgba(44,36,25,0.05)' }}>
                            {r.avg_position !== null ? (
                              <span style={{ fontSize: '12px', fontWeight: 700, color: posColor(r.avg_position) }}>{r.avg_position.toFixed(1)}</span>
                            ) : <span style={{ color: '#d1d5db', fontSize: '11px' }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* AI Page Citations */}
              <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.08)', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 20px rgba(44,36,25,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                  <Bot size={15} style={{ color: '#6b46c1' }} />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#2c2419' }}>AI-Cited Pages</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: 'auto' }}>By citation count</span>
                </div>

                {aiPages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af', fontSize: '13px' }}>
                    No AI page data — use <strong>Import AI Citations</strong> above to add page-level data from BWT.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Page', 'Citations'].map(h => (
                          <th key={h} style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', padding: '0 8px 10px', textAlign: h === 'Page' ? 'left' : 'center', borderBottom: '1px solid rgba(44,36,25,0.08)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {aiPages.map((r, i) => (
                        <tr key={i}>
                          <td style={{ padding: '9px 8px', borderBottom: '1px solid rgba(44,36,25,0.05)', maxWidth: '260px' }}>
                            <a href={r.page_url} target="_blank" rel="noreferrer" style={{ color: '#6b46c1', fontSize: '11px', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {shortUrl(r.page_url)}
                            </a>
                          </td>
                          <td style={{ padding: '9px 8px', textAlign: 'center', borderBottom: '1px solid rgba(44,36,25,0.05)' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#6b46c1' }}>{fmtNum(r.citations)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* News Mentions */}
            {news.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.08)', borderRadius: '20px', padding: '24px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(44,36,25,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                  <Newspaper size={15} style={{ color: '#c4704f' }} />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#2c2419' }}>Bing News Mentions</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: 'auto' }}>Last 30 days · {news.length} articles</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '10px' }}>
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
                        {n.published_at && <span>{fmtDateLong(n.published_at)}</span>}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Info note */}
            <div style={{ padding: '14px 18px', background: 'rgba(107,70,193,0.04)', border: '1px solid rgba(107,70,193,0.12)', borderRadius: '12px', fontSize: '12px', color: '#5c5850' }}>
              <strong style={{ color: '#6b46c1' }}>Why Bing rankings matter for AI:</strong> Microsoft Copilot, ChatGPT Browse, and Perplexity all use Bing&apos;s index as a primary data source. A strong Bing organic presence significantly increases the likelihood of being cited in AI-generated responses (GEO — Generative Engine Optimization).
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
