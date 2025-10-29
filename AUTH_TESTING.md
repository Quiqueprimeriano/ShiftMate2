# JWT Authentication Testing Guide

This document provides testing instructions for the JWT authentication system implemented in ShiftMate.

## System Overview

ShiftMate uses a dual-token JWT authentication system:
- **Access Token**: Short-lived (15 minutes), included in Authorization header
- **Refresh Token**: Long-lived (30 days), stored as httpOnly cookie

## Token Storage & Security

### Backend
- Refresh tokens are stored in the `refreshTokens` database table
- Tokens are hashed using SHA-256 before storage (never stored in plaintext)
- Revoked tokens have a `revokedAt` timestamp instead of being deleted
- Expired tokens are periodically cleaned up

### Frontend
- Access token stored in memory + localStorage for persistence
- Refresh token stored as httpOnly + secure cookie (not accessible to JavaScript)
- Automatic token refresh on 401 errors with request retry
- Tokens cleared on logout

## Authentication Flow

### 1. Google OAuth Login
User clicks "Sign in with Google" button which redirects to:
```
GET /api/auth/google?intent=login
```

### 2. OAuth Callback
After successful Google authentication, user is redirected to:
```
GET /api/auth/google/callback?code=<auth_code>
```

Backend processes the OAuth callback and redirects to:
```
/?token=<access_token>
```

The refresh token is set as an httpOnly cookie.

### 3. Token Extraction
Frontend (App.tsx) extracts token from URL parameter and:
- Stores access token in memory and localStorage
- Removes token from URL
- Invalidates auth query to trigger user data fetch

### 4. Authenticated Requests
All API requests include the access token:
```
Authorization: Bearer <access_token>
```

### 5. Token Refresh
When access token expires (401 error):
- Frontend automatically calls `/api/auth/refresh`
- Refresh token sent via httpOnly cookie
- New access token returned and stored
- Original request retried with new token

### 6. Logout
User clicks logout button:
- Frontend calls `/api/auth/logout`
- Refresh token revoked in database
- Cookies cleared
- Frontend redirects to login

## Manual Testing with cURL

### Test 1: Check Authentication Status (Before Login)
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Content-Type: application/json" \
  -c cookies.txt
```

Expected Response (401):
```json
{
  "message": "Not authenticated"
}
```

### Test 2: Simulate OAuth Login (For Testing Only)
**Note**: Real login requires browser-based Google OAuth flow. This simulates the post-OAuth state.

First, login via the browser using Google OAuth, then extract the access token from the URL.

### Test 3: Check Current User (With Access Token)
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

Expected Response (200):
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "userType": "individual",
    "companyId": null,
    "createdAt": "2025-10-29T12:00:00.000Z"
  }
}
```

### Test 4: Refresh Access Token
```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -c cookies.txt
```

Expected Response (200):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Test 5: Access Protected Route (Shifts)
```bash
curl -X GET http://localhost:5000/api/shifts \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

Expected Response (200):
```json
[
  {
    "id": 1,
    "userId": 1,
    "date": "2025-10-29",
    "startTime": "09:00",
    "endTime": "17:00",
    "shiftType": "weekday",
    ...
  }
]
```

### Test 6: Logout
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -b cookies.txt
```

Expected Response (200):
```json
{
  "message": "Logged out successfully"
}
```

### Test 7: Verify Token Revocation
After logout, try to refresh:
```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -b cookies.txt
```

Expected Response (401):
```json
{
  "message": "Invalid or expired refresh token"
}
```

## Testing Scenarios

### Scenario 1: Complete Login Flow (Browser Required)
1. Open browser and navigate to `/login-new`
2. Click "Sign in with Google"
3. Complete Google OAuth flow
4. Verify redirect to `/?token=<access_token>`
5. Token should be extracted and stored automatically
6. Dashboard should load with user data

### Scenario 2: Token Expiration & Auto-Refresh
1. Login and capture access token
2. Wait 15 minutes for access token to expire
3. Make any API request (e.g., view shifts)
4. Frontend should automatically refresh token
5. Request should succeed with new token

### Scenario 3: Session Persistence
1. Login via Google OAuth
2. Close browser tab
3. Reopen application
4. Should remain logged in (access token in localStorage)
5. If access token expired, auto-refresh should occur

### Scenario 4: Multi-Device Logout
1. Login from Device A and Device B
2. Logout from Device A
3. Device A's refresh token revoked
4. Device B should still work (separate refresh token)

