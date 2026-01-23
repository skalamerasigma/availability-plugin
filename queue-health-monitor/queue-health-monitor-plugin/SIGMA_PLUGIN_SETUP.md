# Sigma Plugin Setup Guide

This guide explains how to configure the Queue Health Monitor plugin in Sigma Computing to enable the `/myqueue` page for individual TSEs.

## Overview

The `/myqueue` page provides a focused view for individual TSEs to monitor their own queue and stay compliant. It filters all data to show only the current user's conversations and metrics.

## Plugin Configuration in Sigma

### Step 1: Add Plugin Argument

In your Sigma workbook where you're using this plugin:

1. **Add a Control or Formula** that uses a Sigma system function:
   - For email: `CurrentUserEmail()`
   - For full name: `CurrentUserFullName()`
   - For user attribute: `CurrentUserAttributeText("email")`

   Example: Create a text control with formula:
   ```
   CurrentUserEmail()
   ```

### Step 2: Bind to Plugin Argument

1. **Open Plugin Configuration** in Sigma
2. **Add an argument** named `currentUserEmail` (or `currentUserEmail` as a string input)
3. **Bind the control/formula** from Step 1 to this argument

### Step 3: Configure Plugin URLs

The plugin supports two routes:

- **`/`** - Manager dashboard (default, shows all TSEs)
- **`/myqueue`** - Individual TSE view (filtered to current user)

#### Option A: Use Separate Plugin Instances

Create two plugin instances in your workbook:

1. **Manager Dashboard Plugin**:
   - URL: `https://queue-health-monitor.vercel.app/`
   - No arguments needed (or leave `currentUserEmail` empty)

2. **TSE My Queue Plugin**:
   - URL: `https://queue-health-monitor.vercel.app/myqueue`
   - Argument: `currentUserEmail` bound to `CurrentUserEmail()`

#### Option B: Use Single Plugin with Navigation

Use one plugin instance and navigate between views:

- Default URL: `https://queue-health-monitor.vercel.app/`
- Add a button/link in Sigma that changes the plugin URL to `/myqueue` with the `currentUserEmail` parameter

## Testing

### Development Testing

For local testing without Sigma:

1. **Using URL Parameter**:
   ```
   http://localhost:3000/myqueue?currentUserEmail=your.email@example.com
   ```

2. **Using localStorage** (in browser console):
   ```javascript
   localStorage.setItem('currentUserEmail', 'your.email@example.com');
   window.location.href = '/myqueue';
   ```

### Production Testing

1. **Verify Email Matching**: Ensure the email from `CurrentUserEmail()` matches the email in Intercom team members
2. **Check Console**: Open browser console to see logged current user email
3. **Verify Filtering**: Confirm only your conversations appear in `/myqueue`

## How It Works

### Data Flow

1. **Sigma evaluates** `CurrentUserEmail()` for the logged-in user
2. **Sigma passes** the resolved email string to the plugin as `currentUserEmail` prop
3. **Plugin filters** conversations by matching email to team members
4. **MyQueue component** displays only filtered conversations and metrics

### Matching Logic

The plugin matches users by:

1. Finding team member with matching email (case-insensitive)
2. Using that team member's ID to filter conversations
3. Only showing conversations assigned to that TSE ID

### Fallback Methods

If `currentUserEmail` prop is not available, the plugin tries:

1. `window.sigma.getProps()` - Sigma plugin SDK
2. URL parameter `?currentUserEmail=...`
3. localStorage key `currentUserEmail`

## Troubleshooting

### "Unable to identify your account"

**Cause**: Email from Sigma doesn't match any team member email in Intercom

**Solutions**:
- Verify `CurrentUserEmail()` returns the correct email
- Check that the email exists in Intercom team members
- Ensure email matching is case-insensitive (it should be)

### No conversations showing

**Cause**: User email matches but no conversations are assigned

**Solutions**:
- Verify conversations are assigned to this TSE in Intercom
- Check that conversations have `admin_assignee_id` set correctly
- Ensure conversations are in "open" or "snoozed" state

### Plugin not receiving email

**Cause**: Argument not properly bound in Sigma

**Solutions**:
- Verify argument name is exactly `currentUserEmail`
- Check that control/formula is bound to the argument
- Test with URL parameter fallback: `?currentUserEmail=test@example.com`

## Example Sigma Configuration

### Plugin Definition

```json
{
  "name": "Queue Health Monitor",
  "url": "https://queue-health-monitor.vercel.app/myqueue",
  "arguments": [
    {
      "name": "currentUserEmail",
      "type": "string",
      "required": false,
      "default": null
    }
  ]
}
```

### Workbook Setup

1. Create a text element with formula: `CurrentUserEmail()`
2. Name it: "Current User Email"
3. In plugin configuration, bind "Current User Email" to `currentUserEmail` argument

## Security Notes

- Email matching is case-insensitive for flexibility
- Only conversations assigned to the matched TSE are shown
- No sensitive data is exposed beyond what the user already has access to
- The plugin respects Intercom's existing access controls
