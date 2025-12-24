/**
 * Handles streaming responses and format conversion
 */

/**
 * Converts DeepSeek streaming format to Coze SSE format
 * This maintains compatibility with Chrome extension expectations
 */
export async function convertDeepSeekStreamToCoze(apiRes, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const reader = apiRes.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';

  try {
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
            // Ignore parse errors for malformed JSON chunks
          }
        }
      }
    }

    // Send final completion if we didn't get [DONE]
    res.write(`event: conversation.message.completed\n`);
    res.write(`data: ${JSON.stringify({ type: 'answer', content: fullContent })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Error converting DeepSeek stream to Coze format:', error);
    res.end();
    throw error;
  }
}

/**
 * Handles streaming response (pass-through for DeepSeek format)
 */
export async function handleDeepSeekStreamResponse(apiRes, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const reader = apiRes.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }
    res.end();
  } catch (error) {
    console.error('Error streaming DeepSeek response:', error);
    res.end();
    throw error;
  }
}

/**
 * Handles non-streaming response
 */
export async function handleNonStreamingResponse(apiRes, res) {
  try {
    const data = await apiRes.json();
    res.status(apiRes.status).json(data);
  } catch (error) {
    console.error('Error parsing API response:', error);
    res.status(500).json({ 
      error: 'Failed to parse API response',
      details: error.message 
    });
  }
}

