// pos-sw.js - Service Worker برای دریافت HTTP از POS

const SERVER_PORT = 3000;

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // فقط درخواست‌های POS رو پردازش کن
    if (url.pathname === '/api/swipe' && event.request.method === 'POST') {
        event.respondWith(handleSwipe(event.request));
    }
});

async function handleSwipe(request) {
    try {
        const track2Data = await request.text();
        
        // ارسال به صفحه اصلی
        const clients = await self.clients.matchAll({ type: 'window' });
        
        clients.forEach(client => {
            client.postMessage({
                type: 'POS_SWIPE',
                data: track2Data.trim()
            });
        });
        
        return new Response(JSON.stringify({ 
            status: 'ok',
            message: 'Track 2 received'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (err) {
        return new Response(JSON.stringify({ 
            status: 'error',
            message: err.message 
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

self.addEventListener('message', (event) => {
    console.log('📡 SW Message:', event.data);
});
