# Stock Valuation Tool

A small Node/React valuation workbench with three editable models:

- Relative valuation using trailing P/E, forward P/E, peer P/E, and historical P/E.
- Discounted cash flow using free cash flow, discount rate, terminal growth, and exit multiple options.
- Growth plus dividends plus multiple using sales growth, operating margins, taxes, buybacks, payout, and terminal P/E.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

The `Fetch` button uses a local Express endpoint. It tries Nasdaq's public quote endpoint first with no API key, then falls back to Alpha Vantage or Yahoo Finance if available. All fields remain editable, and the output should be treated as a valuation worksheet rather than financial advice.
