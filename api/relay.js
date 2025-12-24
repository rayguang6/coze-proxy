export default async function handler(req, res) {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.status(200).end();
      return;
    }
  
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
  
    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
    const COZE_API_KEY = process.env.COZE_API_KEY;
    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
    // Set to 'true' to use Coze API first (with DeepSeek fallback), 'false' to use DeepSeek directly
    const USE_COZE = process.env.USE_COZE === 'true';
  
    // Helper function to call DeepSeek API
    async function callDeepSeek() {
      if (!DEEPSEEK_API_KEY) {
        throw new Error('DeepSeek API key not configured');
      }

      // Transform Coze request format to DeepSeek format
      const deepseekPayload = {
        model: req.body.model || 'deepseek-chat',
        messages: req.body.messages || [],
        stream: req.body.stream || false,
        temperature: req.body.temperature,
        max_tokens: req.body.max_tokens,
      };

      console.log("Calling DeepSeek API with payload:", deepseekPayload);

      const deepseekRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deepseekPayload),
      });

      if (!deepseekRes.ok) {
        const errorText = await deepseekRes.text();
        throw new Error(`DeepSeek API error: ${deepseekRes.status} - ${errorText}`);
      }

      return deepseekRes;
    }

    // Helper function to handle streaming response
    async function handleStreamingResponse(apiRes) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = apiRes.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }

      res.end();
    }

    // Helper function to handle non-streaming response
    async function handleNonStreamingResponse(apiRes) {
      const data = await apiRes.json();
      res.status(apiRes.status).json(data);
    }

    try {
      console.log("Incoming Payload:", req.body);

      // Check if we should use Coze first or go directly to DeepSeek
      let cozeRes;
      let useDeepSeek = !USE_COZE; // If USE_COZE is false, go directly to DeepSeek

      // Only try Coze if USE_COZE is enabled
      if (USE_COZE) {
        try {
          if (!COZE_API_KEY) {
            console.warn("Coze API key not configured, using DeepSeek");
            useDeepSeek = true;
          } else {
            console.log("Trying Coze API first (USE_COZE=true)");
            cozeRes = await fetch('https://api.coze.cn/v3/chat', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${COZE_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(req.body),
            });

            console.log("Coze Status:", cozeRes.status);

            // Check if Coze API call failed
            if (!cozeRes.ok) {
              const errorText = await cozeRes.text();
              console.error("Coze API failed:", cozeRes.status, errorText);
              useDeepSeek = true;
            }
          }
        } catch (cozeErr) {
          console.error("Coze API error:", cozeErr.message);
          useDeepSeek = true;
        }
      } else {
        console.log("Routing directly to DeepSeek API (USE_COZE=false or not set)");
      }

      // Use DeepSeek (either directly or as fallback from Coze)
      if (useDeepSeek) {
        if (!DEEPSEEK_API_KEY) {
          return res.status(500).json({ 
            error: 'DeepSeek API key not configured', 
            details: 'DEEPSEEK_API_KEY is required in environment variables' 
          });
        }

        const deepseekRes = await callDeepSeek();

        if (req.body.stream === true && deepseekRes.body) {
          await handleStreamingResponse(deepseekRes);
        } else {
          await handleNonStreamingResponse(deepseekRes);
        }
      } else {
        // Use Coze response (only if USE_COZE=true and Coze succeeded)
        if (req.body.stream === true && cozeRes.body) {
          await handleStreamingResponse(cozeRes);
        } else {
          await handleNonStreamingResponse(cozeRes);
        }
      }
  
    } catch (err) {
      console.error('[Proxy Error]', err);
      res.status(500).json({ error: 'Proxy Error', details: err.message });
    }
  }