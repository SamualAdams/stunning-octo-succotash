import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Calculator,
  Download,
  FileText,
  Folder,
  FolderPlus,
  Info,
  Landmark,
  MoreHorizontal,
  Plus,
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

const SECTION_HELP = {
  company:
    'Start here to confirm the business, quote source, price, share count, and cash-flow anchors before trusting the valuation outputs.',
  relative:
    'Relative valuation asks what the market usually pays for similar earnings. It is quick and useful, but it can be misleading when the whole peer group is expensive or the company deserves a discount.',
  dcf:
    'Discounted cash flow (DCF) estimates what future free cash flow is worth today. This section is sensitive to cash flow, growth, discount rate, and terminal value, so small changes can move the result a lot.',
  growth:
    'Growth + Income projects future revenue, profits, dividends, buybacks, and a future exit multiple. It connects business performance to expected shareholder return.',
  summary:
    'Triangulated value averages the valid model outputs. The buy-below price applies your margin of safety so you are not relying on one perfect forecast.',
  relativeChecks:
    'These checks show how the relative valuation was built from earnings and price-to-earnings (P/E) assumptions.',
  dcfBridge:
    'The bridge shows how forecast cash flows plus terminal value become enterprise value, then equity value after cash and debt.',
  dcfCashFlows:
    'This table shows each projected free-cash-flow year and its present value after discounting.',
  growthProjection:
    'This table shows how the growth model turns sales, margins, taxes, buybacks, and dividends into future earnings per share (EPS) and cash returned.'
};

const FIELD_HELP = {
  price:
    'Current stock price. A higher price lowers the margin of safety and expected return against the same intrinsic value.',
  trailingEps:
    'Earnings per share (EPS) from the recent past. It helps show what investors are paying for already-proven earnings.',
  forwardEps:
    'Expected next-year earnings per share (EPS). Relative valuation uses this as the earnings base for target prices.',
  historicalPe:
    'The price-to-earnings (P/E) multiple the company has usually earned. A higher multiple raises the relative value target, but should be justified by quality and growth.',
  peerPes:
    'Comparable company price-to-earnings (P/E) multiples. The average becomes a market-based target multiple for this stock.',
  shares:
    'Shares outstanding in millions. More shares spread the company value over more pieces, lowering value per share.',
  cfo:
    'Cash from operations (CFO) in millions. Higher cash from operations raises free cash flow and usually increases discounted cash flow (DCF) value.',
  capex:
    'Capital spending in millions. Higher capex reduces free cash flow because more cash is needed to maintain or grow the business.',
  cash:
    'Cash and investments in millions. Cash is added back after valuing the business operations.',
  debt:
    'Debt in millions. Debt is subtracted from enterprise value because it belongs to lenders before shareholders.',
  treasuryYield:
    'The risk-free baseline return. A higher Treasury yield raises the discount rate and lowers present value.',
  riskPremium:
    'Extra return demanded for business risk. A higher premium lowers discounted cash flow (DCF) value and forces a bigger expected reward.',
  fcfGrowth:
    'Annual free cash flow (FCF) growth during the forecast period. Higher growth raises future cash flows and discounted cash flow (DCF) value.',
  terminalGrowth:
    'Long-run growth after the forecast period. Higher terminal growth raises terminal value, but should stay conservative.',
  terminalMethod:
    'Choose how to estimate value after the forecast period. Perpetuity uses steady long-term growth; exit multiple assumes a sale at a future price-to-free-cash-flow (P/FCF) multiple.',
  dcfYears:
    'How many years to forecast before terminal value. More years gives the explicit forecast more weight.',
  exitMultiple:
    'Terminal price-to-free-cash-flow (P/FCF) multiple if you use the exit method. Higher exit multiple raises terminal value.',
  revenue:
    'Current annual revenue in millions. It is the starting base for the growth and income projection.',
  salesGrowth:
    'Expected annual revenue growth. Higher sales growth raises future revenue, earnings per share (EPS), dividends, and future price if margins hold.',
  operatingMargin:
    'Operating profit as a percent of sales. Higher margin turns more revenue into profit and raises projected earnings per share (EPS).',
  interestExpense:
    'Annual interest cost in millions. Higher interest reduces pretax income and projected earnings per share (EPS).',
  taxRate:
    'Percent of pretax income paid in taxes. Higher tax rate lowers net income and earnings per share (EPS).',
  buybackRate:
    'Annual share count reduction. More buybacks spread earnings over fewer shares, raising earnings per share (EPS) if the business can afford them.',
  payoutRatio:
    'Percent of earnings per share (EPS) paid as dividends. Higher payout raises cash returned but leaves less room for reinvestment.',
  exitPe:
    'Future price-to-earnings (P/E) multiple applied to projected earnings per share (EPS). Higher exit price-to-earnings multiple raises future stock price but should match business quality.',
  projectionYears:
    'Years in the growth projection. Longer periods compound the assumptions for more years.',
  marginRequired:
    'Discount you require below estimated value. A higher margin of safety lowers the buy-below price and protects against bad assumptions.'
};

