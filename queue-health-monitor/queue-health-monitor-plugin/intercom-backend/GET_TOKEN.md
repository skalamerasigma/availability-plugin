# How to Get a Valid Intercom API Access Token

Your current token appears to be invalid or in the wrong format. Follow these steps to get a proper API access token:

## Method 1: Using Intercom Developer Hub (Recommended)

1. **Log in to Intercom**
   - Go to https://app.intercom.com
   - Log in with your admin account

2. **Navigate to Developer Hub**
   - Click on your profile icon (bottom left)
   - Go to **Settings** → **Developer** → **Developer Hub**
   - Or go directly to: https://app.intercom.com/a/apps/

3. **Create or Select an App**
   - If you don't have an app, click **"New app"**
   - Give it a name (e.g., "Sigma Queue Monitor")
   - Click **"Create app"**

4. **Get Access Token**
   - In your app, go to **"Authentication"** tab
   - Under **"Access tokens"**, click **"Create token"**
   - Give it a name (e.g., "Queue Monitor Token")
   - Select the required scopes:
     - ✅ `conversations.read` - Read conversations
     - ✅ `conversations.list` - List conversations
   - Click **"Create token"**
   - **Copy the token immediately** (you won't be able to see it again!)

5. **Update your .env file**
   - The token should be a long string (not base64 encoded)
   - It should look something like: `dG9rOmMxMGFjNzBlXzVjNThfNGM0Zl9iNGZhXzUxZjU3OGQ4YjJhMzoxOjA`
   - Paste it into your `.env` file:
     ```
     INTERCOM_TOKEN=your_new_token_here
     ```

## Method 2: Using OAuth (If you need OAuth tokens)

If you're using OAuth, the token format is different. You'll need to:
1. Set up an OAuth app in Intercom
2. Complete the OAuth flow to get an access token
3. Use that token (which will be different from an API access token)

## Verify Your Token

After updating your token, test it:

```bash
curl https://api.intercom.io/admins \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Accept: application/json" \
  -H "Intercom-Version: 2.10"
```

If successful, you'll get a JSON response with admin information. If you get an error, the token is still invalid.

## Common Issues

- **"Access Token Invalid"**: Token is wrong, expired, or revoked
- **"Unauthorized"**: Token doesn't have the required scopes
- **"Token not found"**: Token format is incorrect

## Token Format

A valid Intercom API access token:
- Is typically 50-100+ characters long
- Is base64 encoded
- Starts with characters like `dG9rOm...` when base64 encoded
- When decoded, shows format like `tok:xxxxx:y`

However, the token you're using appears to be invalid or expired. Generate a new one following the steps above.

