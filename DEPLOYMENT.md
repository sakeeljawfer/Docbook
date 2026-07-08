# DocBook Deployment Guide

## Quick Start

### Local Development
```bash
# Install dependencies
npm install

# Create local environment
cp .env.example .env.local

# Configure MongoDB connection and admin account in .env.local
# Start dev server
npm run dev

# Open http://localhost:3000
```

### Production Deployment (Vercel)

#### Step 1: Configure Environment Variables
```bash
# In Vercel Dashboard → Settings → Environment Variables, add:
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/?retryWrites=true&w=majority&maxPoolSize=100
MONGODB_DB=docbook
MONGODB_COLLECTION=app_state
JWT_SECRET=GENERATE_32_CHAR_STRONG_SECRET_HERE
ADMIN_PHONE=+94XXXXXXXXX
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=STRONG_INITIAL_PASSWORD
NODE_ENV=production
```

⚠️ **Critical**: JWT_SECRET must be at least 32 characters with mixed case and numbers.

#### Step 2: Deploy
```bash
# Push to main branch (auto-deploys via Vercel)
git push origin main

# Or deploy manually:
vercel --prod
```

#### Step 3: Verify Deployment
```bash
# Check security headers
curl -I https://your-app.vercel.app/ | grep -E 'Content-Security-Policy|Strict-Transport-Security'

# Test login endpoint
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+94123456789","password":"TestPassword123"}'

# Expected response: 401 (invalid credentials) or 200 (success)
```

### Production Deployment (Self-Hosted)

#### Using Node.js + PM2
```bash
# Build
npm run build

# Install PM2 globally
npm install -g pm2

# Start application
pm2 start npm --name docbook -- start

# Monitor logs
pm2 logs docbook

# Enable auto-restart on reboot
pm2 startup
pm2 save
```

#### Using Docker
```bash
# Build image (Dockerfile required)
docker build -t docbook:latest .

# Run container
docker run -d \
  -p 3000:3000 \
  -e MONGODB_URI=mongodb+srv://... \
  -e JWT_SECRET=... \
  --name docbook \
  docbook:latest

# View logs
docker logs -f docbook
```

## Security Configuration

### SSL/TLS Certificate
- **Vercel**: Automatic (HTTPS by default)
- **Self-Hosted**: Use Let's Encrypt (Certbot)
  ```bash
  sudo certbot certonly --standalone -d yourdomain.com
  ```

### MongoDB Security
- Enable IP Whitelist in MongoDB Atlas
- Use strong credentials (32+ char password)
- Enable encryption in transit (MONGODB_URI uses TLS by default)

### Rate Limiting
Rate limits are configured in `src/lib/rate-limit.ts`:
- Login/Register: 10 requests/minute per IP
- Appointments: 30 requests/minute per IP
- Other endpoints: 100 requests/minute per IP

Adjust these values based on expected traffic:
```typescript
// In route handlers:
if (!(await rateLimit(10, 60000))) return createRateLimitError();
                      ↑   ↑
                      |   └─ Time window (ms)
                      └───── Max requests
```

### Audit Logging
Audit logs are written to application logs (stdout in production).
```bash
# View logs in Vercel Dashboard
# Or in self-hosted, tail application logs:
pm2 logs docbook | grep -i audit
```

## Database Initialization

First application startup automatically:
1. Creates admin user from `ADMIN_PHONE` and `ADMIN_PASSWORD`
2. Initializes specializations (General Medicine, Pediatrics, etc.)
3. Initializes locations

**Note**: Admin account is only created if it doesn't exist.

## Monitoring & Maintenance

### Health Check Endpoint (Recommended)
Add a health check:
```bash
curl https://your-app.com/api/health
# Should return: {"status": "ok"}
```

### Error Tracking
Recommend integrating Sentry:
```bash
npm install @sentry/nextjs
# Configure in next.config.ts
```

### Database Backups
- **MongoDB Atlas**: Automated backups (free tier: 7-day retention)
- **Self-Hosted**: Use `mongodump`:
  ```bash
  mongodump --uri="mongodb+srv://user:password@cluster.mongodb.net/docbook" \
    --out=./backups/$(date +%Y%m%d)
  ```

### Performance Monitoring
- Monitor database connection pool metrics
- Track API response times
- Alert on rate limit triggers (potential attacks)

## Scaling Considerations

### Caching Layer
Current implementation uses in-memory cache. For multi-instance deployments, upgrade to Redis:
```typescript
// Future: Redis caching in src/lib/cache.ts
// import redis from 'redis';
// const client = redis.createClient();
```

### Database Indexing
Add these indexes to MongoDB for performance:
```javascript
db.users.createIndex({ "phone": 1 }, { "unique": true })
db.doctorProfiles.createIndex({ "userId": 1 }, { "unique": true })
db.doctorProfiles.createIndex({ "verificationStatus": 1 })
db.appointments.createIndex({ "doctorId": 1, "appointmentDate": 1 })
db.appointments.createIndex({ "patientId": 1 })
db.queueSessions.createIndex({ "doctorId": 1, "appointmentDate": 1 })
```

### Connection Pooling
MongoDB connection pool is configured:
- `maxPoolSize: 100` (handles 100 concurrent connections)
- `minPoolSize: 10` (maintains baseline pool size)
- Adjust based on expected concurrent users

## Rollback Procedure

If deployment fails:

```bash
# Vercel auto-rollback to previous deployment
vercel --prod --target production

# Manual rollback:
git revert <commit-hash>
git push origin main

# For self-hosted:
pm2 restart docbook
# Or restore from backup
```

## Troubleshooting

### MongoDB Connection Error
```
Error: MONGODB_URI is required
```
- Verify `.env.production` or environment variables are set
- Test connection: `mongosh <connection-string>`

### JWT_SECRET Error
```
Error: JWT_SECRET must be at least 32 characters
```
- Generate new secret: `openssl rand -base64 24` (32 chars)
- Update environment variables
- Restart application

### Rate Limit Error
```
HTTP 429: Too many requests
```
- This is expected when rate limit threshold is exceeded
- Clients should implement exponential backoff
- Check for attack patterns in audit logs

### Slow Appointments Endpoint
- Check MongoDB indexes are created
- Monitor database query performance
- Consider upgrading MongoDB plan if using Atlas

## Performance Optimization Roadmap

### Implemented ✅
- Rate limiting
- Input validation
- Security headers
- Audit logging
- In-memory caching

### Recommended for v2.1 📋
- Redis caching layer (distributed)
- WebSocket real-time updates (replaces polling)
- Database query optimization
- API response compression
- CDN for static assets

### Recommended for v2.2 📋
- Search/autocomplete optimization
- Queue simulation forecasting
- Doctor availability prediction
- Patient no-show prevention ML model

## Support

For deployment issues:
1. Check application logs (`pm2 logs` or Vercel Dashboard)
2. Verify environment variables are set correctly
3. Test MongoDB connectivity
4. Check security headers are present
5. Review SECURITY.md for verification steps

## Deployment Checklist

- [ ] MongoDB URI configured with proper credentials
- [ ] JWT_SECRET set to 32+ character strong value
- [ ] Admin account details configured
- [ ] SSL/TLS certificate installed
- [ ] Rate limiting thresholds reviewed
- [ ] Audit logging configured
- [ ] Database backups configured
- [ ] Error tracking configured (Sentry/similar)
- [ ] Health check endpoint tested
- [ ] Load testing completed
- [ ] Security headers verified with curl
- [ ] Admin account login tested
- [ ] Phone number validation tested
- [ ] Rate limits triggered correctly
