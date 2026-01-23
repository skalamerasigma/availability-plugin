# Queue Health Monitor Plugin

A minimalistic Sigma Computing plugin that displays open Intercom conversations assigned to a specific team. This plugin calls a backend service that handles Intercom API authentication and pagination.

## Overview

This plugin fetches and displays all open Intercom conversations for team 5480079. The backend service handles:
- Intercom API authentication (token stored securely on backend)
- Pagination across all result pages
- CORS configuration for Sigma Computing

## Setup

### 1. Backend Service

First, set up the backend service in `../intercom-backend/`:

1. Navigate to the backend directory:
```bash
cd ../intercom-backend
```

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Edit `.env` and set your Intercom access token:
```
INTERCOM_TOKEN=your_intercom_access_token_here
ALLOWED_ORIGIN=https://app.sigmacomputing.com
```

4. Install dependencies and start:
```bash
npm install
npm start
```

5. Deploy the backend to your hosting service (Vercel, Heroku, etc.) and note the base URL.

### 2. Plugin Configuration

1. Install dependencies:
```bash
npm install
```

2. Configure the backend URL in `src/App.jsx`:
   - Update `BACKEND_URL` constant, or
   - Set environment variable `REACT_APP_BACKEND_URL` when building

3. Build the plugin:
```bash
npm run build
```

4. Deploy the `build/` folder to a static hosting service (Netlify, S3, etc.)

5. Register the plugin in Sigma Computing:
   - Go to your Sigma account settings
   - Add a new custom plugin
   - Point to your deployed plugin URL

## Development

Run the development server:
```bash
npm start
```

The plugin will be available at `http://localhost:3000` (or the port shown in the terminal).

## Features

- **Automatic Data Fetching**: Loads conversations on mount
- **Refresh Button**: Manual refresh capability
- **Error Handling**: Displays user-friendly error messages
- **Responsive Table**: Scrollable table with sticky header
- **Pagination**: Backend handles all pagination automatically

## Customization

### Changing Team ID

To monitor a different team, modify the backend service (`intercom-backend/src/index.js`):
- Change `team_assignee_id` value in the query
- Update the endpoint path if desired

### Changing Conversation State

To fetch conversations with different states:
- Modify the `state` field in the query in `intercom-backend/src/index.js`
- Update the endpoint path accordingly

## Environment Variables

- `REACT_APP_BACKEND_URL`: Backend service base URL (optional, defaults to placeholder)

## Notes

- The plugin displays up to 200 conversations in the table
- Backend pagination fetches all pages automatically (up to MAX_PAGES limit)
- Ensure CORS is properly configured on the backend for your Sigma domain

