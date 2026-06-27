import express from 'express';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import YahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 5178);
const yahooFinance = new YahooFinance();
const casesRoot = path.join(__dirname, 'cases');

app.use(express.json({ limit: '1mb' }));

const nowIso = () => new Date().toISOString();

const slugify = (value) => {
  const slug = String(value || 'case')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'case';
};

const normalizeFolderPath = (folderPath = '') => {
  const normalized = String(folderPath || '')
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.replace(/[^a-zA-Z0-9 ._-]/g, '-').replace(/^\.+$/g, '').trim())
    .filter(Boolean)
    .join('/');

  const resolved = path.resolve(casesRoot, normalized);
  if (!resolved.startsWith(path.resolve(casesRoot))) {
    throw new Error('Invalid folder path.');
  }
  return normalized;
};

const resolveCaseDir = (folderPath = '') => path.join(casesRoot, normalizeFolderPath(folderPath));

const getCaseFilePath = (caseRecord) => {
  const folderPath = normalizeFolderPath(caseRecord.folderPath || '');
  const fileName = caseRecord.fileName || `${slugify(caseRecord.name)}-${caseRecord.id}.json`;
  return path.join(resolveCaseDir(folderPath), fileName);
};

const readJsonFile = async (filePath) => JSON.parse(await fsp.readFile(filePath, 'utf8'));

const writeJsonFile = async (filePath, data) => {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
};

