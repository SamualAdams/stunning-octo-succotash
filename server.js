import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 5178);
const yahooFinance = new YahooFinance();

app.use(express.json());

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

app.get('/api/stock/:symbol', async (req, res) => {
  const symbol = String(req.params.symbol || '').trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,12}$/.test(symbol)) {
    res.status(400).json({ error: 'Enter a valid ticker symbol.' });
    return;
  }

  try {
    const alphaQuote = await fetchAlphaQuote(symbol).catch(() => null);
    const yahooQuote = alphaQuote?.metrics?.price ? null : await fetchYahooQuote(symbol).catch(() => null);
    const payload = alphaQuote || yahooQuote;

    if (!payload?.metrics?.price) {
      res.status(502).json({
        error:
          'Live quote unavailable. Add ALPHAVANTAGE_API_KEY for broader lookup coverage or enter assumptions manually.'
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
      error:
        'Live quote unavailable. Add ALPHAVANTAGE_API_KEY for broader lookup coverage or enter assumptions manually.'
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
