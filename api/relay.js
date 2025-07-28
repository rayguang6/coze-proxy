export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
  
    const COZE_API_KEY = process.env.COZE_API_KEY;
  
    try {
      console.log("Incoming Payload:", req.body);
  
      const cozeRes = await fetch('https://api.coze.cn/v3/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${COZE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      });
  
      console.log("Coze Status:", cozeRes.status);
  
      res.setHeader('Access-Control-Allow-Origin', '*');
  
      // Handle stream: true
      if (req.body.stream === true && cozeRes.body) {
        res.setHeader('Content-Type', 'text/event-stream');
  
        const reader = cozeRes.body.getReader();
        const decoder = new TextDecoder();
  
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
  
        res.end();
      } else {
        // stream: false or no streaming supported
        const data = await cozeRes.json();
        res.status(cozeRes.status).json(data);
      }
  
    } catch (err) {
      console.error('[Proxy Error]', err);
      res.status(500).json({ error: 'Proxy Error', details: err.message });
    }
  }
  