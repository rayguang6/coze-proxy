# Coze Proxy with DeepSeek Fallback

A proxy server that routes requests to Coze API, with automatic fallback to DeepSeek API when Coze is unavailable.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Add your API keys to `.env`:
```
COZE_API_KEY=your_coze_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

## Running Locally

### Option 1: Express Server (Recommended for testing)
```bash
npm run dev
```

The server will start on `http://localhost:3000`

### Option 2: Vercel CLI (For Vercel deployment testing)
```bash
npm install -g vercel
npm run vercel
```

## Testing

1. Start the server:
```bash
npm run dev
```

2. In another terminal, run the test script:
```bash
npm test
```

Or test manually with curl:
```bash
curl -X POST http://localhost:3000/api/relay \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'
```

## API Endpoint

- **URL**: `POST /api/relay`
- **Content-Type**: `application/json`

### Request Body
```json
{
  "model": "deepseek-chat",
  "messages": [
    {"role": "user", "content": "Your message here"}
  ],
  "stream": false,
  "temperature": 0.7,
  "max_tokens": 1000
}
```

## Deployment to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. **Important**: Add environment variables in Vercel project settings:
   - `COZE_API_KEY` (optional)
   - `DEEPSEEK_API_KEY` (required for fallback)
4. Deploy - Vercel will automatically detect the `api/` folder as serverless functions

The endpoint will be available at: `https://your-project.vercel.app/api/relay`

**Note for Chrome Extension**: If your extension is currently calling `localhost`, update it to use your Vercel deployment URL. The API contract (request/response format) remains the same, so no other changes are needed.

## How It Works

1. The proxy first attempts to call the Coze API
2. If Coze fails (missing key, error, or non-ok response), it automatically falls back to DeepSeek API
3. The response format is maintained regardless of which API is used
4. Your existing frontend/extension code will work without any changes

