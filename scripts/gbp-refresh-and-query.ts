const REFRESH_TOKEN = process.env.GBP_REFRESH_TOKEN!;
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;

const LOCATIONS: Record<string, string> = {
  "Abundant Life Clinic":               "locations/13927776164287369865",
  "Chiropractic Care Centre":           "locations/2183436203472747388",
  "Chiropractic First":                 "locations/14672265684066117589",
  "Chiropractic Health Club":           "locations/9084407976938333791",
  "ChiroSolutions Center":              "locations/977715680597647914",
  "CorePosture":                        "locations/1203151849529238982",
  "DeCarlo Chiropractic":              "locations/17196030318038468635",
  "Haven Chiropractic":                 "locations/4177968893017380483",
  "Healing Hands of Manahawkin":        "locations/7133803159369709570",
  "Hood Chiropractic":                  "locations/12570443580620511972",
  "Newport Center Family Chiropractic": "locations/15767825285937852276",
  "Ray Chiropractic":                   "locations/9578599803467668273",
  "Restoration Dental":                 "locations/8747587443047417718",
  "Rigel & Rigel":                      "locations/16439395396892535443",
  "Southport Chiropractic":             "locations/12632679338477188465",
  "Tails Animal Chiropractic Care":     "locations/2547679015846269125",
  "Tinker Family Chiro":                "locations/257366561921662057",
  "Whole Body Wellness":                "locations/10331062708807756101",
  "Whole Family Chiropractic":          "locations/8330381170885588872",
};

async function refreshToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(json)}`);
  console.log(`[GBP] Token refreshed OK`);
  return json.access_token;
}

async function fetchPhoneCalls(token: string, locationId: string, startDate: string, endDate: string): Promise<Record<string, number>> {
  const [sY, sM, sD] = startDate.split('-').map(Number);
  const [eY, eM, eD] = endDate.split('-').map(Number);
  const url = new URL(`https://businessprofileperformance.googleapis.com/v1/${locationId}:getDailyMetricsTimeSeries`);
  url.searchParams.set('dailyMetric', 'CALL_CLICKS');
  url.searchParams.set('dailyRange.start_date.year', String(sY));
  url.searchParams.set('dailyRange.start_date.month', String(sM));
  url.searchParams.set('dailyRange.start_date.day', String(sD));
  url.searchParams.set('dailyRange.end_date.year', String(eY));
  url.searchParams.set('dailyRange.end_date.month', String(eM));
  url.searchParams.set('dailyRange.end_date.day', String(eD));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status}: ${err.slice(0, 150)}`);
  }
  const json = await res.json();
  const result: Record<string, number> = {};
  const datedValues = json.timeSeries?.datedValues || [];
  for (const item of datedValues) {
    const d = item.date;
    const dateStr = `${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`;
    result[dateStr] = parseInt(item.value || '0', 10);
  }
  return result;
}

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) { console.error('Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET'); process.exit(1); }
  const token = await refreshToken();

  const aprDays = Array.from({length:10},(_,i)=>`2026-04-${String(i+1).padStart(2,'0')}`);
  const mayDays = Array.from({length:10},(_,i)=>`2026-05-${String(i+1).padStart(2,'0')}`);

  const results: { name: string; apr: Record<string,number>; may: Record<string,number>; error?: string }[] = [];

  for (const [name, locationId] of Object.entries(LOCATIONS)) {
    try {
      const [apr, may] = await Promise.all([
        fetchPhoneCalls(token, locationId, '2026-04-01', '2026-04-10'),
        fetchPhoneCalls(token, locationId, '2026-05-01', '2026-05-10'),
      ]);
      results.push({ name, apr, may });
      process.stdout.write('.');
    } catch (e: any) {
      results.push({ name, apr:{}, may:{}, error: e.message.slice(0,80) });
      process.stdout.write('x');
    }
    await new Promise(r => setTimeout(r, 300));
  }
  console.log('\n');

  const rows = results.map(r => ({
    ...r,
    aprTotal: aprDays.reduce((s,d)=>s+(r.apr[d]||0),0),
    mayTotal: mayDays.reduce((s,d)=>s+(r.may[d]||0),0),
  })).sort((a,b)=>b.aprTotal-a.aprTotal);

  console.log('=== GBP API (LIVE) — Phone Calls: Apr 1-10 vs May 1-10, 2026 ===\n');
  console.log('Client                             | Apr 1-10 | May 1-10 | Diff   |  %');
  console.log('-----------------------------------|----------|----------|--------|-----');
  let tA=0, tM=0;
  for (const r of rows) {
    if (r.error) { console.log(`${r.name.slice(0,34).padEnd(34)} | ERROR: ${r.error}`); continue; }
    const diff = r.mayTotal - r.aprTotal;
    const pct = r.aprTotal>0 ? `${diff>=0?'+':''}${((diff/r.aprTotal)*100).toFixed(0)}%` : 'N/A';
    console.log(`${r.name.slice(0,34).padEnd(34)} | ${String(r.aprTotal).padStart(8)} | ${String(r.mayTotal).padStart(8)} | ${diff>=0?'▲':'▼'}${String(Math.abs(diff)).padStart(5)} | ${pct}`);
    tA+=r.aprTotal; tM+=r.mayTotal;
  }
  const td=tM-tA;
  console.log('-----------------------------------|----------|----------|--------|-----');
  console.log(`${'TOTAL'.padEnd(34)} | ${String(tA).padStart(8)} | ${String(tM).padStart(8)} | ${td>=0?'▲':'▼'}${String(Math.abs(td)).padStart(5)} | ${tA>0?`${td>=0?'+':''}${((td/tA)*100).toFixed(0)}%`:'N/A'}`);

  console.log('\n=== APR 1-10 (GBP API raw) ===\n');
  console.log(`${'Client'.padEnd(34)} |${aprDays.map(d=>d.slice(5).padStart(6)).join('|')}| Tot`);
  console.log('-'.repeat(112));
  for (const r of rows) {
    if (r.error) continue;
    console.log(`${r.name.slice(0,34).padEnd(34)} |${aprDays.map(d=>String(r.apr[d]??'-').padStart(6)).join('|')}|${String(r.aprTotal).padStart(4)}`);
  }

  console.log('\n=== MAY 1-10 (GBP API raw) ===\n');
  console.log(`${'Client'.padEnd(34)} |${mayDays.map(d=>d.slice(5).padStart(6)).join('|')}| Tot`);
  console.log('-'.repeat(112));
  for (const r of rows) {
    if (r.error) continue;
    console.log(`${r.name.slice(0,34).padEnd(34)} |${mayDays.map(d=>String(r.may[d]??'-').padStart(6)).join('|')}|${String(r.mayTotal).padStart(4)}`);
  }
}

main().catch(console.error);
