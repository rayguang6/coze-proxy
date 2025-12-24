/**
 * Format detection and conversion utilities
 */

/**
 * Detects if payload is in Coze format
 */
export function isCozeFormat(payload) {
  return payload && (payload.bot_id || payload.user_id || payload.additional_messages);
}

/**
 * Detects if payload is in DeepSeek format
 */
export function isDeepSeekFormat(payload) {
  return payload && payload.model && Array.isArray(payload.messages);
}

/**
 * Converts Coze format to DeepSeek format
 */
export function convertCozeToDeepSeek(cozePayload) {
  // Extract conversation text from Coze additional_messages
  let conversationText = '';
  if (cozePayload.additional_messages && cozePayload.additional_messages.length > 0) {
    const firstMessage = cozePayload.additional_messages[0];
    conversationText = firstMessage.content || '';
  }

  // Extract context and stage from custom_variables
  const stage = cozePayload.custom_variables?.stage || 'Opening';
  const context = cozePayload.custom_variables?.context || '';

  // Build system prompt
  const systemPrompt = buildSystemPrompt(stage, context);

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

/**
 * Builds the system prompt for sales coaching
 */
function buildSystemPrompt(stage, context) {
  return `You are an expert sales coach specializing in closing web design and digital marketing deals via Facebook Messenger.

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
}

