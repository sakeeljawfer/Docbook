# Security Implementation Guide

## Overview
This document outlines the security hardening implemented in DocBook v2.0 and verification steps for production deployment.

## Security Measures Implemented

### ✅ Authentication & Authorization
- **JWT Secret Validation**: Enforces minimum 32-character secrets (previously failed with 8-char secrets)
- **Password Strength**: Requires minimum 8 characters with mixed case and numbers
- **Phone Number Validation**: E.164 format with regex `/^\+?[1-9]\d{1,14}$/` (prevents fake numbers like "1234567")
- **Session Management**: Secure HTTP-only cookies with SameSite=Lax
- **Role-Based Access Control**: Verified in all protected routes

### ✅ Rate Limiting
- **Login/Register**: 10 requests per minute per IP (prevents brute force)
- **Appointment Booking**: 30 requests per minute per IP
- **General Endpoints**: 100 requests per minute per IP
- **Implementation**: Token bucket algorithm with in-memory storage (Redis-ready)

### ✅ Security Headers
- **Content-Security-Policy**: Restricts scripts to self-origin (prevents XSS)
- **X-Frame-Options: DENY**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **Strict-Transport-Security**: Forces HTTPS in production (63 days max-age)
- **X-XSS-Protection**: Legacy XSS protection

### ✅ Database Security
- **Connection Pooling**: Configured maxPoolSize=100 with proper timeouts
- **Graceful Shutdown**: Closes connections on SIGINT
- **Atomic Operations**: Uses `mutateDb()` for read-modify-write consistency
- **Timeout Protection**: 30-second socket timeout, 10-second connect timeout

### ✅ Race Condition Fixes
- **Appointment Booking**: Fixed race condition allowing overbooking
  - Before: Check capacity, then insert (another request could slip in)
  - After: All checks and insertions within atomic `mutateDb()` call
- **Patient Data**: Separated public views from internal views to prevent phone number leakage

### ✅ Input Validation
- **Zod Schemas**: All API inputs validated with strict schemas
- **Phone**: E.164 format, min 7 digits, max 15
- **Password**: min 8 chars, requires uppercase + lowercase + number
- **Dates**: Prevents past date bookings
- **Consultation Fee**: Non-negative numbers only

### ✅ Audit Logging
- **Sensitive Operations**: All admin actions logged (doctor approvals, payments, status changes)
- **Login Attempts**: Successful and failed logins tracked
- **Data Access**: Patient data access attempts logged
- **Location**: `src/lib/audit.ts` with structured JSON logging

### ✅ Caching Layer
- **TTL Management**: 
  - Doctors: 60 seconds
  - Appointments: 30 seconds  
  - Queue Status: 15 seconds
- **Automatic Cleanup**: Expired entries removed every 60 seconds
- **Cache Invalidation**: Pattern-based invalidation on data changes
- **Location**: `src/lib/cache.ts`

## Verification Checklist

### Pre-Deployment

```bash
# 1. Verify JWT secret is strong
echo $JWT_SECRET | wc -c  # Must be > 32 characters

# 2. Test rate limiting locally
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+94123456789","password":"test"}' \
  --repeat 15  # Should return 429 after 10 requests

# 3. Verify database connection pooling
npm run build && npm start  # Check no connection timeout errors

# 4. Verify security headers
curl -I https://yourapp.com/ | grep -E 'Content-Security-Policy|X-Frame-Options|Strict-Transport-Security'

# 5. Run TypeScript type checking
npm run build  # Should complete without errors
```

### Post-Deployment

```bash
# 1. Test authentication
curl -X POST https://yourapp.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+94123456789","password":"TestPassword123"}'  # min 8 chars, mixed case, numbers

# 2. Verify CORS and headers
curl -I https://yourapp.com/ \
  | grep -E 'Content-Security-Policy|X-Frame-Options|Strict-Transport-Security'

# 3. Monitor audit logs
# Check application logs for structured audit entries in JSON format

# 4. Test rate limiting under load
# Use load testing tool (ApacheBench, k6, etc.) to verify rate limits trigger at thresholds

# 5. Verify database health
# Check MongoDB connection pool metrics
# Ensure no connection timeouts in application logs
```

## Remaining Known Gaps

These items require external services and are marked for future sprints:

- [ ] **SMS Verification**: Phone number verification (requires Twilio/AWS SNS)
- [ ] **Email Notifications**: Send booking confirmations via email
- [ ] **WebSocket Real-Time Updates**: Replace polling with live connections (15K requests/day savings)
- [ ] **Encryption at Rest**: Enable MongoDB encryption (requires enterprise plan)
- [ ] **HIPAA Compliance**: Full audit trail, data retention policies
- [ ] **2FA Support**: Two-factor authentication for admin accounts
- [ ] **API Keys**: Service-to-service authentication for integrations
- [ ] **Penetration Testing**: Third-party security audit recommended

## Production Deployment Checklist

- [ ] Verify `.env.production` is configured with strong JWT_SECRET (32+ chars)
- [ ] Set ADMIN_PHONE and ADMIN_PASSWORD for initial admin account
- [ ] MongoDB URI configured with proper credentials and connection pooling
- [ ] SSL/TLS certificate installed (required for Strict-Transport-Security header)
- [ ] All rate-limiting thresholds reviewed and adjusted for expected traffic
- [ ] Audit logging configured (check logs are being written)
- [ ] Error monitoring set up (Sentry recommended)
- [ ] Database backups configured
- [ ] CDN configured for static assets (improves performance)
- [ ] Load testing completed to verify rate limits work under stress

## Environment Variables

### Required
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=... (32+ chars, mixed case + numbers)
ADMIN_PHONE=+94...
ADMIN_PASSWORD=...
```

### Optional
```
NODE_ENV=production
```

## Incident Response

### Failed Authentication Attempts
- Check rate limiting is enforced (HTTP 429)
- Verify audit logs show failed login attempts
- Monitor for credential stuffing patterns

### Database Connection Issues
- Check MongoDB connection string in .env
- Verify network connectivity to MongoDB Atlas
- Review connection pool metrics (maxPoolSize, activeConnections)

### Race Conditions
- All appointment bookings protected by atomic `mutateDb()` calls
- No overbooking possible even under concurrent load
- Queue recalculation happens atomically with appointment updates

## References
- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [MongoDB Security Checklist](https://docs.mongodb.com/manual/security/)
- [NIST Guidelines](https://pages.nist.gov/800-63-3/)
