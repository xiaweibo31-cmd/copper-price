/**
 * 铜实时价格 - 数据抓取脚本
 * 
 * 从东方财富 API 获取沪铜主连实时行情
 * 用法: node fetch.js
 * 
 * 输出:
 *   data/latest.json   - 最新行情
 *   data/history.json  - 历史数据（每日一条）
 *   data/data.js       - 网页前端嵌入式数据
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const LATEST_FILE = path.join(DATA_DIR, 'latest.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function curl(url) {
  const out = execSync('/usr/bin/curl -sL -4 -A "' + UA + '" "' + url + '"', { timeout: 15000, encoding: 'utf-8' });
  return JSON.parse(out);
}

async function fetchQuote() {
  const result = curl(
    'https://push2.eastmoney.com/api/qt/stock/get' +
    '?secid=113.cum' +
    '&fields=f43,f44,f45,f46,f48,f50,f51,f57,f58,f60,f168,f169,f170,f171,f115,f116'
  );
  if (!result.data) throw new Error('API Error: ' + JSON.stringify(result));
  const d = result.data;
  return {
    code: d.f57,
    name: d.f58,
    price: d.f43,
    change: d.f170,
    changePercent: d.f171,
    open: d.f46,
    high: d.f44,
    low: d.f45,
    prevClose: d.f60,
    volume: d.f50,
    openInterest: d.f51,
    turnover: d.f48,
    limitUp: d.f169,
    limitDown: d.f168,
    timestamp: Date.now(),
    date: new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }),
  };
}

async function fetchKline() {
  try {
    const result = curl(
      'https://push2.eastmoney.com/api/qt/stock/kline/get' +
      '?secid=113.cum' +
      '&klt=101&fqt=1' +
      '&fields1=f1,f2,f3' +
      '&fields2=f51,f52,f53,f54,f55,f56,f57' +
      '&lmt=120'
    );
    if (!result.data || !result.data.klines) return null;
    return result.data.klines.map((line) => {
      const parts = line.split(',');
      return {
        date: parts[0],
        open: parseFloat(parts[1]),
        close: parseFloat(parts[2]),
        high: parseFloat(parts[3]),
        low: parseFloat(parts[4]),
        volume: parseFloat(parts[5]),
        amount: parseFloat(parts[6]),
      };
    });
  } catch { return null; }
}

function saveData(quote, kline) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  fs.writeFileSync(LATEST_FILE, JSON.stringify(quote, null, 2), 'utf-8');

  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    try { history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')); } catch {}
  }

  const today = quote.date;
  const idx = history.findIndex((h) => h.date === today);
  if (idx >= 0) {
    history[idx] = { ...history[idx], price: quote.price, open: quote.open, high: quote.high, low: quote.low, volume: quote.volume };
  } else {
    history.push({ date: today, price: quote.price, open: quote.open, high: quote.high, low: quote.low, volume: quote.volume });
  }

  if (kline && kline.length > 0) {
    const historyMap = new Map(history.map((h) => [h.date, h]));
    for (const k of kline) {
      const d = k.date;
      if (!historyMap.has(d)) {
        historyMap.set(d, { date: d, price: k.close, open: k.open, high: k.high, low: k.low, volume: k.volume });
      }
    }
    history = Array.from(historyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
  return history;
}

function generateEmbedJS(quote, history) {
  const embedPath = path.join(DATA_DIR, 'data.js');
  const content = `// 铜价数据 - 由 fetch.js 自动生成
window.__COPPER_DATA = ${JSON.stringify({ latest: quote, history: history }, null, 2)};
`;
  fs.writeFileSync(embedPath, content, 'utf-8');
}

async function main() {
  console.log('[' + new Date().toLocaleString('zh-CN') + '] 开始抓取铜价数据...');

  try {
    const quote = await fetchQuote();
    console.log('  最新价:', quote.price, '元/吨');
    console.log('  涨跌:', quote.change, '(', quote.changePercent?.toFixed?.(2) ?? quote.changePercent, '%)');
    console.log('  今开:', quote.open, '最高:', quote.high, '最低:', quote.low);
    console.log('  昨收:', quote.prevClose);
    console.log('  成交量:', quote.volume, '手');

    const kline = await fetchKline();
    if (kline) {
      console.log('  历史K线:', kline.length, '条');
    } else {
      console.log('  历史K线: 暂未获取到');
    }

    const history = saveData(quote, kline);
    generateEmbedJS(quote, history);
    console.log('  数据已保存');
  } catch (err) {
    console.error('  抓取失败:', err.message);
    process.exit(1);
  }
}

main();
