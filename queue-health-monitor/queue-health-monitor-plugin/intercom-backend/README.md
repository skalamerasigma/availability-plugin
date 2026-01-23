# Intercom Backend Service

Backend service that fetches all open Intercom conversations assigned to a specific team using pagination.

## Setup

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Fill in your Intercom access token in `.env`:
```
INTERCOM_TOKEN=your_intercom_access_token_here
ALLOWED_ORIGIN=https://app.sigmacomputing.com
```

3. Install dependencies:
```bash
npm install
```

4. Start the server:
```bash
npm start
```

The server will run on port 3000 (or the port specified in `PORT` env var).

## API Endpoint

### GET `/intercom/conversations/open-team-5480079`

Fetches all open conversations assigned to team 5480079.

**Response:** Array of conversation objects.

**Note:** The `state` and `team_assignee_id` are hard-coded in the backend. To change these, modify the query in `src/index.js`.

## Getting an Intercom Access Token

To get a valid Intercom access token:

1. Log in to your Intercom workspace
2. Go to **Settings** → **Developer** → **Developer Hub**
3. Create a new **App** or use an existing one
4. Go to **Authentication** → **Access Tokens**
5. Create a new access token with the following scopes:
   - `conversations.read` (required to read conversations)
   - `conversations.list` (required to list/search conversations)
6. Copy the token (it will look like: `dG9rOmMxMGFjNzBlXzVjNThfNGM0Zl9iNGZhXzUxZjU3OGQ4YjJhMzoxOjA`)

**Important:** 
- The token should be used as-is (don't add "Bearer" prefix in the .env file)
- Tokens are long-lived but can be revoked
- Make sure the token has the correct scopes for the operations you need

## Troubleshooting

### "Access Token Invalid" Error (401)

If you get a 401 error with "Access Token Invalid":

1. **Verify token format**: The token should be a long string, typically base64-encoded. Don't include "Bearer" prefix in the `.env` file.

2. **Check token permissions**: Ensure your token has:
   - `conversations.read`
   - `conversations.list`

3. **Verify token is active**: Go to Intercom Settings → Developer → Access Tokens and confirm the token is active and not expired.

4. **Check API version**: The code uses Intercom API version 2.10. Ensure your Intercom workspace supports this version.

5. **Test token directly**: You can test your token with curl:
   ```bash
   curl -X POST https://api.intercom.io/conversations/search \
     -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     -H "Content-Type: application/json" \
     -H "Intercom-Version: 2.10" \
     -d '{"query":{"operator":"AND","value":[{"field":"state","operator":"=","value":"open"}]}}'
   ```

## Deployment

Deploy to your preferred hosting service (e.g., Vercel, Heroku, AWS Lambda). Make sure to set the `INTERCOM_TOKEN` and `ALLOWED_ORIGIN` environment variables in your deployment environment.

**Security Note:** Never commit your `.env` file or expose your token. Always use environment variables in your hosting platform.