const SNAPSHOT_HELP = {
  buyBelow:
    'The highest price that still meets your required margin of safety based on the triangulated value.',
  currentMargin:
    'How far the current price sits below or above the triangulated value. Positive means price is below estimated value.',
  modelSpread:
    'How far apart the model outputs are. A wider spread means the assumptions are less aligned and deserve more caution.'
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

const inputNumberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 8
});

const stripNumberFormatting = (value) => String(value ?? '').replace(/,/g, '').trim();

const toNumber = (value) => {
  const parsed = Number.parseFloat(stripNumberFormatting(value));
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
const formatInputNumber = (value) => {
  const raw = stripNumberFormatting(value);
  if (raw === '' || raw === '-' || raw === '.') return raw;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return raw;
  return inputNumberFormatter.format(parsed);
};

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Request failed.');
  return payload;
}

const caseDisplayName = (caseRecord) =>
  caseRecord?.name || caseRecord?.companyName || caseRecord?.symbol || 'Untitled Case';

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
  const [cases, setCases] = useState([]);
  const [folders, setFolders] = useState([]);
  const [activeCaseId, setActiveCaseId] = useState(null);
  const [caseMessage, setCaseMessage] = useState('Loading cases...');
  const [contextMenu, setContextMenu] = useState(null);
  const [draggedCaseId, setDraggedCaseId] = useState(null);
  const hasLoadedCasesRef = useRef(false);
  const isApplyingCaseRef = useRef(false);
  const saveTimerRef = useRef(null);
  const valuation = useMemo(() => calculateValuations(inputs), [inputs]);
  const activeCase = useMemo(() => cases.find((caseRecord) => caseRecord.id === activeCaseId) || null, [cases, activeCaseId]);

  const refreshCaseIndex = async () => {
    const payload = await requestJson('/api/cases');
    setCases(payload.cases || []);
    setFolders(payload.folders || []);
    return payload;
  };

  const applyCase = (caseRecord) => {
    if (!caseRecord) return;
    isApplyingCaseRef.current = true;
    setActiveCaseId(caseRecord.id);
    setInputs({ ...DEFAULT_INPUTS, ...(caseRecord.inputs || {}) });
    setStatus({ type: 'idle', message: `Loaded ${caseDisplayName(caseRecord)}.` });
    setCaseMessage(`Loaded ${caseDisplayName(caseRecord)}.`);
    window.setTimeout(() => {
      isApplyingCaseRef.current = false;
    }, 0);
  };

  useEffect(() => {
    let cancelled = false;

    const initializeCases = async () => {
      try {
        const payload = await requestJson('/api/cases');
        let caseList = payload.cases || [];
        let folderList = payload.folders || [];

        if (!caseList.length) {
          const created = await requestJson('/api/cases', {
            method: 'POST',
            body: JSON.stringify({ name: DEFAULT_INPUTS.companyName, inputs: DEFAULT_INPUTS })
          });
          const refreshed = await requestJson('/api/cases');
          caseList = refreshed.cases || [created.case].filter(Boolean);
          folderList = refreshed.folders || [];
        }

        if (cancelled) return;
        setCases(caseList);
        setFolders(folderList);
        hasLoadedCasesRef.current = true;
        applyCase(caseList[0]);
      } catch (error) {
        if (cancelled) return;
        hasLoadedCasesRef.current = true;
        setCaseMessage(error.message);
      }
    };

    initializeCases();

    return () => {
      cancelled = true;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const closeContextMenu = () => setContextMenu(null);
    window.addEventListener('click', closeContextMenu);
    return () => window.removeEventListener('click', closeContextMenu);
  }, []);

  useEffect(() => {
    if (!hasLoadedCasesRef.current || !activeCaseId || isApplyingCaseRef.current) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

    saveTimerRef.current = window.setTimeout(async () => {
      try {
        const nextName = inputs.companyName || inputs.symbol || activeCase?.name || 'Untitled Case';
        const payload = await requestJson(`/api/cases/${activeCaseId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: nextName, inputs })
        });
        setCases((current) => current.map((caseRecord) => (caseRecord.id === payload.case.id ? payload.case : caseRecord)));
        setCaseMessage(`Saved ${caseDisplayName(payload.case)}.`);
      } catch (error) {
        setCaseMessage(error.message);
      }
    }, 650);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [inputs, activeCaseId, activeCase?.name]);

  const updateInput = (key) => (event) => {
    setInputs((current) => ({ ...current, [key]: event.target.value }));
  };

  const setTerminalMethod = (terminalMethod) => {
    setInputs((current) => ({ ...current, terminalMethod }));
  };

  const createCase = async (folderPath = '') => {
    const suggestedName = inputs.symbol ? `${inputs.symbol} valuation` : 'New valuation case';
    const name = window.prompt('Case name', suggestedName);
    if (name === null) return;

    try {
      const payload = await requestJson('/api/cases', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim() || suggestedName,
          folderPath,
          inputs
        })
      });
      await refreshCaseIndex();
      applyCase(payload.case);
    } catch (error) {
      setCaseMessage(error.message);
    }
  };

  const createFolder = async () => {
    const name = window.prompt('Folder name');
    if (name === null || !name.trim()) return null;

    try {
      const payload = await requestJson('/api/folders', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() })
      });
      await refreshCaseIndex();
      setCaseMessage(`Created folder ${payload.folder.name}.`);
      return payload.folder;
    } catch (error) {
      setCaseMessage(error.message);
      return null;
    }
  };

  const moveCaseToFolder = async (caseId, folderPath) => {
    if (!caseId) return;

    try {
      const payload = await requestJson(`/api/cases/${caseId}`, {
        method: 'PATCH',
        body: JSON.stringify({ folderPath })
      });
      setCases((current) => current.map((caseRecord) => (caseRecord.id === caseId ? payload.case : caseRecord)));
      await refreshCaseIndex();
      setCaseMessage(folderPath ? `Moved ${caseDisplayName(payload.case)} to ${folderPath}.` : `Moved ${caseDisplayName(payload.case)} to Unfiled.`);
    } catch (error) {
      setCaseMessage(error.message);
    } finally {
      setContextMenu(null);
      setDraggedCaseId(null);
    }
  };

  const createFolderAndMoveCase = async (caseId) => {
    const folder = await createFolder();
    if (folder) await moveCaseToFolder(caseId, folder.path);
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
        message: `${payload.shortName || payload.symbol} updated from ${
          payload.source || 'live quote'
        } at ${new Date(payload.asOf).toLocaleTimeString([], {
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

      <div className="appFrame">
        <CasesSidebar
          cases={cases}
          folders={folders}
          activeCaseId={activeCaseId}
          caseMessage={caseMessage}
          contextMenu={contextMenu}
          draggedCaseId={draggedCaseId}
          onNewCase={() => createCase('')}
          onNewFolder={createFolder}
          onSelectCase={applyCase}
          onMoveCase={moveCaseToFolder}
          onCreateFolderAndMoveCase={createFolderAndMoveCase}
          onContextMenu={setContextMenu}
          onDragCase={setDraggedCaseId}
        />
        <main className="workspace">
        <aside className="inputRail">
          <section className="toolPanel identityPanel">
            <SectionHeader icon={<ShieldCheck size={18} />} title={inputs.companyName || inputs.symbol} help={SECTION_HELP.company} />
            <div className={`statusPill ${status.type}`}>{status.message}</div>
            <div className="snapshotGrid">
              <Snapshot label="Price" value={formatMoney(valuation.price)} help={FIELD_HELP.price} />
              <Snapshot label="Shares" value={`${formatNumber(toNumber(inputs.shares))}M`} help={FIELD_HELP.shares} />
              <Snapshot label="CFO" value={formatCompactMoney(toNumber(inputs.cfo))} help={FIELD_HELP.cfo} />
              <Snapshot label="Capex" value={formatCompactMoney(toNumber(inputs.capex))} help={FIELD_HELP.capex} />
            </div>
          </section>

          <section className="toolPanel">
            <SectionHeader icon={<BarChart3 size={18} />} title="Relative P/E" help={SECTION_HELP.relative} />
            <div className="fieldGrid two">
              <NumberField label="Price" value={inputs.price} onChange={updateInput('price')} prefix="$" help={FIELD_HELP.price} />
              <NumberField
                label="Trailing EPS"
                value={inputs.trailingEps}
                onChange={updateInput('trailingEps')}
                prefix="$"
                help={FIELD_HELP.trailingEps}
              />
              <NumberField
                label="Forward EPS"
                value={inputs.forwardEps}
                onChange={updateInput('forwardEps')}
                prefix="$"
                help={FIELD_HELP.forwardEps}
              />
              <NumberField
                label="Historical P/E"
                value={inputs.historicalPe}
                onChange={updateInput('historicalPe')}
                suffix="x"
                help={FIELD_HELP.historicalPe}
              />
            </div>
            <div className="textAreaField">
              <div className="fieldHeader">
                <label className="labelText" htmlFor="peer-p-e-set">
                  Peer P/E set
                </label>
                <HelpButton text={FIELD_HELP.peerPes} label="Peer P/E set help" />
              </div>
              <textarea id="peer-p-e-set" value={inputs.peerPes} onChange={updateInput('peerPes')} rows={3} />
            </div>
          </section>

          <section className="toolPanel">
            <SectionHeader icon={<Calculator size={18} />} title="DCF" help={SECTION_HELP.dcf} />
            <div className="fieldGrid two">
              <NumberField label="CFO" value={inputs.cfo} onChange={updateInput('cfo')} suffix="$M" help={FIELD_HELP.cfo} />
              <NumberField label="Capex" value={inputs.capex} onChange={updateInput('capex')} suffix="$M" help={FIELD_HELP.capex} />
              <NumberField label="Cash" value={inputs.cash} onChange={updateInput('cash')} suffix="$M" help={FIELD_HELP.cash} />
              <NumberField label="Debt" value={inputs.debt} onChange={updateInput('debt')} suffix="$M" help={FIELD_HELP.debt} />
              <NumberField
                label="Treasury"
                value={inputs.treasuryYield}
                onChange={updateInput('treasuryYield')}
                suffix="%"
                help={FIELD_HELP.treasuryYield}
              />
              <NumberField
                label="Risk premium"
                value={inputs.riskPremium}
                onChange={updateInput('riskPremium')}
                suffix="%"
                help={FIELD_HELP.riskPremium}
              />
              <NumberField
                label="FCF growth"
                value={inputs.fcfGrowth}
                onChange={updateInput('fcfGrowth')}
                suffix="%"
                help={FIELD_HELP.fcfGrowth}
              />
              <NumberField
                label="Terminal growth"
                value={inputs.terminalGrowth}
                onChange={updateInput('terminalGrowth')}
                suffix="%"
                help={FIELD_HELP.terminalGrowth}
              />
              <NumberField label="Years" value={inputs.dcfYears} onChange={updateInput('dcfYears')} step="1" help={FIELD_HELP.dcfYears} />
              <NumberField
                label="Exit P/FCF"
                value={inputs.exitMultiple}
                onChange={updateInput('exitMultiple')}
                suffix="x"
                help={FIELD_HELP.exitMultiple}
              />
            </div>
            <SegmentedControl
              label="Terminal value"
              value={inputs.terminalMethod}
              onChange={setTerminalMethod}
              help={FIELD_HELP.terminalMethod}
              options={[
                { value: 'perpetuity', label: 'Perpetuity' },
                { value: 'exit', label: 'Exit multiple' }
              ]}
            />
          </section>

          <section className="toolPanel">
            <SectionHeader icon={<TrendingUp size={18} />} title="Growth + Income" help={SECTION_HELP.growth} />
            <div className="fieldGrid two">
              <NumberField label="Revenue" value={inputs.revenue} onChange={updateInput('revenue')} suffix="$M" help={FIELD_HELP.revenue} />
              <NumberField
                label="Sales growth"
                value={inputs.salesGrowth}
                onChange={updateInput('salesGrowth')}
                suffix="%"
                help={FIELD_HELP.salesGrowth}
              />
              <NumberField
                label="Op margin"
                value={inputs.operatingMargin}
                onChange={updateInput('operatingMargin')}
                suffix="%"
                help={FIELD_HELP.operatingMargin}
              />
              <NumberField
                label="Interest"
                value={inputs.interestExpense}
                onChange={updateInput('interestExpense')}
                suffix="$M"
                help={FIELD_HELP.interestExpense}
              />
              <NumberField label="Tax rate" value={inputs.taxRate} onChange={updateInput('taxRate')} suffix="%" help={FIELD_HELP.taxRate} />
              <NumberField
                label="Buybacks"
                value={inputs.buybackRate}
                onChange={updateInput('buybackRate')}
                suffix="%"
                help={FIELD_HELP.buybackRate}
              />
              <NumberField label="Payout" value={inputs.payoutRatio} onChange={updateInput('payoutRatio')} suffix="%" help={FIELD_HELP.payoutRatio} />
              <NumberField label="Exit P/E" value={inputs.exitPe} onChange={updateInput('exitPe')} suffix="x" help={FIELD_HELP.exitPe} />
              <NumberField
                label="Years"
                value={inputs.projectionYears}
                onChange={updateInput('projectionYears')}
                step="1"
                help={FIELD_HELP.projectionYears}
              />
              <NumberField
                label="Safety margin"
                value={inputs.marginRequired}
                onChange={updateInput('marginRequired')}
                suffix="%"
                help={FIELD_HELP.marginRequired}
              />
            </div>
          </section>
        </aside>

        <section className="results">
          <div className="summaryBand">
            <div>
              <p className="eyebrow eyebrowWithHelp">
                Triangulated value
                <HelpButton text={SECTION_HELP.summary} label="Triangulated value help" />
              </p>
              <h2>{formatMoney(valuation.summary.triangulatedValue)}</h2>
            </div>
            <div className="summaryMetrics">
              <Snapshot label="Buy below" value={formatMoney(valuation.summary.buyBelow)} help={SNAPSHOT_HELP.buyBelow} />
              <Snapshot label="Current margin" value={formatPercent(valuation.summary.currentMargin)} help={SNAPSHOT_HELP.currentMargin} />
              <Snapshot label="Model spread" value={formatPercent(valuation.summary.modelSpread)} help={SNAPSHOT_HELP.modelSpread} />
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
              <SectionHeader icon={<Sigma size={18} />} title="Relative Checks" help={SECTION_HELP.relativeChecks} />
              <div className="miniTable">
                <MetricRow label="Trailing P/E" value={formatMultiple(valuation.relative.trailingPe)} />
                <MetricRow label="Forward P/E" value={formatMultiple(valuation.relative.forwardPe)} />
                <MetricRow label="Peer target" value={formatMoney(valuation.relative.peerTarget)} />
                <MetricRow label="History target" value={formatMoney(valuation.relative.historyTarget)} />
              </div>
            </section>

            <section className="toolPanel resultPanel">
              <SectionHeader icon={<Landmark size={18} />} title="DCF Bridge" help={SECTION_HELP.dcfBridge} />
              <div className="miniTable">
                <MetricRow label="PV cash flows" value={formatCompactMoney(valuation.dcf.pvCashFlows)} />
                <MetricRow label="PV terminal" value={formatCompactMoney(valuation.dcf.pvTerminal)} />
                <MetricRow label="Enterprise value" value={formatCompactMoney(valuation.dcf.enterpriseValue)} />
                <MetricRow label="Equity value" value={formatCompactMoney(valuation.dcf.equityValue)} />
              </div>
            </section>
          </div>

          <section className="toolPanel tablePanel">
            <SectionHeader icon={<SlidersHorizontal size={18} />} title="DCF Cash Flows" help={SECTION_HELP.dcfCashFlows} />
            <DataTable
              columns={['Year', 'FCF', 'PV']}
              rows={valuation.dcf.rows.map((row) => [row.year, formatCompactMoney(row.fcf), formatCompactMoney(row.pv)])}
            />
          </section>

          <section className="toolPanel tablePanel">
            <SectionHeader icon={<TrendingUp size={18} />} title="Growth Projection" help={SECTION_HELP.growthProjection} />
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
    </div>
  );
}

function CasesSidebar({
  cases,
  folders,
  activeCaseId,
  caseMessage,
  contextMenu,
  draggedCaseId,
  onNewCase,
  onNewFolder,
  onSelectCase,
  onMoveCase,
  onCreateFolderAndMoveCase,
  onContextMenu,
  onDragCase
}) {
  const rootCases = cases.filter((caseRecord) => !caseRecord.folderPath);
  const casesByFolder = folders.map((folder) => ({
    ...folder,
    cases: cases.filter((caseRecord) => caseRecord.folderPath === folder.path)
  }));
  const contextCase = contextMenu ? cases.find((caseRecord) => caseRecord.id === contextMenu.caseId) : null;

  const dropCase = (event, folderPath) => {
    event.preventDefault();
    const caseId = event.dataTransfer.getData('text/plain') || draggedCaseId;
    onMoveCase(caseId, folderPath);
  };

  return (
    <aside className="caseSidebar">
      <div className="caseSidebarHeader">
        <div>
          <p className="eyebrow">Saved work</p>
          <h2>Cases</h2>
        </div>
        <button type="button" className="casePrimaryButton" onClick={onNewCase}>
          <Plus size={16} />
          <span>New Case</span>
        </button>
      </div>

      <div className="caseActions">
        <button type="button" onClick={onNewFolder}>
          <FolderPlus size={16} />
          <span>New Folder</span>
        </button>
      </div>

      <p className="caseMessage">{caseMessage}</p>

      <section
        className={`caseFolderDrop ${draggedCaseId ? 'dropReady' : ''}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => dropCase(event, '')}
      >
        <div className="caseFolderTitle">
          <Folder size={16} />
          <span>Unfiled</span>
          <b>{rootCases.length}</b>
        </div>
        <div className="caseList">
          {rootCases.map((caseRecord) => (
            <CaseRow
              key={caseRecord.id}
              caseRecord={caseRecord}
              active={caseRecord.id === activeCaseId}
              onSelectCase={onSelectCase}
              onContextMenu={onContextMenu}
              onDragCase={onDragCase}
            />
          ))}
          {!rootCases.length && <p className="emptyCases">Drop cases here to remove them from folders.</p>}
        </div>
      </section>

      <div className="folderStack">
        {casesByFolder.map((folder) => (
          <section
            key={folder.path}
            className={`caseFolderDrop ${draggedCaseId ? 'dropReady' : ''}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => dropCase(event, folder.path)}
          >
            <div className="caseFolderTitle">
              <Folder size={16} />
              <span>{folder.name}</span>
              <b>{folder.cases.length}</b>
            </div>
            <div className="caseList">
              {folder.cases.map((caseRecord) => (
                <CaseRow
                  key={caseRecord.id}
                  caseRecord={caseRecord}
                  active={caseRecord.id === activeCaseId}
                  onSelectCase={onSelectCase}
                  onContextMenu={onContextMenu}
                  onDragCase={onDragCase}
                />
              ))}
              {!folder.cases.length && <p className="emptyCases">Drag cases into this folder.</p>}
            </div>
          </section>
        ))}
      </div>

      {contextMenu && contextCase && (
        <CaseContextMenu
          contextMenu={contextMenu}
          caseRecord={contextCase}
          folders={folders}
          onMoveCase={onMoveCase}
          onCreateFolderAndMoveCase={onCreateFolderAndMoveCase}
        />
      )}
    </aside>
  );
}

function CaseRow({ caseRecord, active, onSelectCase, onContextMenu, onDragCase }) {
  const openContextMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onContextMenu({ caseId: caseRecord.id, x: event.clientX, y: event.clientY });
  };

  const openContextFromButton = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    onContextMenu({ caseId: caseRecord.id, x: rect.left, y: rect.bottom + 6 });
  };

  return (
    <div
      className={`caseRow ${active ? 'active' : ''}`}
      draggable
      role="button"
      tabIndex={0}
      onClick={() => onSelectCase(caseRecord)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelectCase(caseRecord);
      }}
      onContextMenu={openContextMenu}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', caseRecord.id);
        onDragCase(caseRecord.id);
      }}
      onDragEnd={() => onDragCase(null)}
    >
      <FileText size={16} />
      <div>
        <strong>{caseDisplayName(caseRecord)}</strong>
        <span>{caseRecord.symbol || caseRecord.companyName || 'No ticker yet'}</span>
      </div>
      <button type="button" className="caseMenuButton" aria-label={`${caseDisplayName(caseRecord)} case menu`} onClick={openContextFromButton}>
        <MoreHorizontal size={16} />
      </button>
    </div>
  );
}

