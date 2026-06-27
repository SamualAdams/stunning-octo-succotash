import { useMemo, useState } from 'react';
import {
  BarChart3,
  Calculator,
  Download,
  Landmark,
  RefreshCw,
  Search,
  ShieldCheck,
  Sigma,
  SlidersHorizontal,
  TrendingUp
} from 'lucide-react';

const DEFAULT_INPUTS = {
  symbol: 'MSFT',
  companyName: 'Microsoft',
  price: 420,
  shares: 7430,
  cash: 80000,
  debt: 97000,
  cfo: 118000,
  capex: 44000,
  revenue: 245000,
  trailingEps: 11.8,
  forwardEps: 13.4,
  historicalPe: 28,
  peerPes: '24, 27, 31',
  treasuryYield: 4.2,
  riskPremium: 3,
  fcfGrowth: 7,
  terminalGrowth: 2.5,
  exitMultiple: 22,
  terminalMethod: 'perpetuity',
  dcfYears: 10,
  salesGrowth: 6,
  operatingMargin: 44,
  interestExpense: 1200,
  taxRate: 18,
  buybackRate: 1,
  payoutRatio: 28,
  exitPe: 25,
  projectionYears: 5,
  marginRequired: 20
};

const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2
});

const compactMoneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 1
});

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1
});

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const asDecimal = (value) => toNumber(value) / 100;

const isFiniteNumber = (value) => Number.isFinite(value);

