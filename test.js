// Simple test script to test the proxy locally
import { config } from 'dotenv';

config();

const API_URL = process.env.API_URL || 'http://localhost:3000/api/relay';

async function testProxy() {
  console.log('🧪 Testing proxy endpoint...\n');

  const testPayload = {
    model: 'deepseek-chat',
    messages: [
      {
        role: 'user',
        content: 'Hello! Say "test successful" if you can read this.'
      }
    ],
    stream: false,
    temperature: 0.7,
    max_tokens: 100
  };

  try {
    console.log('📤 Sending request:', JSON.stringify(testPayload, null, 2));
    console.log(`📍 URL: ${API_URL}\n`);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    console.log(`📥 Response Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ Success! Response:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      const error = await response.text();
      console.log('\n❌ Error Response:');
      console.log(error);
    }
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    console.error('\n💡 Make sure the server is running: npm run dev');
  }
}

testProxy();

