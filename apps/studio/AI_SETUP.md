# AI Chat Setup Guide

To enable the AI chat functionality in Supabase Studio, you need to configure your OpenAI API key.

## Setup Steps

1. **Get an OpenAI API Key**
   - Visit https://platform.openai.com/api-keys
   - Create a new API key
   - Copy the key

2. **Set Environment Variable**
   - Create a `.env.local` file in the `apps/studio` directory (if it doesn't exist)
   - Add the following line:
   ```
   OPENAI_API_KEY=your_actual_api_key_here
   ```

3. **Restart the Development Server**
   ```bash
   cd apps/studio
   npm run dev
   ```

## Usage

- **Demo Chat**: The "Demo Chat (Styled)" shows hardcoded messages for styling reference
- **New Chats**: Click "Options" > "New Chat" to create a real AI-powered chat
- **Real AI Integration**: New chats use OpenAI GPT-4o-mini for responses

## Notes

- Demo chat is disabled (visual styling only)
- Real chats support streaming responses
- Function calling integration is planned for future updates 