const average = (values) => {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((total, value) => total + value, 0) / valid.length;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parsePeers = (value) =>
  String(value)
    .split(/[\s,;]+/)
    .map((item) => Number.parseFloat(item))
    .filter((item) => Number.isFinite(item) && item > 0);

const formatMoney = (value) => (Number.isFinite(value) ? moneyFormatter.format(value) : 'n/a');
const formatCompactMoney = (millions) =>
  Number.isFinite(millions) ? compactMoneyFormatter.format(millions * 1_000_000) : 'n/a';
const formatPercent = (value) => (Number.isFinite(value) ? percentFormatter.format(value) : 'n/a');
const formatMultiple = (value) => (Number.isFinite(value) ? `${numberFormatter.format(value)}x` : 'n/a');
const formatNumber = (value) => (Number.isFinite(value) ? numberFormatter.format(value) : 'n/a');

function calculateValuations(inputs) {
  const price = toNumber(inputs.price);
  const shares = Math.max(toNumber(inputs.shares), 0);
  const forwardEps = toNumber(inputs.forwardEps);
  const trailingEps = toNumber(inputs.trailingEps);
  const peerAveragePe = average(parsePeers(inputs.peerPes));
  const historicalPe = toNumber(inputs.historicalPe);
  const trailingPe = trailingEps > 0 ? price / trailingEps : null;
  const forwardPe = forwardEps > 0 ? price / forwardEps : null;
  const peerTarget = forwardEps > 0 && peerAveragePe ? forwardEps * peerAveragePe : null;
  const historyTarget = forwardEps > 0 && historicalPe > 0 ? forwardEps * historicalPe : null;
  const relativeValue = average([peerTarget, historyTarget]);

  const cfo = toNumber(inputs.cfo);
  const capex = Math.abs(toNumber(inputs.capex));
  const cash = toNumber(inputs.cash);
  const debt = toNumber(inputs.debt);
  const fcfBase = cfo - capex;
  const discountRate = Math.max(asDecimal(inputs.treasuryYield) + asDecimal(inputs.riskPremium), 0.001);
  const fcfGrowth = asDecimal(inputs.fcfGrowth);
  const terminalGrowth = asDecimal(inputs.terminalGrowth);
  const dcfYears = clamp(Math.round(toNumber(inputs.dcfYears)), 1, 20);
  const exitMultiple = Math.max(toNumber(inputs.exitMultiple), 0);

  const dcfRows = [];
  let pvCashFlows = 0;
  let finalFcf = fcfBase;
  for (let year = 1; year <= dcfYears; year += 1) {
    const fcf = fcfBase * (1 + fcfGrowth) ** year;
    const pv = fcf / (1 + discountRate) ** year;
    finalFcf = fcf;
    pvCashFlows += pv;
    dcfRows.push({ year, fcf, pv });
  }

  const terminalValue =
    inputs.terminalMethod === 'exit'
      ? finalFcf * exitMultiple
      : discountRate > terminalGrowth
        ? (finalFcf * (1 + terminalGrowth)) / (discountRate - terminalGrowth)
        : null;
  const pvTerminal = terminalValue === null ? null : terminalValue / (1 + discountRate) ** dcfYears;
  const enterpriseValue = pvTerminal === null ? null : pvCashFlows + pvTerminal;
  const equityValue = enterpriseValue === null ? null : enterpriseValue + cash - debt;
  const dcfValue = equityValue !== null && shares > 0 ? equityValue / shares : null;

  const revenueStart = toNumber(inputs.revenue);
  const salesGrowth = asDecimal(inputs.salesGrowth);
  const operatingMargin = asDecimal(inputs.operatingMargin);
  const interestExpense = toNumber(inputs.interestExpense);
  const taxRate = clamp(asDecimal(inputs.taxRate), 0, 0.8);
  const buybackRate = clamp(asDecimal(inputs.buybackRate), -0.25, 0.25);
  const payoutRatio = clamp(asDecimal(inputs.payoutRatio), 0, 1);
  const exitPe = Math.max(toNumber(inputs.exitPe), 0);
  const projectionYears = clamp(Math.round(toNumber(inputs.projectionYears)), 1, 15);

  const growthRows = [];
  let revenue = revenueStart;
  let projectedShares = shares;
  let totalDividends = 0;
  for (let year = 1; year <= projectionYears; year += 1) {
    revenue *= 1 + salesGrowth;
    projectedShares *= 1 - buybackRate;
    const operatingIncome = revenue * operatingMargin;
    const pretaxIncome = operatingIncome - interestExpense;
    const netIncome = pretaxIncome * (1 - taxRate);
    const eps = projectedShares > 0 ? netIncome / projectedShares : 0;
    const dividend = Math.max(eps * payoutRatio, 0);
    totalDividends += dividend;
    growthRows.push({ year, revenue, shares: projectedShares, eps, dividend });
  }

  const terminalEps = growthRows.at(-1)?.eps || 0;
  const futurePrice = terminalEps * exitPe;
  const futureValue = futurePrice + totalDividends;
  const expectedCagr = price > 0 && futureValue > 0 ? futureValue ** (1 / projectionYears) / price ** (1 / projectionYears) - 1 : null;
  const growthPresentValue = futureValue / (1 + discountRate) ** projectionYears;

  const modelValues = [
    { key: 'relative', label: 'Relative', value: relativeValue },
    { key: 'dcf', label: 'DCF', value: dcfValue },
    { key: 'growth', label: 'Growth', value: growthPresentValue }
  ].filter((item) => Number.isFinite(item.value));
  const triangulatedValue = average(modelValues.map((item) => item.value));
  const marginRequired = asDecimal(inputs.marginRequired);
  const buyBelow = triangulatedValue === null ? null : triangulatedValue * (1 - marginRequired);
  const currentMargin = triangulatedValue && triangulatedValue > 0 ? (triangulatedValue - price) / triangulatedValue : null;
  const modelSpread =
    modelValues.length > 1 && triangulatedValue
      ? (Math.max(...modelValues.map((item) => item.value)) - Math.min(...modelValues.map((item) => item.value))) / triangulatedValue
      : null;

  return {
    price,
    relative: {
      trailingPe,
      forwardPe,
      peerAveragePe,
      peerTarget,
      historyTarget,
      value: relativeValue,
      margin: relativeValue && relativeValue > 0 ? (relativeValue - price) / relativeValue : null
    },
    dcf: {
      rows: dcfRows,
      fcfBase,
      discountRate,
      terminalValue,
      pvTerminal,
      pvCashFlows,
      enterpriseValue,
      equityValue,
      value: dcfValue,
      margin: dcfValue && dcfValue > 0 ? (dcfValue - price) / dcfValue : null
    },
    growth: {
      rows: growthRows,
      totalDividends,
      futurePrice,
      futureValue,
      expectedCagr,
      presentValue: growthPresentValue,
      margin: growthPresentValue && growthPresentValue > 0 ? (growthPresentValue - price) / growthPresentValue : null
    },
    summary: {
      modelValues,
      triangulatedValue,
      buyBelow,
      currentMargin,
      modelSpread,
      marginRequired
    }
  };
}

function App() {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [status, setStatus] = useState({ type: 'idle', message: 'Manual assumptions loaded.' });
  const [isFetching, setIsFetching] = useState(false);
  const valuation = useMemo(() => calculateValuations(inputs), [inputs]);

  const updateInput = (key) => (event) => {
    setInputs((current) => ({ ...current, [key]: event.target.value }));
  };

  const setTerminalMethod = (terminalMethod) => {
    setInputs((current) => ({ ...current, terminalMethod }));
  };

  const fetchStock = async (event) => {
    event.preventDefault();
    const symbol = String(inputs.symbol || '').trim().toUpperCase();
    if (!symbol) return;

    setIsFetching(true);
    setStatus({ type: 'loading', message: `Fetching ${symbol}...` });
    try {
      const response = await fetch(`/api/stock/${encodeURIComponent(symbol)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Lookup failed.');

      const metric = payload.metrics || {};
      const patch = {};
      const assign = (key, value) => {
        if (Number.isFinite(value)) patch[key] = Number(value.toFixed(2));
      };

      assign('price', metric.price);
      assign('shares', metric.shares);
      assign('cash', metric.cash);
      assign('debt', metric.debt);
      assign('cfo', metric.cfo);
      assign('capex', metric.capex);
      assign('revenue', metric.revenue);
      assign('trailingEps', metric.trailingEps);
      assign('forwardEps', metric.forwardEps);
      assign('operatingMargin', metric.operatingMargin);
      if (Number.isFinite(metric.forwardPe)) patch.historicalPe = Number(metric.forwardPe.toFixed(2));

      setInputs((current) => ({
        ...current,
        ...patch,
        symbol: payload.symbol,
        companyName: payload.shortName || payload.symbol
      }));
      setStatus({
        type: 'success',
        message: `${payload.shortName || payload.symbol} updated at ${new Date(payload.asOf).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit'
        })}.`
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setIsFetching(false);
    }
  };

  const resetInputs = () => {
    setInputs(DEFAULT_INPUTS);
    setStatus({ type: 'idle', message: 'Manual assumptions loaded.' });
  };

  const downloadCase = () => {
    const blob = new Blob([JSON.stringify({ inputs, valuation }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${inputs.symbol || 'valuation'}-case.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Stock valuation</p>
          <h1>Valuation Workbench</h1>
        </div>
        <form className="tickerSearch" onSubmit={fetchStock}>
          <label htmlFor="symbol">Ticker</label>
          <input id="symbol" value={inputs.symbol} onChange={updateInput('symbol')} />
          <button type="submit" disabled={isFetching}>
            {isFetching ? <RefreshCw className="spin" size={18} /> : <Search size={18} />}
            <span>{isFetching ? 'Fetching' : 'Fetch'}</span>
          </button>
          <button type="button" className="iconButton" onClick={resetInputs} title="Reset assumptions" aria-label="Reset assumptions">
            <RefreshCw size={18} />
          </button>
          <button type="button" className="iconButton" onClick={downloadCase} title="Download valuation case" aria-label="Download valuation case">
            <Download size={18} />
          </button>
        </form>
      </header>

      <main className="workspace">
        <aside className="inputRail">
          <section className="toolPanel identityPanel">
            <div className="sectionTitle">
              <ShieldCheck size={18} />
              <h2>{inputs.companyName || inputs.symbol}</h2>
            </div>
            <div className={`statusPill ${status.type}`}>{status.message}</div>
            <div className="snapshotGrid">
              <Snapshot label="Price" value={formatMoney(valuation.price)} />
              <Snapshot label="Shares" value={`${formatNumber(toNumber(inputs.shares))}M`} />
              <Snapshot label="CFO" value={formatCompactMoney(toNumber(inputs.cfo))} />
              <Snapshot label="Capex" value={formatCompactMoney(toNumber(inputs.capex))} />
            </div>
          </section>

          <section className="toolPanel">
            <div className="sectionTitle">
              <BarChart3 size={18} />
              <h2>Relative P/E</h2>
            </div>
            <div className="fieldGrid two">
              <NumberField label="Price" value={inputs.price} onChange={updateInput('price')} prefix="$" />
              <NumberField label="Trailing EPS" value={inputs.trailingEps} onChange={updateInput('trailingEps')} prefix="$" />
              <NumberField label="Forward EPS" value={inputs.forwardEps} onChange={updateInput('forwardEps')} prefix="$" />
              <NumberField label="Historical P/E" value={inputs.historicalPe} onChange={updateInput('historicalPe')} suffix="x" />
            </div>
            <label className="textAreaField">
              <span>Peer P/E set</span>
              <textarea value={inputs.peerPes} onChange={updateInput('peerPes')} rows={3} />
            </label>
          </section>

          <section className="toolPanel">
            <div className="sectionTitle">
              <Calculator size={18} />
              <h2>DCF</h2>
            </div>
            <div className="fieldGrid two">
              <NumberField label="CFO" value={inputs.cfo} onChange={updateInput('cfo')} suffix="$M" />
              <NumberField label="Capex" value={inputs.capex} onChange={updateInput('capex')} suffix="$M" />
              <NumberField label="Cash" value={inputs.cash} onChange={updateInput('cash')} suffix="$M" />
              <NumberField label="Debt" value={inputs.debt} onChange={updateInput('debt')} suffix="$M" />
              <NumberField label="Treasury" value={inputs.treasuryYield} onChange={updateInput('treasuryYield')} suffix="%" />
              <NumberField label="Risk premium" value={inputs.riskPremium} onChange={updateInput('riskPremium')} suffix="%" />
              <NumberField label="FCF growth" value={inputs.fcfGrowth} onChange={updateInput('fcfGrowth')} suffix="%" />
              <NumberField label="Terminal growth" value={inputs.terminalGrowth} onChange={updateInput('terminalGrowth')} suffix="%" />
              <NumberField label="Years" value={inputs.dcfYears} onChange={updateInput('dcfYears')} step="1" />
              <NumberField label="Exit P/FCF" value={inputs.exitMultiple} onChange={updateInput('exitMultiple')} suffix="x" />
            </div>
            <SegmentedControl
              label="Terminal value"
              value={inputs.terminalMethod}
              onChange={setTerminalMethod}
              options={[
                { value: 'perpetuity', label: 'Perpetuity' },
                { value: 'exit', label: 'Exit multiple' }
              ]}
            />
          </section>

          <section className="toolPanel">
            <div className="sectionTitle">
              <TrendingUp size={18} />
              <h2>Growth + Income</h2>
            </div>
            <div className="fieldGrid two">
              <NumberField label="Revenue" value={inputs.revenue} onChange={updateInput('revenue')} suffix="$M" />
              <NumberField label="Sales growth" value={inputs.salesGrowth} onChange={updateInput('salesGrowth')} suffix="%" />
              <NumberField label="Op margin" value={inputs.operatingMargin} onChange={updateInput('operatingMargin')} suffix="%" />
              <NumberField label="Interest" value={inputs.interestExpense} onChange={updateInput('interestExpense')} suffix="$M" />
              <NumberField label="Tax rate" value={inputs.taxRate} onChange={updateInput('taxRate')} suffix="%" />
              <NumberField label="Buybacks" value={inputs.buybackRate} onChange={updateInput('buybackRate')} suffix="%" />
              <NumberField label="Payout" value={inputs.payoutRatio} onChange={updateInput('payoutRatio')} suffix="%" />
              <NumberField label="Exit P/E" value={inputs.exitPe} onChange={updateInput('exitPe')} suffix="x" />
              <NumberField label="Years" value={inputs.projectionYears} onChange={updateInput('projectionYears')} step="1" />
              <NumberField label="Safety margin" value={inputs.marginRequired} onChange={updateInput('marginRequired')} suffix="%" />
            </div>
          </section>
        </aside>

        <section className="results">
          <div className="summaryBand">
            <div>
              <p className="eyebrow">Triangulated value</p>
              <h2>{formatMoney(valuation.summary.triangulatedValue)}</h2>
            </div>
            <div className="summaryMetrics">
              <Snapshot label="Buy below" value={formatMoney(valuation.summary.buyBelow)} />
              <Snapshot label="Current margin" value={formatPercent(valuation.summary.currentMargin)} />
              <Snapshot label="Model spread" value={formatPercent(valuation.summary.modelSpread)} />
            </div>
          </div>

          <ValuationRange models={valuation.summary.modelValues} price={valuation.price} />

          <div className="metricGrid">
            <MetricCard
              icon={<BarChart3 size={18} />}
              title="Relative P/E"
              value={formatMoney(valuation.relative.value)}
              detail={`Forward ${formatMultiple(valuation.relative.forwardPe)} vs peer ${formatMultiple(valuation.relative.peerAveragePe)}`}
              margin={valuation.relative.margin}
            />
            <MetricCard
              icon={<Calculator size={18} />}
              title="DCF"
              value={formatMoney(valuation.dcf.value)}
              detail={`Discount rate ${formatPercent(valuation.dcf.discountRate)}; FCF ${formatCompactMoney(valuation.dcf.fcfBase)}`}
              margin={valuation.dcf.margin}
            />
            <MetricCard
              icon={<TrendingUp size={18} />}
              title="Growth model"
              value={formatMoney(valuation.growth.presentValue)}
              detail={`Future price ${formatMoney(valuation.growth.futurePrice)}; CAGR ${formatPercent(valuation.growth.expectedCagr)}`}
              margin={valuation.growth.margin}
            />
          </div>

          <div className="detailGrid">
            <section className="toolPanel resultPanel">
              <div className="sectionTitle">
                <Sigma size={18} />
                <h2>Relative Checks</h2>
              </div>
              <div className="miniTable">
                <MetricRow label="Trailing P/E" value={formatMultiple(valuation.relative.trailingPe)} />
                <MetricRow label="Forward P/E" value={formatMultiple(valuation.relative.forwardPe)} />
                <MetricRow label="Peer target" value={formatMoney(valuation.relative.peerTarget)} />
                <MetricRow label="History target" value={formatMoney(valuation.relative.historyTarget)} />
              </div>
            </section>

            <section className="toolPanel resultPanel">
              <div className="sectionTitle">
                <Landmark size={18} />
                <h2>DCF Bridge</h2>
              </div>
              <div className="miniTable">
                <MetricRow label="PV cash flows" value={formatCompactMoney(valuation.dcf.pvCashFlows)} />
                <MetricRow label="PV terminal" value={formatCompactMoney(valuation.dcf.pvTerminal)} />
                <MetricRow label="Enterprise value" value={formatCompactMoney(valuation.dcf.enterpriseValue)} />
                <MetricRow label="Equity value" value={formatCompactMoney(valuation.dcf.equityValue)} />
              </div>
            </section>
          </div>

          <section className="toolPanel tablePanel">
            <div className="sectionTitle">
              <SlidersHorizontal size={18} />
              <h2>DCF Cash Flows</h2>
            </div>
            <DataTable
              columns={['Year', 'FCF', 'PV']}
              rows={valuation.dcf.rows.map((row) => [row.year, formatCompactMoney(row.fcf), formatCompactMoney(row.pv)])}
            />
          </section>

          <section className="toolPanel tablePanel">
            <div className="sectionTitle">
              <TrendingUp size={18} />
              <h2>Growth Projection</h2>
            </div>
            <DataTable
              columns={['Year', 'Revenue', 'Shares', 'EPS', 'Dividend']}
              rows={valuation.growth.rows.map((row) => [
                row.year,
                formatCompactMoney(row.revenue),
                `${formatNumber(row.shares)}M`,
                formatMoney(row.eps),
                formatMoney(row.dividend)
              ])}
            />
          </section>
        </section>
      </main>
    </div>
  );
}

function NumberField({ label, value, onChange, prefix, suffix, step = '0.01' }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <label className="numberField" htmlFor={id}>
      <span>{label}</span>
      <div className="numberInput">
        {prefix && <b>{prefix}</b>}
        <input id={id} type="number" step={step} value={value} onChange={onChange} />
        {suffix && <b>{suffix}</b>}
      </div>
    </label>
  );
}

function SegmentedControl({ label, value, options, onChange }) {
  return (
    <div className="segmentedWrap">
      <span>{label}</span>
      <div className="segmentedControl">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? 'active' : ''}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Snapshot({ label, value }) {
  return (
    <div className="snapshot">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricCard({ icon, title, value, detail, margin }) {
  const tone = margin >= 0.2 ? 'positive' : margin >= 0 ? 'neutral' : 'negative';
  return (
    <article className={`metricCard ${tone}`}>
      <div className="metricHead">
        {icon}
        <span>{title}</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
      <div className="marginLine">
        <span>Margin</span>
        <b>{formatPercent(margin)}</b>
      </div>
    </article>
  );
}

function MetricRow({ label, value }) {
  return (
    <div className="metricRow">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DataTable({ columns, rows }) {
  return (
    <div className="tableScroller">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValuationRange({ models, price }) {
  const valid = [...models, { key: 'price', label: 'Price', value: price }].filter((item) => isFiniteNumber(item.value));
  if (valid.length < 2) return null;
  const min = Math.min(...valid.map((item) => item.value));
  const max = Math.max(...valid.map((item) => item.value));
  const spread = max - min || 1;
  const position = (value) => `${((value - min) / spread) * 100}%`;

  return (
    <section className="rangePanel">
      <div className="rangeTrack">
        {models.map((model) => (
          <span
            key={model.key}
            className={`rangeMarker ${model.key}`}
            style={{ left: position(model.value) }}
            title={`${model.label}: ${formatMoney(model.value)}`}
          />
        ))}
        <span className="priceMarker" style={{ left: position(price) }} title={`Price: ${formatMoney(price)}`} />
      </div>
      <div className="rangeLabels">
        <span>{formatMoney(min)}</span>
        <span>Price and model range</span>
        <span>{formatMoney(max)}</span>
      </div>
    </section>
  );
}

export default App;