function CaseContextMenu({ contextMenu, caseRecord, folders, onMoveCase, onCreateFolderAndMoveCase }) {
  return (
    <div className="caseContextMenu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
      <strong>{caseDisplayName(caseRecord)}</strong>
      <button type="button" onClick={() => onMoveCase(caseRecord.id, '')}>
        Move to Unfiled
      </button>
      {folders.map((folder) => (
        <button key={folder.path} type="button" onClick={() => onMoveCase(caseRecord.id, folder.path)}>
          Move to {folder.name}
        </button>
      ))}
      <button type="button" onClick={() => onCreateFolderAndMoveCase(caseRecord.id)}>
        Create folder and move...
      </button>
    </div>
  );
}

function SectionHeader({ icon, title, help }) {
  return (
    <div className="sectionTitle">
      {icon}
      <h2>{title}</h2>
      <HelpButton text={help} label={`${title} help`} />
    </div>
  );
}

function HelpButton({ text, label }) {
  const helpId = useId();
  const buttonRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState(null);

  const openHelp = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const gutter = 12;
    const width = Math.min(280, Math.max(140, window.innerWidth - gutter * 2));
    const centeredLeft = rect.left + rect.width / 2 - width / 2;
    const left = Math.min(window.innerWidth - width - gutter, Math.max(gutter, centeredLeft));
    const estimatedHeight = 112;
    const belowTop = rect.bottom + 8;
    const top =
      belowTop + estimatedHeight > window.innerHeight - gutter
        ? Math.max(gutter, rect.top - estimatedHeight - 8)
        : belowTop;

    setPopoverStyle({ left: `${left}px`, top: `${top}px`, width: `${width}px` });
    setIsOpen(true);
  };

  const closeHelp = () => {
    setIsOpen(false);
  };

  return (
    <span className="helpWrap" onMouseEnter={openHelp} onMouseLeave={closeHelp}>
      <button
        ref={buttonRef}
        type="button"
        className="helpButton"
        aria-label={label}
        aria-describedby={helpId}
        onFocus={openHelp}
        onBlur={closeHelp}
      >
        <Info size={12} strokeWidth={2.4} />
      </button>
      <span id={helpId} className={`helpPopover ${isOpen ? 'open' : ''}`} role="tooltip" style={popoverStyle || undefined}>
        {text}
      </span>
    </span>
  );
}