const walkCases = async (dir = casesRoot, folderPath = '') => {
  await fsp.mkdir(dir, { recursive: true });
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const folders = [];
  const cases = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const entryPath = path.join(dir, entry.name);
    const relativePath = folderPath ? `${folderPath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const child = await walkCases(entryPath, relativePath);
      folders.push({ path: relativePath, name: entry.name, caseCount: child.cases.length }, ...child.folders);
      cases.push(...child.cases);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

    try {
      const caseRecord = await readJsonFile(entryPath);
      if (!caseRecord.id) continue;
      cases.push({
        ...caseRecord,
        folderPath,
        fileName: entry.name
      });
    } catch {
      // Ignore malformed case files so one bad file does not break the case browser.
    }
  }

  return {
    folders: folders.sort((a, b) => a.path.localeCompare(b.path)),
    cases: cases.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
  };
};

const findCaseById = async (id) => {
  const tree = await walkCases();
  const caseRecord = tree.cases.find((item) => item.id === id);
  if (!caseRecord) return null;
  return {
    caseRecord,
    filePath: getCaseFilePath(caseRecord)
  };
};

const publicCase = (caseRecord) => ({
  id: caseRecord.id,
  name: caseRecord.name,
  folderPath: caseRecord.folderPath || '',
  symbol: caseRecord.inputs?.symbol || '',
  companyName: caseRecord.inputs?.companyName || '',
  inputs: caseRecord.inputs || {},
  createdAt: caseRecord.createdAt,
  updatedAt: caseRecord.updatedAt
});

const readNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'object' && 'raw' in value) return readNumber(value.raw);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const firstNumber = (...values) => {
  for (const value of values) {
    const parsed = readNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const toMillions = (value) => (value === null || value === undefined ? null : value / 1_000_000);

const readMarketNumber = (value) => {
  if (typeof value !== 'string') return readNumber(value);
  const normalized = value.replace(/[$,%\s]/g, '').replace(/,/g, '');
  if (!normalized || normalized.toUpperCase() === 'N/A' || normalized.toUpperCase() === 'NA') return null;
  return readNumber(normalized);
};

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json, text/plain, */*',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
    }
  });
  if (!response.ok) return null;
  return response.json();
};

const fetchNasdaqQuote = async (symbol) => {
  const infoUrl = new URL(`https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/info`);
  infoUrl.searchParams.set('assetclass', 'stocks');
  const summaryUrl = new URL(`https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/summary`);
  summaryUrl.searchParams.set('assetclass', 'stocks');

  const [info, summary] = await Promise.all([fetchJson(infoUrl), fetchJson(summaryUrl).catch(() => null)]);
  const quote = info?.data;
  const primary = quote?.primaryData || {};
  const summaryData = summary?.data?.summaryData || {};
  const price = readMarketNumber(primary.lastSalePrice);
  const marketCap = readMarketNumber(summaryData.MarketCap?.value);

  if (!quote || !price) return null;

  return {
    symbol: quote.symbol || symbol,
    shortName: quote.companyName || quote.symbol || symbol,
    currency: primary.currency || 'USD',
    source: 'Nasdaq',
    metrics: {
      price,
      marketCap: toMillions(marketCap),
      shares: marketCap && price ? toMillions(marketCap / price) : null
    }
  };
};

const fetchAlphaQuote = async (symbol) => {
  const apiKey = process.env.ALPHAVANTAGE_API_KEY || 'demo';
  const url = new URL('https://www.alphavantage.co/query');
  url.searchParams.set('function', 'GLOBAL_QUOTE');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('apikey', apiKey);

  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  const quote = data['Global Quote'];
  if (!quote || !quote['05. price']) return null;

  return {
    symbol: quote['01. symbol'] || symbol,
    shortName: quote['01. symbol'] || symbol,
    currency: 'USD',
    source: apiKey === 'demo' ? 'Alpha Vantage demo' : 'Alpha Vantage',
    metrics: {
      price: readNumber(quote['05. price'])
    }
  };
};

const fetchYahooQuote = async (symbol) => {
  const quote = await yahooFinance.quote(symbol);
  if (!quote) return null;

  return {
    symbol,
    shortName: quote.shortName || quote.longName || symbol,
    currency: quote.currency || 'USD',
    source: 'Yahoo Finance',
    metrics: {
      price: firstNumber(quote.regularMarketPrice),
      marketCap: toMillions(firstNumber(quote.marketCap)),
      shares: toMillions(firstNumber(quote.sharesOutstanding)),
      trailingEps: firstNumber(quote.epsTrailingTwelveMonths),
      forwardEps: firstNumber(quote.epsForward),
      trailingPe: firstNumber(quote.trailingPE),
      forwardPe: firstNumber(quote.forwardPE)
    }
  };
};

app.get('/api/cases', async (_req, res) => {
  try {
    const tree = await walkCases();
    res.json({
      folders: tree.folders,
      cases: tree.cases.map(publicCase)
    });
  } catch (error) {
    res.status(500).json({ error: 'Could not read cases.' });
  }
});

app.post('/api/folders', async (req, res) => {
  const name = String(req.body?.name || '').trim();

  if (!name) {
    res.status(400).json({ error: 'Folder name is required.' });
    return;
  }

  try {
    const parentPath = normalizeFolderPath(req.body?.parentPath || '');
    const folderPath = normalizeFolderPath(parentPath ? `${parentPath}/${name}` : name);
    await fsp.mkdir(resolveCaseDir(folderPath), { recursive: true });
    const tree = await walkCases();
    res.status(201).json({
      folder: tree.folders.find((item) => item.path === folderPath) || { path: folderPath, name: path.basename(folderPath), caseCount: 0 },
      folders: tree.folders
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Could not create folder.' });
  }
});

app.post('/api/cases', async (req, res) => {
  try {
    const createdAt = nowIso();
    const inputs = req.body?.inputs && typeof req.body.inputs === 'object' ? req.body.inputs : {};
    const name = String(req.body?.name || inputs.companyName || inputs.symbol || 'Untitled Case').trim();
    const folderPath = normalizeFolderPath(req.body?.folderPath || '');
    const id = randomUUID();
    const caseRecord = {
      id,
      name,
      folderPath,
      fileName: `${slugify(name)}-${id}.json`,
      inputs,
      createdAt,
      updatedAt: createdAt
    };

    await writeJsonFile(getCaseFilePath(caseRecord), caseRecord);
    res.status(201).json({ case: publicCase(caseRecord) });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Could not create case.' });
  }
});

app.get('/api/cases/:id', async (req, res) => {
  const found = await findCaseById(req.params.id);
  if (!found) {
    res.status(404).json({ error: 'Case not found.' });
    return;
  }

  res.json({ case: publicCase(found.caseRecord) });
});

app.patch('/api/cases/:id', async (req, res) => {
  try {
    const found = await findCaseById(req.params.id);
    if (!found) {
      res.status(404).json({ error: 'Case not found.' });
      return;
    }

    const nextFolderPath =
      req.body && Object.prototype.hasOwnProperty.call(req.body, 'folderPath')
        ? normalizeFolderPath(req.body.folderPath || '')
        : found.caseRecord.folderPath || '';
    const nextRecord = {
      ...found.caseRecord,
      name: req.body?.name ? String(req.body.name).trim() : found.caseRecord.name,
      folderPath: nextFolderPath,
      inputs: req.body?.inputs && typeof req.body.inputs === 'object' ? req.body.inputs : found.caseRecord.inputs,
      updatedAt: nowIso()
    };

    const nextFilePath = getCaseFilePath(nextRecord);
    await writeJsonFile(nextFilePath, nextRecord);
    if (path.resolve(found.filePath) !== path.resolve(nextFilePath)) {
      await fsp.rm(found.filePath, { force: true });
    }

    res.json({ case: publicCase(nextRecord) });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Could not update case.' });
  }
});

app.get('/api/stock/:symbol', async (req, res) => {
  const symbol = String(req.params.symbol || '').trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,12}$/.test(symbol)) {
    res.status(400).json({ error: 'Enter a valid ticker symbol.' });
    return;
  }

  try {
    const nasdaqQuote = await fetchNasdaqQuote(symbol).catch(() => null);
    const alphaQuote = nasdaqQuote?.metrics?.price ? null : await fetchAlphaQuote(symbol).catch(() => null);
    const yahooQuote =
      nasdaqQuote?.metrics?.price || alphaQuote?.metrics?.price
        ? null
        : await fetchYahooQuote(symbol).catch(() => null);
    const payload = nasdaqQuote || alphaQuote || yahooQuote;

    if (!payload?.metrics?.price) {
      res.status(502).json({
        error: 'Live quote unavailable right now. Enter the current price and assumptions manually.'
      });
      return;
    }

    res.json({
      symbol: payload.symbol,
      shortName: payload.shortName,
      currency: payload.currency,
      source: payload.source,
      asOf: new Date().toISOString(),
      metrics: {
        price: payload.metrics.price,
        marketCap: payload.metrics.marketCap ?? null,
        shares: payload.metrics.shares ?? null,
        cash: payload.metrics.cash ?? null,
        debt: payload.metrics.debt ?? null,
        cfo: payload.metrics.cfo ?? null,
        capex: payload.metrics.capex ?? null,
        revenue: payload.metrics.revenue ?? null,
        trailingEps: payload.metrics.trailingEps ?? null,
        forwardEps: payload.metrics.forwardEps ?? null,
        trailingPe: payload.metrics.trailingPe ?? null,
        forwardPe: payload.metrics.forwardPe ?? null,
        operatingMargin: payload.metrics.operatingMargin ?? null
      }
    });
  } catch (error) {
    res.status(502).json({
      error: 'Live quote unavailable right now. Enter the current price and assumptions manually.'
    });
  }
});

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Stock valuation API running on http://localhost:${port}`);
});
