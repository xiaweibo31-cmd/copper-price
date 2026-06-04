// 沪铜行情 - Cloudflare Worker
// 部署到 Cloudflare Dashboard → Workers → Create Worker → 粘贴此代码 → Deploy

const QUOTE_URL = 'https://push2.eastmoney.com/api/qt/stock/get?secid=113.cum&fields=f43,f44,f45,f46,f48,f50,f51,f57,f58,f60,f168,f169,f170,f171,f115,f116';
const KLINE_URL = 'https://push2.eastmoney.com/api/qt/stock/kline/get?secid=113.cum&klt=101&fqt=1&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&lmt=120';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (path === '/api/quote') return await proxy(QUOTE_URL);
    if (path === '/api/kline') return await proxy(KLINE_URL);
    
    // 首页检查
    return new Response('Copper Price API is running. Use /api/quote or /api/kline', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};

async function proxy(target) {
  try {
    const resp = await fetch(target, {
      headers: {
        'User-Agent': UA,
        'Referer': 'https://quote.eastmoney.com/'
      }
    });
    const data = await resp.json();
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      }
    });
  } catch(e) {
    return new Response(JSON.stringify({error: e.message}), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
