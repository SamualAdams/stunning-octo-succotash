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

The `Fetch` button uses a local Express endpoint. It reads live quote data from Alpha Vantage when `ALPHAVANTAGE_API_KEY` is set, falls back to the public demo quote where available, then attempts Yahoo Finance quote data. All fields remain editable, and the output should be treated as a valuation worksheet rather than financial advice.
