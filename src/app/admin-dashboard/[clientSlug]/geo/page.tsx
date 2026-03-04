'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { createClient } from '@supabase/supabase-js';
import AdminLayout from '@/components/admin/AdminLayout';
import ClientTabBar from '@/components/admin/ClientTabBar';
import { fmtNum } from '@/lib/format';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Upload, Bot, FileSpreadsheet, Search, TrendingUp, Zap } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface AiCitationDaily {
  date: string;
  citations: number;
  cited_pages: number;
}

interface AiPageCitation {
  page_url: string;
  citations: number;
}

interface AiQuery {
  query_text: string;
  citations: number;
  date: string | null;
}

interface Client {
  id: string;
  name: string;
  slug: string;
  city: string;
}

const PRESETS = [30, 90, 0] as const; // 0 = All time
type Preset = typeof PRESETS[number];

export default function GeoPage() {
  const params = useParams();
  const clientSlug = params?.clientSlug as string;
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const canImport = userRole === 'admin' || userRole === 'team';

  const [client, setClient] = useState<Client | null>(null);
  const [aiDaily, setAiDaily] = useState<AiCitationDaily[]>([]);
  const [aiPages, setAiPages] = useState<AiPageCitation[]>([]);
  const [aiQueries, setAiQueries] = useState<AiQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState<Preset>(30);

  // Import modal state
  const [showImport, setShowImport] = useState(false);
  const [importRaw, setImportRaw] = useState('');
  const [importPageRaw, setImportPageRaw] = useState('');
  const [importQueryRaw, setImportQueryRaw] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [importMode, setImportMode] = useState<'paste' | 'excel'>('excel');
  const [excelFileName, setExcelFileName] = useState('');
  const [excelPreview, setExcelPreview] = useState<{ daily: any[]; pages: any[]; queries: any[] }>({ daily: [], pages: [], queries: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      const [{ data: aiData }, { data: aiPageData }, { data: queryData }] = await Promise.all([
        supabase.from('bing_ai_citations').select('date, citations, cited_pages').eq('client_id', clientData.id).order('date', { ascending: true }),
        supabase.from('bing_ai_page_citations').select('page_url, citations').eq('client_id', clientData.id).order('citations', { ascending: false }).limit(20),
        supabase.from('bing_ai_queries').select('query_text, citations, date').eq('client_id', clientData.id).order('citations', { ascending: false }).limit(50),
      ]);

      setAiDaily(aiData || []);
      setAiPages(aiPageData || []);
      setAiQueries(queryData || []);
    } catch (err) {
      console.error('[GeoPage] Error:', err);
    } finally {
      setLoading(false);
    }
  }

  // ── Date filtering ─────────────────────────────────────────────────────────
  const lastDataDate = aiDaily.length > 0 ? aiDaily[aiDaily.length - 1].date : null;

  const filteredDaily = useMemo(() => {
    if (selectedDays === 0 || aiDaily.length === 0) return aiDaily;
    const cutoff = new Date(lastDataDate!);
    cutoff.setDate(cutoff.getDate() - selectedDays + 1);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return aiDaily.filter(r => r.date >= cutoffStr);
  }, [aiDaily, selectedDays, lastDataDate]);

  const hasData = aiDaily.length > 0 || aiPages.length > 0 || aiQueries.length > 0;

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const totalCitations = filteredDaily.reduce((s, r) => s + r.citations, 0);
  const avgCitationsPerDay = filteredDaily.length > 0
    ? Math.round(totalCitations / filteredDaily.length)
    : 0;
  const peakDay = filteredDaily.reduce((best, r) => r.citations > best.citations ? r : best, { citations: 0, date: '' });

  // ── Parse helpers ──────────────────────────────────────────────────────────
  function parseDailyCitations(raw: string) {
    return raw.trim().split('\n').map(line => {
      const parts = line.trim().split(/\t/);
      const dateStr = parts[0]?.trim();
      const citations = parseInt(parts[1] || '0', 10);
      const citedPages = parseInt(parts[2] || '0', 10);
      const d = new Date(dateStr);
      const date = isNaN(d.getTime()) ? dateStr : d.toISOString().split('T')[0];
      return { date, citations, citedPages };
    }).filter(r => r.date && !isNaN(r.citations));
  }

  function parsePageCitations(raw: string) {
    return raw.trim().split('\n').map(line => {
      const parts = line.trim().split(/\t/);
      const pageUrl = parts[0]?.trim();
      const citations = parseInt(parts[1] || '0', 10);
      return { pageUrl, citations };
    }).filter(r => r.pageUrl && !isNaN(r.citations));
  }

  function parseQueryCitations(raw: string) {
    return raw.trim().split('\n').map(line => {
      const parts = line.trim().split(/\t/);
      const queryText = parts[0]?.trim();
      const citations = parseInt(parts[1] || '0', 10);
      return { queryText, citations };
    }).filter(r => r.queryText && !isNaN(r.citations));
  }

  async function handleExcelFile(file: File) {
    setExcelFileName(file.name);
    setImportMsg('Loading file...');
    const XLSX = await import('xlsx');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const daily: Array<{ date: string; citations: number; citedPages: number }> = [];
        const pages: Array<{ pageUrl: string; citations: number }> = [];
        const queries: Array<{ queryText: string; citations: number }> = [];

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          if (rows.length === 0) continue;
          const headers = Object.keys(rows[0]).map(h => h.toLowerCase().trim());
          const hasDate = headers.some(h => h.includes('date'));
          const hasCitations = headers.some(h => h.includes('citation') || h.includes('total'));
          const hasUrl = headers.some(h => h.includes('url') || h.includes('page') || h.includes('link'));
          const hasQuery = headers.some(h => h.includes('query') || h.includes('search') || h.includes('keyword') || h.includes('term'));

          if (hasQuery && hasCitations) {
            for (const row of rows) {
              const keys = Object.keys(row);
              const queryKey = keys.find(k => { const kl = k.toLowerCase(); return kl.includes('query') || kl.includes('search') || kl.includes('keyword') || kl.includes('term'); });
              const citKey = keys.find(k => k.toLowerCase().includes('citation') || k.toLowerCase().includes('count') || k.toLowerCase().includes('total'));
              if (!queryKey) continue;
              const queryText = String(row[queryKey]).trim();
              const citations = parseInt(citKey ? row[citKey] : '0', 10) || 0;
              if (queryText && citations > 0) queries.push({ queryText, citations });
            }
          } else if (hasDate && hasCitations && !hasUrl) {
            for (const row of rows) {
              const keys = Object.keys(row);
              const dateKey = keys.find(k => k.toLowerCase().includes('date'));
              const citKey = keys.find(k => k.toLowerCase().includes('citation') || k.toLowerCase().includes('total'));
              const pagesKey = keys.find(k => k.toLowerCase().includes('page') || k.toLowerCase().includes('cited'));
              if (!dateKey) continue;
              let dateVal = row[dateKey];
              if (dateVal instanceof Date) {
                dateVal = dateVal.toISOString().split('T')[0];
              } else if (typeof dateVal === 'string') {
                const d = new Date(dateVal);
                dateVal = isNaN(d.getTime()) ? dateVal : d.toISOString().split('T')[0];
              } else if (typeof dateVal === 'number') {
                const d = XLSX.SSF.parse_date_code(dateVal);
                dateVal = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
              }
              const citations = parseInt(citKey ? row[citKey] : '0', 10) || 0;
              const citedPages = parseInt(pagesKey ? row[pagesKey] : '0', 10) || 0;
              if (dateVal && citations > 0) daily.push({ date: dateVal, citations, citedPages });
            }
          } else if (hasUrl) {
            for (const row of rows) {
              const keys = Object.keys(row);
              const urlKey = keys.find(k => k.toLowerCase().includes('url') || k.toLowerCase().includes('page') || k.toLowerCase().includes('link'));
              const citKey = keys.find(k => k.toLowerCase().includes('citation') || k.toLowerCase().includes('count') || k.toLowerCase().includes('total'));
              if (!urlKey) continue;
              const pageUrl = String(row[urlKey]).trim();
              const citations = parseInt(citKey ? row[citKey] : '0', 10) || 0;
              if (pageUrl.startsWith('http') && citations > 0) pages.push({ pageUrl, citations });
            }
          }
        }

        setExcelPreview({ daily, pages, queries });
        const parts = [];
        if (daily.length > 0) parts.push(`${daily.length} daily rows`);
        if (pages.length > 0) parts.push(`${pages.length} page rows`);
        if (queries.length > 0) parts.push(`${queries.length} query rows`);
        if (parts.length === 0) {
          setImportMsg('Could not detect citation data. Make sure columns include "Date" + "Citations", "URL" + "Citations", or "Query" + "Citations".');
        } else {
          setImportMsg(`Found: ${parts.join(', ')}. Click Save to import.`);
        }
      } catch (err: any) {
        setImportMsg(`Error reading file: ${err.message}`);
        setExcelPreview({ daily: [], pages: [], queries: [] });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    if (!client) return;
    setImporting(true);
    setImportMsg('');
    try {
      let dailyCitations: Array<{ date: string; citations: number; citedPages: number }> = [];
      let pageCitations: Array<{ pageUrl: string; citations: number }> = [];
      let queryCitations: Array<{ queryText: string; citations: number }> = [];

      if (importMode === 'excel') {
        dailyCitations = excelPreview.daily;
        pageCitations = excelPreview.pages;
        queryCitations = excelPreview.queries;
      } else {
        dailyCitations = importRaw ? parseDailyCitations(importRaw) : [];
        pageCitations = importPageRaw ? parsePageCitations(importPageRaw) : [];
        queryCitations = importQueryRaw ? parseQueryCitations(importQueryRaw) : [];
      }

      if (dailyCitations.length === 0 && pageCitations.length === 0 && queryCitations.length === 0) {
        setImportMsg('No valid data found. Upload an Excel file or paste tab-separated data from BWT.');
        setImporting(false);
        return;
      }

      const res = await fetch('/api/admin/import-bing-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, dailyCitations, pageCitations, queryCitations }),
      });
      const result = await res.json();
      if (result.success) {
        const errors = Object.values(result.results || {}).filter((r: any) => r.error);
        if (errors.length > 0) {
          setImportMsg(`Partial save. Errors: ${JSON.stringify(errors)}`);
        } else {
          const saved = [];
          if (dailyCitations.length > 0) saved.push(`${dailyCitations.length} daily`);
          if (pageCitations.length > 0) saved.push(`${pageCitations.length} pages`);
          if (queryCitations.length > 0) saved.push(`${queryCitations.length} queries`);
          setImportMsg(`Saved: ${saved.join(', ')} rows.`);
        }
        setImportRaw(''); setImportPageRaw(''); setImportQueryRaw('');
        setExcelPreview({ daily: [], pages: [], queries: [] });
        setExcelFileName('');
        await fetchData();
        setTimeout(() => setShowImport(false), 2000);
      } else {
        setImportMsg(`Error: ${result.error || JSON.stringify(result)}`);
      }
    } catch (err: any) {
      setImportMsg(`Error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  }

  const fmtDate = (d: string) => {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    catch { return d; }
  };
  const fmtDateLong = (d: string) => {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }); }
    catch { return d; }
  };
  const shortUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

  const presetLabel = (d: Preset) => d === 0 ? 'All' : `${d}D`;

  return (
    <AdminLayout>
      <ClientTabBar
        clientSlug={clientSlug}
        clientName={client?.name}
        clientCity={client?.city}
        activeTab="geo"
      />

      {/* Sticky date bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(245, 241, 237, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(44, 36, 25, 0.08)',
        padding: '10px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px',
      }}>
        {hasData && PRESETS.map(d => (
          <button
            key={d}
            onClick={() => setSelectedDays(d)}
            style={{
              padding: '5px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
              border: '1px solid rgba(44,36,25,0.15)', cursor: 'pointer',
              background: selectedDays === d ? '#fff' : 'transparent',
              color: selectedDays === d ? '#2c2419' : '#9ca3af',
              boxShadow: selectedDays === d ? '0 1px 4px rgba(44,36,25,0.1)' : 'none',
              transition: 'all 150ms',
            }}
          >
            {presetLabel(d)}
          </button>
        ))}
        {lastDataDate && (
          <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '4px' }}>
            Data through {new Date(lastDataDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
      </div>

      <div style={{ padding: '28px 24px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7c3aed', margin: '0 0 6px 0' }}>
              GEO / AI VISIBILITY
            </p>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#2c2419', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
              AI Search Visibility
            </h1>
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>
              How often AI assistants like Copilot, ChatGPT, and Perplexity cite your website
            </p>
          </div>
          {canImport && (
            <button
              onClick={() => setShowImport(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '10px 18px', borderRadius: '12px',
                background: 'rgba(124,58,237,0.1)', color: '#7c3aed',
                border: '1px solid rgba(124,58,237,0.2)', cursor: 'pointer',
                fontSize: '13px', fontWeight: 600,
              }}
            >
              <Upload size={14} />
              Import AI Data
            </button>
          )}
        </div>

        {/* Import Modal */}
        {showImport && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={e => { if (e.target === e.currentTarget) setShowImport(false); }}>
            <div style={{ background: '#fff', borderRadius: '20px', padding: '28px', width: '620px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#2c2419', margin: 0 }}>Import AI Citation Data</h3>
                <button onClick={() => setShowImport(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#9ca3af', lineHeight: 1 }}>×</button>
              </div>

              <div style={{ display: 'flex', gap: '4px', marginBottom: '18px', background: 'rgba(44,36,25,0.04)', borderRadius: '10px', padding: '3px' }}>
                {(['excel', 'paste'] as const).map(mode => (
                  <button key={mode} onClick={() => { setImportMode(mode); setImportMsg(''); }}
                    style={{ flex: 1, padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 150ms', background: importMode === mode ? '#7c3aed' : 'transparent', color: importMode === mode ? '#fff' : '#5c5850' }}>
                    {mode === 'excel' ? 'Upload Excel File' : 'Paste Data'}
                  </button>
                ))}
              </div>

              {importMode === 'excel' ? (
                <>
                  <div style={{ fontSize: '12px', color: '#5c5850', padding: '10px 14px', background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.12)', borderRadius: '8px', marginBottom: '18px' }}>
                    <strong style={{ color: '#7c3aed' }}>How to export from BWT:</strong> Go to Bing Webmaster Tools → AI section → select date range → click <strong>Export</strong> → save as .xlsx or .csv. Supports sheets for daily citations, page citations, and query citations.
                  </div>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                    onChange={e => { const file = e.target.files?.[0]; if (file) handleExcelFile(file); }} />
                  <div onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#7c3aed'; }}
                    onDragLeave={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)'; }}
                    onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)'; const file = e.dataTransfer.files?.[0]; if (file) handleExcelFile(file); }}
                    style={{ border: '2px dashed rgba(124,58,237,0.3)', borderRadius: '14px', padding: excelFileName ? '16px 20px' : '36px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: '16px', background: 'rgba(124,58,237,0.02)', transition: 'border-color 150ms' }}>
                    {excelFileName ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
                        <FileSpreadsheet size={20} style={{ color: '#059669' }} />
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#2c2419' }}>{excelFileName}</div>
                          <div style={{ fontSize: '11px', color: '#9ca3af' }}>{excelPreview.daily.length} daily · {excelPreview.pages.length} pages · {excelPreview.queries.length} queries</div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); setExcelFileName(''); setExcelPreview({ daily: [], pages: [], queries: [] }); setImportMsg(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                          style={{ marginLeft: '8px', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', color: '#dc2626', fontSize: '11px', cursor: 'pointer' }}>
                          Remove
                        </button>
                      </div>
                    ) : (
                      <>
                        <FileSpreadsheet size={28} style={{ color: '#7c3aed', marginBottom: '8px' }} />
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#2c2419', marginBottom: '4px' }}>Click to upload or drag & drop</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>.xlsx, .xls, or .csv — exported from Bing Webmaster Tools</div>
                      </>
                    )}
                  </div>

                  {excelPreview.daily.length > 0 && (
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed', marginBottom: '6px' }}>Preview: Daily Citations ({excelPreview.daily.length} rows)</div>
                      <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid rgba(44,36,25,0.08)', borderRadius: '8px', fontSize: '11px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead><tr style={{ background: 'rgba(124,58,237,0.04)' }}>{['Date', 'Citations', 'Cited Pages'].map(h => <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Date' ? 'left' : 'center', fontWeight: 600, color: '#5c5850' }}>{h}</th>)}</tr></thead>
                          <tbody>
                            {excelPreview.daily.slice(0, 5).map((r, i) => (
                              <tr key={i} style={{ borderTop: '1px solid rgba(44,36,25,0.05)' }}>
                                <td style={{ padding: '5px 10px', color: '#2c2419' }}>{r.date}</td>
                                <td style={{ padding: '5px 10px', textAlign: 'center', fontWeight: 600, color: '#7c3aed' }}>{r.citations}</td>
                                <td style={{ padding: '5px 10px', textAlign: 'center', color: '#5c5850' }}>{r.citedPages}</td>
                              </tr>
                            ))}
                            {excelPreview.daily.length > 5 && <tr><td colSpan={3} style={{ padding: '5px 10px', color: '#9ca3af', textAlign: 'center' }}>... +{excelPreview.daily.length - 5} more</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {excelPreview.pages.length > 0 && (
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed', marginBottom: '6px' }}>Preview: Page Citations ({excelPreview.pages.length} pages)</div>
                      <div style={{ maxHeight: '100px', overflowY: 'auto', border: '1px solid rgba(44,36,25,0.08)', borderRadius: '8px', fontSize: '11px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead><tr style={{ background: 'rgba(124,58,237,0.04)' }}>{['Page URL', 'Citations'].map(h => <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Page URL' ? 'left' : 'center', fontWeight: 600, color: '#5c5850' }}>{h}</th>)}</tr></thead>
                          <tbody>
                            {excelPreview.pages.slice(0, 5).map((r, i) => (
                              <tr key={i} style={{ borderTop: '1px solid rgba(44,36,25,0.05)' }}>
                                <td style={{ padding: '5px 10px', color: '#2c2419', maxWidth: '350px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.pageUrl}</td>
                                <td style={{ padding: '5px 10px', textAlign: 'center', fontWeight: 600, color: '#7c3aed' }}>{r.citations}</td>
                              </tr>
                            ))}
                            {excelPreview.pages.length > 5 && <tr><td colSpan={2} style={{ padding: '5px 10px', color: '#9ca3af', textAlign: 'center' }}>... +{excelPreview.pages.length - 5} more</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {excelPreview.queries.length > 0 && (
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed', marginBottom: '6px' }}>Preview: Query Citations ({excelPreview.queries.length} queries)</div>
                      <div style={{ maxHeight: '100px', overflowY: 'auto', border: '1px solid rgba(44,36,25,0.08)', borderRadius: '8px', fontSize: '11px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead><tr style={{ background: 'rgba(124,58,237,0.04)' }}>{['Query', 'Citations'].map(h => <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Query' ? 'left' : 'center', fontWeight: 600, color: '#5c5850' }}>{h}</th>)}</tr></thead>
                          <tbody>
                            {excelPreview.queries.slice(0, 5).map((r, i) => (
                              <tr key={i} style={{ borderTop: '1px solid rgba(44,36,25,0.05)' }}>
                                <td style={{ padding: '5px 10px', color: '#2c2419' }}>{r.queryText}</td>
                                <td style={{ padding: '5px 10px', textAlign: 'center', fontWeight: 600, color: '#7c3aed' }}>{r.citations}</td>
                              </tr>
                            ))}
                            {excelPreview.queries.length > 5 && <tr><td colSpan={2} style={{ padding: '5px 10px', color: '#9ca3af', textAlign: 'center' }}>... +{excelPreview.queries.length - 5} more</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: '12px', color: '#5c5850', padding: '10px 14px', background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.12)', borderRadius: '8px', marginBottom: '18px' }}>
                    <strong style={{ color: '#7c3aed' }}>How to export from BWT:</strong> Go to Bing Webmaster Tools → AI section → select date range → copy data. Paste tab-separated rows below.
                  </div>
                  {[
                    { label: 'Daily Citations', key: 'raw', value: importRaw, setter: setImportRaw, placeholder: '11/27/2025 12:00:00 AM\t63\t12\n11/28/2025 12:00:00 AM\t71\t14', hint: 'Paste rows: Date · Citations · Cited Pages' },
                    { label: 'Page Citations', key: 'page', value: importPageRaw, setter: setImportPageRaw, placeholder: 'https://example.com/page-one\t2070\nhttps://example.com/page-two\t840', hint: 'Paste rows: Page URL · Citations' },
                    { label: 'Query Citations', key: 'query', value: importQueryRaw, setter: setImportQueryRaw, placeholder: 'chiropractor near me\t150\nbest chiropractor orange county\t89', hint: 'Paste rows: Query Text · Citations' },
                  ].map(({ label, value, setter, placeholder, hint }) => (
                    <div key={label} style={{ marginBottom: '16px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#5c5850', display: 'block', marginBottom: '4px' }}>{label}</label>
                      <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 6px 0' }}>{hint}</p>
                      <textarea value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} rows={4}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(44,36,25,0.15)', fontSize: '12px', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </>
              )}

              {importMsg && (
                <div style={{ fontSize: '12px', padding: '8px 12px', borderRadius: '7px', marginBottom: '14px',
                  background: importMsg.startsWith('Error') || importMsg.startsWith('Could not') ? 'rgba(239,68,68,0.08)' : importMsg.startsWith('Found') ? 'rgba(124,58,237,0.06)' : 'rgba(16,185,129,0.08)',
                  color: importMsg.startsWith('Error') || importMsg.startsWith('Could not') ? '#dc2626' : importMsg.startsWith('Found') ? '#7c3aed' : '#059669',
                  border: `1px solid ${importMsg.startsWith('Error') || importMsg.startsWith('Could not') ? 'rgba(239,68,68,0.2)' : importMsg.startsWith('Found') ? 'rgba(124,58,237,0.15)' : 'rgba(16,185,129,0.2)'}` }}>
                  {importMsg}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowImport(false)} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid rgba(44,36,25,0.15)', background: 'transparent', color: '#5c5850', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>Cancel</button>
                <button onClick={handleImport}
                  disabled={importing || (importMode === 'excel' && excelPreview.daily.length === 0 && excelPreview.pages.length === 0 && excelPreview.queries.length === 0)}
                  style={{ padding: '9px 20px', borderRadius: '8px', background: importing ? '#a78bfa' : '#7c3aed', color: '#fff', border: 'none',
                    cursor: importing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600,
                    opacity: (importMode === 'excel' && excelPreview.daily.length === 0 && excelPreview.pages.length === 0 && excelPreview.queries.length === 0) ? 0.5 : 1 }}>
                  {importing ? 'Saving…' : 'Save to Database'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── LOADING ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px', color: '#9ca3af', fontSize: '14px' }}>
            <div style={{ width: 36, height: 36, border: '3px solid rgba(124,58,237,0.15)', borderTop: '3px solid #7c3aed', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
            Loading AI data…
          </div>
        ) : !hasData ? (

          /* ── EMPTY STATE ── */
          <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(44,36,25,0.08)', borderRadius: '24px', padding: '72px 40px', textAlign: 'center', boxShadow: '0 4px 24px rgba(44,36,25,0.06)' }}>
            <div style={{ width: 64, height: 64, borderRadius: '20px', background: 'rgba(124,58,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Bot size={28} style={{ color: '#7c3aed' }} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#2c2419', marginBottom: '10px' }}>No AI citation data yet</h3>
            <p style={{ fontSize: '14px', color: '#9ca3af', maxWidth: '400px', margin: '0 auto 28px', lineHeight: '1.6' }}>
              AI assistants like Copilot, ChatGPT Browse, and Perplexity all pull from Bing&apos;s index. Import data from Bing Webmaster Tools to start tracking visibility.
            </p>
            {canImport && (
              <button onClick={() => setShowImport(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '14px', background: 'rgba(124,58,237,0.1)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.2)', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                <Upload size={15} /> Import AI Data
              </button>
            )}
          </div>

        ) : (
          <>
            {/* ── KPI CARDS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
              {[
                {
                  label: 'AI Citations',
                  value: fmtNum(totalCitations),
                  sub: selectedDays === 0 ? `${aiDaily.length} days tracked` : `last ${filteredDaily.length} days`,
                  color: '#7c3aed',
                  icon: <Bot size={18} style={{ color: '#7c3aed' }} />,
                },
                {
                  label: 'Avg Per Day',
                  value: fmtNum(avgCitationsPerDay),
                  sub: 'daily citations average',
                  color: '#7c3aed',
                  icon: <TrendingUp size={18} style={{ color: '#7c3aed' }} />,
                },
                {
                  label: 'Cited Pages',
                  value: fmtNum(aiPages.length),
                  sub: 'unique pages referenced',
                  color: '#7c3aed',
                  icon: <FileSpreadsheet size={18} style={{ color: '#7c3aed' }} />,
                },
                {
                  label: 'AI Queries',
                  value: fmtNum(aiQueries.length),
                  sub: 'search terms tracked',
                  color: '#7c3aed',
                  icon: <Search size={18} style={{ color: '#7c3aed' }} />,
                },
              ].map(card => (
                <div key={card.label}
                  style={{
                    background: 'rgba(255,255,255,0.9)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(44,36,25,0.1)',
                    borderRadius: '16px',
                    padding: '20px',
                    boxShadow: '0 4px 20px rgba(44,36,25,0.08)',
                    transition: 'all 0.2s ease',
                    cursor: 'default',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(44,36,25,0.12)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(44,36,25,0.08)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c5850', margin: 0 }}>{card.label}</p>
                    <div style={{ width: 32, height: 32, borderRadius: '10px', background: 'rgba(124,58,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {card.icon}
                    </div>
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: 800, color: card.color, marginBottom: '6px', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                    {card.value}
                  </div>
                  <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>{card.sub}</p>
                  {card.label === 'AI Citations' && peakDay.citations > 0 && (
                    <p style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600, margin: '6px 0 0 0' }}>
                      Peak: {fmtNum(peakDay.citations)} on {fmtDate(peakDay.date)}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* ── TREND CHART ── */}
            {filteredDaily.length > 1 && (
              <div style={{
                background: 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(44,36,25,0.1)',
                borderRadius: '24px',
                padding: '24px',
                marginBottom: '24px',
                boxShadow: '0 4px 20px rgba(44,36,25,0.08)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', margin: '0 0 4px 0' }}>AI Citations Trend</p>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#2c2419', margin: 0, letterSpacing: '-0.01em' }}>
                      How Often AI Assistants Cite Your Website
                    </h3>
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                    {fmtDateLong(filteredDaily[0].date)} — {fmtDateLong(filteredDaily[filteredDaily.length - 1].date)}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={filteredDaily} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="citGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.01} />
                      </linearGradient>
                      <linearGradient id="pagesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(44,36,25,0.06)" />
                    <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip
                      contentStyle={{ fontSize: '12px', borderRadius: '10px', border: '1px solid rgba(44,36,25,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                      labelFormatter={fmtDateLong}
                      formatter={(v: any, name: string) => [fmtNum(v), name === 'citations' ? 'Citations' : 'Cited Pages']}
                    />
                    <Area type="monotone" dataKey="citations" name="citations" stroke="#7c3aed" strokeWidth={2.5} fill="url(#citGrad)" dot={false} activeDot={{ r: 5, fill: '#7c3aed' }} />
                    <Area type="monotone" dataKey="cited_pages" name="cited_pages" stroke="#a78bfa" strokeWidth={1.5} fill="url(#pagesGrad)" dot={false} strokeDasharray="5 3" />
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: '20px', marginTop: '12px', fontSize: '11px', color: '#9ca3af' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 16, height: 2.5, background: '#7c3aed', display: 'inline-block', borderRadius: 2 }} />
                    Total Citations
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 16, height: 2, background: '#a78bfa', display: 'inline-block', borderRadius: 2, borderBottom: '2px dashed #a78bfa' }} />
                    Pages Cited
                  </span>
                </div>
              </div>
            )}

            {/* ── QUERIES + PAGES GRID ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>

              {/* AI Search Queries */}
              <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', margin: '0 0 4px 0' }}>AI Search Queries</p>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#2c2419', margin: 0, letterSpacing: '-0.01em' }}>What Patients Ask AI Assistants</h3>
                </div>
                {aiQueries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af', fontSize: '13px' }}>
                    No query data — use <strong>Import AI Data</strong> to add search queries.
                  </div>
                ) : (
                  <>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(44,36,25,0.08)' }}>
                          <th style={{ padding: '0 8px 10px 0', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af' }}>Query</th>
                          <th style={{ padding: '0 0 10px 8px', textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', whiteSpace: 'nowrap' }}>Citations</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiQueries.slice(0, 15).map((r, i) => {
                          const maxCit = aiQueries[0]?.citations || 1;
                          const pct = Math.round((r.citations / maxCit) * 100);
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(44,36,25,0.05)' }}>
                              <td style={{ padding: '10px 8px 10px 0' }}>
                                <div style={{ fontSize: '12px', color: '#2c2419', marginBottom: '4px', lineHeight: 1.3 }}>{r.query_text}</div>
                                <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(44,36,25,0.06)', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #7c3aed, #a78bfa)', borderRadius: '2px' }} />
                                </div>
                              </td>
                              <td style={{ padding: '10px 0 10px 8px', textAlign: 'center' }}>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#7c3aed' }}>{fmtNum(r.citations)}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {aiQueries.length > 15 && (
                      <p style={{ fontSize: '11px', color: '#9ca3af', margin: '12px 0 0 0', textAlign: 'center' }}>
                        +{aiQueries.length - 15} more queries
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* AI-Cited Pages */}
              <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(44,36,25,0.1)', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(44,36,25,0.08)' }}>
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', margin: '0 0 4px 0' }}>AI-Cited Pages</p>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#2c2419', margin: 0, letterSpacing: '-0.01em' }}>Pages AI Recommends Most</h3>
                </div>
                {aiPages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af', fontSize: '13px' }}>
                    No page data — use <strong>Import AI Data</strong> to add page-level citations.
                  </div>
                ) : (
                  <>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(44,36,25,0.08)' }}>
                          <th style={{ padding: '0 8px 10px 0', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af' }}>Page</th>
                          <th style={{ padding: '0 0 10px 8px', textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', whiteSpace: 'nowrap' }}>Citations</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiPages.map((r, i) => {
                          const maxCit = aiPages[0]?.citations || 1;
                          const pct = Math.round((r.citations / maxCit) * 100);
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(44,36,25,0.05)' }}>
                              <td style={{ padding: '10px 8px 10px 0' }}>
                                <a href={r.page_url} target="_blank" rel="noreferrer"
                                  style={{ fontSize: '12px', color: '#7c3aed', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px', marginBottom: '4px' }}>
                                  {shortUrl(r.page_url)}
                                </a>
                                <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(44,36,25,0.06)', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #7c3aed, #a78bfa)', borderRadius: '2px' }} />
                                </div>
                              </td>
                              <td style={{ padding: '10px 0 10px 8px', textAlign: 'center' }}>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#7c3aed' }}>{fmtNum(r.citations)}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>

            {/* ── KEY INSIGHT ── */}
            {totalCitations > 0 && (
              <div style={{
                background: 'rgba(124,58,237,0.04)',
                border: '1px solid rgba(124,58,237,0.12)',
                borderRadius: '16px',
                padding: '20px 24px',
                display: 'flex', alignItems: 'flex-start', gap: '14px',
              }}>
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                  <Zap size={16} style={{ color: '#7c3aed' }} />
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#2c2419', margin: '0 0 4px 0' }}>Why This Matters</p>
                  <p style={{ fontSize: '13px', color: '#5c5850', margin: 0, lineHeight: '1.6' }}>
                    Microsoft Copilot, ChatGPT Browse, and Perplexity all use Bing&apos;s index as their primary data source.
                    Every AI citation means a patient asking an AI assistant about chiropractors saw your website recommended.
                    {aiPages.length > 0 && ` Your most cited page — "${shortUrl(aiPages[0].page_url)}" — has been referenced ${fmtNum(aiPages[0].citations)} times.`}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