function normalizeNumberInput(value) {
  const cleaned = String(value)
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '');
  const negative = cleaned.startsWith('-');
  const unsigned = cleaned.replace(/-/g, '');
  const [whole = '', ...decimalParts] = unsigned.split('.');
  const decimal = decimalParts.join('');
  return `${negative ? '-' : ''}${whole}${decimalParts.length ? `.${decimal}` : ''}`;
}

function NumberField({ label, value, onChange, prefix, suffix, help }) {
  const id = useId();
  const handleChange = (event) => {
    const nextValue = normalizeNumberInput(event.target.value);
    onChange({ target: { value: nextValue } });
  };

  return (
    <div className="numberField">
      <div className="fieldHeader">
        <label className="labelText" htmlFor={id}>
          {label}
        </label>
        {help && <HelpButton text={help} label={`${label} help`} />}
      </div>
      <div className="numberInput">
        {prefix && <b>{prefix}</b>}
        <input id={id} type="text" inputMode="decimal" value={formatInputNumber(value)} onChange={handleChange} />
        {suffix && <b>{suffix}</b>}
      </div>
    </div>
  );
}

function SegmentedControl({ label, value, options, onChange, help }) {
  return (
    <div className="segmentedWrap">
      <span className="fieldHeader">
        <span className="labelText">{label}</span>
        {help && <HelpButton text={help} label={`${label} help`} />}
      </span>
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

function Snapshot({ label, value, help }) {
  return (
    <div className="snapshot">
      <span className="snapshotLabel">
        {label}
        {help && <HelpButton text={help} label={`${label} help`} />}
      </span>
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
