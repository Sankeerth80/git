const marketAssets = {
  BTC: { name: 'Bitcoin', price: 62000, volatility: 0.035, precision: 2, phase: 0.2 },
  ETH: { name: 'Ethereum', price: 4200, volatility: 0.05, precision: 2, phase: 1.1 },
  SOL: { name: 'Solana', price: 185, volatility: 0.065, precision: 2, phase: 2.3 },
  ADA: { name: 'Cardano', price: 0.95, volatility: 0.08, precision: 4, phase: 3.4 },
  LINK: { name: 'Chainlink', price: 22, volatility: 0.055, precision: 2, phase: 4.2 },
};

const trendBias = {
  normal: 0,
  bull: 0.012,
  bear: -0.009,
  crash: -0.035,
};

let marketTrend = 'normal';

function formatPrice(value, precision = 2) {
  return Number(value.toFixed(precision));
}

function generateHistoricalSeries(base, asset, length = 24) {
  const history = [formatPrice(base, asset.precision)];
  let momentum = 0;

  for (let i = 1; i < length; i += 1) {
    const prev = history[i - 1];
    const drift = 0.00018;
    const noise = (Math.random() * 2 - 1) * asset.volatility * 0.75;
    const cycle = Math.sin((i + asset.phase) * 0.75) * asset.volatility * 0.14;
    const event = Math.random() < 0.08 ? (Math.random() * 2 - 1) * asset.volatility * 0.4 : 0;
    const changePct = drift + noise + cycle + momentum * 0.12 + event;
    const next = Math.max(0.0001, prev * (1 + changePct));
    momentum = Math.max(Math.min((next - prev) / prev, 0.18), -0.18);
    history.push(formatPrice(next, asset.precision));
  }

  return history;
}

const marketHistory = Object.fromEntries(
  Object.entries(marketAssets).map(([symbol, asset]) => [symbol, generateHistoricalSeries(asset.price, asset, 24)])
);

const marketData = Object.fromEntries(
  Object.entries(marketHistory).map(([symbol, history]) => [symbol, history[history.length - 1]])
);

function randomWalk(value, symbol) {
  const asset = marketAssets[symbol] || { volatility: 0.03, precision: 2 };
  const bias = trendBias[marketTrend] || 0;
  const momentum = asset.momentum || 0;
  const noise = (Math.random() * 2 - 1) * asset.volatility * 0.75;
  const cycle = Math.sin(Date.now() / 1800000 + asset.phase) * asset.volatility * 0.1;
  const event = Math.random() < 0.06 ? (Math.random() * 2 - 1) * asset.volatility * 0.45 : 0;
  const changePct = bias + noise + cycle + momentum * 0.14 + event;
  const next = Math.max(0.0001, value * (1 + changePct));
  asset.momentum = Math.max(Math.min((next - value) / value, 0.18), -0.18);
  return formatPrice(next, asset.precision);
}

function getCurrentPrice(symbol) {
  const normalized = symbol?.toUpperCase?.();
  if (!normalized || !marketData[normalized]) return null;
  marketData[normalized] = randomWalk(marketData[normalized], normalized);
  marketHistory[normalized].push(marketData[normalized]);
  if (marketHistory[normalized].length > 24) {
    marketHistory[normalized].shift();
  }
  return marketData[normalized];
}

function getMarketData() {
  return marketData;
}

function getMarketHistory() {
  return marketHistory;
}

function getMarketTrend() {
  return marketTrend;
}

function setMarketTrend(trend) {
  const validTrends = ['normal', 'bull', 'bear', 'crash'];
  if (validTrends.includes(trend)) {
    marketTrend = trend;
    return true;
  }
  return false;
}

function updateAllMarkets() {
  Object.keys(marketData).forEach((symbol) => {
    marketData[symbol] = randomWalk(marketData[symbol], symbol);
    marketHistory[symbol].push(marketData[symbol]);
    if (marketHistory[symbol].length > 24) {
      marketHistory[symbol].shift();
    }
  });
}

function getMarketNarrative() {
  const items = Object.entries(marketData).map(([symbol, price]) => {
    const history = marketHistory[symbol] || [];
    const first = history[0] || price;
    const changePct = first ? ((price - first) / first) * 100 : 0;
    return { symbol, changePct, name: marketAssets[symbol]?.name || symbol };
  });

  const sorted = [...items].sort((a, b) => b.changePct - a.changePct);
  const leader = sorted[0];
  const laggard = sorted[sorted.length - 1];

  const sentiment = marketTrend === 'bull'
    ? 'bullish momentum' : marketTrend === 'bear'
    ? 'cautious selling pressure' : marketTrend === 'crash'
    ? 'deep volatility and selloff risk' : 'mixed, range-bound conditions';

  const newsSnippets = [
    'Macro data and earnings headlines are driving price action.',
    'Short-term pivot levels are visible after the latest session.',
    'Crypto and DeFi instruments remain volatile ahead of policy updates.',
    'Liquidity is consolidating near recent support and resistance levels.',
  ];

  return {
    summary: `The market is showing ${sentiment}. ${leader?.name || 'A top mover'} is the top mover while ${laggard?.name || 'a laggard'} is lagging behind.`,
    note: newsSnippets[Math.floor(Math.random() * newsSnippets.length)],
  };
}

module.exports = {
  getCurrentPrice,
  getMarketData,
  getMarketHistory,
  getMarketTrend,
  setMarketTrend,
  updateAllMarkets,
  getMarketNarrative
};
