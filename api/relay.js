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
  
    // Helper function to detect if payload is Coze format
    function isCozeFormat(payload) {
      return payload && (payload.bot_id || payload.user_id || payload.additional_messages);
    }

    // Helper function to convert Coze format to DeepSeek format
    function convertCozeToDeepSeek(cozePayload) {
      // Extract conversation text from Coze additional_messages
      let conversationText = '';
      if (cozePayload.additional_messages && cozePayload.additional_messages.length > 0) {
        const firstMessage = cozePayload.additional_messages[0];
        conversationText = firstMessage.content || '';
      }

      // Extract context and stage from custom_variables
      const stage = cozePayload.custom_variables?.stage || 'Opening';
      const context = cozePayload.custom_variables?.context || '';

      // Build system prompt (basic version - guide would ideally come from Coze bot config)
      const systemPrompt = `You are an expert sales coach specializing in closing web design and digital marketing deals via Facebook Messenger.

In the transcript, 'Me' refers to the user (the salesperson), and all other names are clients.

The current sales stage is: ${stage}.

Analyze the conversation and suggest 3 strategic reply options for this stage. For each suggestion, provide:
- suggestion: The exact reply text to send (natural, human, not robotic)
- reason: An object with two keys:
    - en: Brief explanation in English of why this approach works (clear and concise)
    - zh: Friendly, conversational explanation in Chinese, as if you're a Malaysian sales mentor talking to a friend. Use simple, natural language, and add a bit of local flavor or encouragement. Avoid robotic or overly formal language.

Key principles:
- Always end with questions to keep the conversation flowing
- Use "magic questions" (answer questions with questions) when unclear
- Build rapport before closing
- Match the conversation stage as provided by the user
- Sound natural and human, never robotic or pushy

Your chatting style:
- Always end with questions to keep the conversation flowing
- Only suggest your reply from the perspective of the current user (referenced as "You sent" in the message), not the other party
- Your tone is friendly, honest, practical and also fun
- Your replies should sound human and natural, never robotic
- No " symbols in all replies
- Do not use same greetings or salutation all the time, vary them or avoid using completely
- No emoticons
- Do not use - in any part of your sentence. In most case - can be replaced by comma or ellipsis ...
- Always capitalise Human names and first letter after a fullstop or question mark
- Strictly no exclamation marks in all your replies
- Use "magic questions" (answer questions with questions) when unclear
- Build rapport before closing
- Always vary your sentences in every reply
- Always use simple words
- Match the conversation stage
- Sound natural and human, never robotic or pushy

Respond ONLY in valid JSON format as an array of objects with keys: suggestion, reason (reason must be an object with en and zh). Do NOT include any markdown, code blocks, or extra commentary.`;

      // Build messages array
      const messages = [
        { role: 'system', content: systemPrompt }
      ];

      if (context && context.length > 0) {
        messages.push({ role: 'user', content: '[Context] ' + context });
      }

      messages.push({ role: 'user', content: conversationText });

      return {
        model: 'deepseek-chat',
        messages: messages,
        stream: cozePayload.stream || false,
        temperature: 0.7,
        max_tokens: 500
      };
    }

    // Helper function to call DeepSeek API
    async function callDeepSeek(deepseekPayload = null) {
      if (!DEEPSEEK_API_KEY) {
        throw new Error('DeepSeek API key not configured');
      }

      // Use provided payload or transform from request body
      let payload;
      if (deepseekPayload) {
        payload = deepseekPayload;
      } else if (isCozeFormat(req.body)) {
        // Convert Coze format to DeepSeek format
        payload = convertCozeToDeepSeek(req.body);
        console.log("Converted Coze format to DeepSeek format");
      } else {
        // Already in DeepSeek format
        payload = {
          model: req.body.model || 'deepseek-chat',
          messages: req.body.messages || [],
          stream: req.body.stream || false,
          temperature: req.body.temperature,
          max_tokens: req.body.max_tokens,
        };
      }

      console.log("Calling DeepSeek API with payload:", JSON.stringify(payload, null, 2));

      const deepseekRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!deepseekRes.ok) {
        const errorText = await deepseekRes.text();
        throw new Error(`DeepSeek API error: ${deepseekRes.status} - ${errorText}`);
      }

      return deepseekRes;
    }

    // Helper function to convert DeepSeek streaming to Coze SSE format
    async function convertDeepSeekStreamToCoze(apiRes) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = apiRes.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();
            if (dataStr === '[DONE]') {
              // Send completion event in Coze format
              res.write(`event: conversation.message.completed\n`);
              res.write(`data: ${JSON.stringify({ type: 'answer', content: fullContent })}\n\n`);
              res.end();
              return;
            }

            try {
              const data = JSON.parse(dataStr);
              const content = data.choices?.[0]?.delta?.content || '';
              if (content) {
                fullContent += content;
                // Send delta event in Coze format
                res.write(`event: conversation.message.delta\n`);
                res.write(`data: ${JSON.stringify({ type: 'answer', content: content })}\n\n`);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      // Send final completion if we didn't get [DONE]
      res.write(`event: conversation.message.completed\n`);
      res.write(`data: ${JSON.stringify({ type: 'answer', content: fullContent })}\n\n`);
      res.end();
    }

    // Helper function to handle streaming response
    async function handleStreamingResponse(apiRes, isCozeFormat = false) {
      // If original request was Coze format, convert DeepSeek stream to Coze SSE format
      if (isCozeFormat) {
        await convertDeepSeekStreamToCoze(apiRes);
        return;
      }

      // Otherwise, pass through DeepSeek streaming format as-is
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
      console.log("Incoming Payload:", JSON.stringify(req.body, null, 2));

      // Detect payload format
      const isCozePayload = isCozeFormat(req.body);
      const isDeepSeekPayload = req.body.model && req.body.messages;

      if (isCozePayload) {
        console.log("Detected Coze format payload - converting to DeepSeek and routing to DeepSeek API");
        // Always route Coze format to DeepSeek (for backward compatibility with previous extension versions)
        if (!DEEPSEEK_API_KEY) {
          return res.status(500).json({ 
            error: 'DeepSeek API key not configured', 
            details: 'DEEPSEEK_API_KEY is required in environment variables' 
          });
        }

        const deepseekRes = await callDeepSeek();
        const shouldStream = req.body.stream === true;

        if (shouldStream && deepseekRes.body) {
          await handleStreamingResponse(deepseekRes, true); // true = isCozeFormat
        } else {
          await handleNonStreamingResponse(deepseekRes);
        }
        return;
      }

      // Handle DeepSeek format payload
      if (isDeepSeekPayload) {
        // Check if we should use Coze first or go directly to DeepSeek
        let cozeRes;
        let useDeepSeek = !USE_COZE; // If USE_COZE is false, go directly to DeepSeek

        // Only try Coze if USE_COZE is enabled and payload is in DeepSeek format
        if (USE_COZE) {
          try {
            if (!COZE_API_KEY) {
              console.warn("Coze API key not configured, using DeepSeek");
              useDeepSeek = true;
            } else {
              console.log("Trying Coze API first (USE_COZE=true)");
              // Note: Coze API expects different format, so we'd need to convert DeepSeek to Coze
              // For now, if payload is DeepSeek format, we'll route to DeepSeek
              console.log("Payload is in DeepSeek format, routing to DeepSeek");
              useDeepSeek = true;
            }
          } catch (cozeErr) {
            console.error("Coze API error:", cozeErr.message);
            useDeepSeek = true;
          }
        } else {
          console.log("Routing directly to DeepSeek API (USE_COZE=false or not set)");
        }

        // Use DeepSeek
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
        }
        return;
      }

      // Unknown format
      return res.status(400).json({ 
        error: 'Invalid payload format', 
        details: 'Payload must be in Coze format (bot_id, user_id, additional_messages) or DeepSeek format (model, messages)' 
      });
  
    } catch (err) {
      console.error('[Proxy Error]', err);
      res.status(500).json({ error: 'Proxy Error', details: err.message });
    }
  }