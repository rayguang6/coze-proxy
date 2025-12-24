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

3. Add your API keys to `.env` (see `.env.example` for reference):
```
DEEPSEEK_API_KEY=your_deepseek_api_key_here (required)
COZE_API_KEY=your_coze_api_key_here (optional, only needed if USE_COZE=true)
USE_COZE=false (optional, defaults to false - set to 'true' to use Coze first with DeepSeek fallback)
COZE_API_URL=https://open.coze.com/open_api/v2/chat (optional, override if your Coze API uses a different endpoint)
```

**Note**: 
- By default (`USE_COZE=false` or not set), the proxy routes directly to DeepSeek API, skipping Coze entirely. 
- Set `USE_COZE=true` if you want to use Coze first with automatic fallback to DeepSeek.
- **Coze format requests**: When `USE_COZE=true`, the proxy attempts Coze API first. If it fails, automatically falls back to DeepSeek (with format conversion). This ensures your Chrome extension always gets a response without handling fallback logic itself.

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
   - `DEEPSEEK_API_KEY` (required)
   - `COZE_API_KEY` (optional, only needed if `USE_COZE=true`)
   - `USE_COZE` (optional, set to `true` to use Coze first with DeepSeek fallback, defaults to `false`)
4. Deploy - Vercel will automatically detect the `api/` folder as serverless functions

The endpoint will be available at: `https://your-project.vercel.app/api/relay`

**Note for Chrome Extension**: If your extension is currently calling `localhost`, update it to use your Vercel deployment URL. The API contract (request/response format) remains the same, so no other changes are needed.

## How It Works

### Architecture

The proxy is organized into modular components:
- **`src/handlers/relay.js`** - Main request handler and routing logic
- **`src/services/cozeApi.js`** - Coze API client with timeout handling
- **`src/services/deepseekApi.js`** - DeepSeek API client
- **`src/services/streamingHandler.js`** - Streaming response handling and format conversion
- **`src/utils/formatters.js`** - Format detection and conversion utilities
- **`src/config/index.js`** - Configuration management and validation
- **`src/middleware/`** - Request validation and CORS middleware

### Request Flow

**For Coze format requests** (from Chrome extension):
1. If `USE_COZE=true` and Coze API key is configured:
   - Attempts to call Coze API with original payload
   - If successful → returns Coze response (pass-through)
   - If fails → automatically converts to DeepSeek format and calls DeepSeek API
   - Converts DeepSeek response back to Coze SSE format for extension compatibility
2. If `USE_COZE=false` or Coze API key not configured:
   - Converts Coze format to DeepSeek format
   - Calls DeepSeek API directly
   - Converts response back to Coze SSE format

**For DeepSeek format requests**:
- Routes directly to DeepSeek API (no Coze attempt, as conversion would be complex)
- Returns DeepSeek format response

### Key Features

- ✅ **Automatic fallback**: All fallback logic is handled server-side, Chrome extension never needs to handle errors
- ✅ **Format conversion**: Seamlessly converts between Coze and DeepSeek formats
- ✅ **Streaming support**: Handles both streaming and non-streaming responses
- ✅ **Request validation**: Validates request size and format
- ✅ **Timeout handling**: API calls have configurable timeouts (default: 30s)
- ✅ **Error handling**: Comprehensive error handling with clear error messages
- ✅ **CORS**: Properly configured CORS headers

### Environment Variables

- `DEEPSEEK_API_KEY` (required) - Your DeepSeek API key
- `COZE_API_KEY` (optional) - Your Coze API key (required if `USE_COZE=true`)
- `USE_COZE` (optional) - Set to `'true'` to enable Coze API with DeepSeek fallback, defaults to `'false'`
- `COZE_API_URL` (optional) - Override Coze API endpoint if needed
- `DEEPSEEK_API_URL` (optional) - Override DeepSeek API endpoint if needed
- `REQUEST_TIMEOUT` (optional) - API request timeout in milliseconds (default: 30000)
- `MAX_REQUEST_SIZE` (optional) - Maximum request size in bytes (default: 10485760 = 10MB)