### Scenario 5: Protected Route Access
1. Login and get access token
2. Test all protected routes:
   - GET /api/shifts
   - POST /api/shifts
   - GET /api/companies
   - GET /api/billing/rates
   - POST /api/billing/rates
3. All should return data with valid token

## Error Scenarios

### Missing Authorization Header
```bash
curl -X GET http://localhost:5000/api/shifts \
  -H "Content-Type: application/json"
```
Expected: 401 Unauthorized (falls back to session auth if available)

### Invalid Access Token
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer invalid_token_here" \
  -H "Content-Type: application/json"
```
Expected: 401 Unauthorized with error message

### Expired Access Token
Access token expires after 15 minutes. Frontend automatically refreshes.
Backend returns 401, frontend calls /api/auth/refresh, retries request.

### Revoked Refresh Token
```bash
# After logout, refresh token is revoked
curl -X POST http://localhost:5000/api/auth/refresh \
  -b cookies.txt
```
Expected: 401 Unauthorized

## Database Verification

### Check Refresh Tokens
```sql
SELECT id, "userId", 
       LEFT("tokenHash", 20) || '...' as token_preview,
       "expiresAt", "createdAt", "revokedAt"
FROM "refreshTokens"
ORDER BY "createdAt" DESC;
```

### Check Active Tokens
```sql
SELECT COUNT(*) as active_tokens
FROM "refreshTokens"
WHERE "expiresAt" > NOW() 
  AND "revokedAt" IS NULL;
```

### Check Revoked Tokens
```sql
SELECT COUNT(*) as revoked_tokens
FROM "refreshTokens"
WHERE "revokedAt" IS NOT NULL;
```

## Frontend Testing Checklist

- [ ] Login with Google OAuth completes successfully
- [ ] Access token extracted from URL and stored
- [ ] Dashboard loads with user data
- [ ] Navigation between pages works
- [ ] Shift data loads correctly
- [ ] Token refresh happens automatically on 401
- [ ] Logout clears tokens and redirects to login
- [ ] Refresh page maintains authentication
- [ ] Close/reopen tab maintains authentication
- [ ] Access token in localStorage persists

## Backend Testing Checklist

- [ ] Google OAuth callback generates tokens
- [ ] Access token is valid JWT with correct payload
- [ ] Refresh token stored as hash in database
- [ ] /api/auth/me returns user data with valid token
- [ ] /api/auth/refresh issues new access token
- [ ] /api/auth/logout revokes refresh token
- [ ] Protected routes require valid JWT
- [ ] Expired tokens return 401
- [ ] Revoked tokens cannot be used
- [ ] Cleanup job removes expired tokens

## Troubleshooting

### Token Not Stored After Login
- Check browser console for errors
- Verify token parameter in URL after OAuth redirect
- Check localStorage for access token

### 401 Errors on Every Request
- Verify Authorization header includes "Bearer " prefix
- Check access token is valid (not expired)
- Verify token format is correct JWT

### Refresh Token Not Working
- Check httpOnly cookie is set
- Verify cookie domain matches application domain
- Check refresh token not expired or revoked
- Verify browser sends cookies with credentials: 'include'

### Auto-Refresh Not Working
- Check queryClient interceptor is configured
- Verify 401 errors trigger refresh attempt
- Check refresh endpoint returns new token
- Verify retry logic in apiRequest function

## Security Notes

1. **Token Hashing**: Refresh tokens are hashed before storage using SHA-256
2. **HttpOnly Cookies**: Refresh tokens not accessible to JavaScript (XSS protection)
3. **Secure Flag**: Cookies sent only over HTTPS in production
4. **SameSite**: Cookie attribute prevents CSRF attacks
5. **Token Rotation**: New refresh token issued on each refresh (optional)
6. **Expiration**: Short-lived access tokens minimize exposure window
7. **Revocation**: Logout immediately revokes refresh token

## Production Considerations

1. Set secure environment variables:
   - `JWT_SECRET`: Strong random secret for signing tokens
   - `JWT_REFRESH_SECRET`: Separate secret for refresh tokens

2. Enable HTTPS:
   - Secure flag on cookies only works over HTTPS
   - Use Replit deployment for automatic HTTPS

3. Monitor token usage:
   - Track failed refresh attempts
   - Alert on unusual token patterns
   - Cleanup expired tokens regularly

4. Rate limiting:
   - Limit refresh token requests per IP
   - Prevent brute force attacks

5. Token rotation (optional):
   - Issue new refresh token on each refresh
   - Revoke old refresh token
   - Implement token family tracking
