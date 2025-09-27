import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

// Check for required environment variable
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set!");
  throw new Error("DATABASE_URL environment variable is required");
}

// Set TLS rejection variables if SSL validation is disabled
if (process.env.DISABLE_SSL_VALIDATION === 'true') {
  console.warn("⚠️ SSL certificate validation disabled - setting TLS rejection overrides");
  // These are needed for some environments where the regular SSL options aren't enough
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  process.env.PG_TLS_REJECT_UNAUTHORIZED = '0';
}

// Only log DB setup during development or if VERBOSE_DB_LOGS is set
const shouldLog = process.env.NODE_ENV === 'development' || process.env.VERBOSE_DB_LOGS === 'true';

if (shouldLog) {
  console.log(`[DB Setup] Environment: ${process.env.NODE_ENV || 'unknown'}`);
  console.log(`[DB Setup] DATABASE_URL: ${process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@')}`);
}

// Function to get CA certificate based on environment
function getCACertificate() {
  // If SSL validation is explicitly disabled via env var, don't bother with certificate
  if (process.env.DISABLE_SSL_VALIDATION === 'true') {
    if (shouldLog) console.warn("⚠️ SSL certificate validation disabled via environment variable");
    return undefined;
  }

  try {
    // Check if fs and path modules are available (not in edge runtime)
    const fs = typeof window === 'undefined' ? require('fs') : null;
    const path = typeof window === 'undefined' ? require('path') : null;

    if (!fs || !path) {
      if (shouldLog) console.warn("⚠️ File system not available in edge runtime, skipping certificate loading");
      return undefined;
    }

    // For production (Vercel), try multiple possible locations
    if (process.env.NODE_ENV === 'production') {
      // Try standard paths for Vercel deployments
      const possiblePaths = [
        path.join(process.cwd(), 'public/certs/ca-certificate.crt'),
        path.join(process.cwd(), '.vercel/output/static/certs/ca-certificate.crt'),
        path.join(process.cwd(), 'certs/ca-certificate.crt'),
        path.join('/tmp/certs/ca-certificate.crt')
      ];

      for (const certPath of possiblePaths) {
        if (fs.existsSync(certPath)) {
          if (shouldLog) console.log(`✅ Found CA certificate at: ${certPath}`);
          return fs.readFileSync(certPath).toString();
        }
      }

      if (shouldLog) console.warn("⚠️ Could not find CA certificate in production environment");
    } else {
      // For local development, try to use the certificate from the downloads directory
      const devCertPath = '/Users/sattu/Downloads/ca-certificate.crt';
      if (fs.existsSync(devCertPath)) {
        if (shouldLog) console.log(`✅ Found CA certificate at: ${devCertPath}`);
        return fs.readFileSync(devCertPath).toString();
      }
    }

    // If certificate not found, log it and fall back to disabling TLS validation
    if (shouldLog) console.warn("⚠️ CA Certificate not found, falling back to insecure connection");
    return undefined;
  } catch (error) {
    if (shouldLog) console.error("❌ Error loading CA certificate:", error);
    return undefined;
  }
}

// Get CA certificate
const caCert = getCACertificate();

// Configure SSL options based on environment and certificate availability
// For local development, disable SSL completely
// Also check if the database URL is a local database (localhost or 127.0.0.1)
const isLocalDB = process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1');
const sslConfig = process.env.NODE_ENV === 'development' || process.env.DISABLE_SSL_VALIDATION === 'true' || isLocalDB
  ? false  // Disable SSL completely for local PostgreSQL
  : caCert
    ? {
        ca: caCert,
        // Still keep rejectUnauthorized true when using a CA cert
        rejectUnauthorized: true
      }
    : {
        // Fall back to this when no cert is available
        rejectUnauthorized: false
      };

if (shouldLog) {
  console.log(`[DB Setup] SSL Config: ${JSON.stringify({
    rejectUnauthorized: sslConfig ? sslConfig.rejectUnauthorized : false,
    hasCert: !!caCert
  })}`);
}

// Fix for the connection string - handle SSL mode
let connectionString = process.env.DATABASE_URL;

// If SSL validation is disabled, modify the connection string to not enforce SSL
if (process.env.DISABLE_SSL_VALIDATION === 'true') {
  // Replace sslmode=require with sslmode=prefer or remove it
  if (connectionString.includes('sslmode=require')) {
    connectionString = connectionString.replace('sslmode=require', 'sslmode=prefer');
    if (shouldLog) console.log(`[DB Setup] Modified connection string SSL mode to 'prefer'`);
  }
}

// Create connection pool with SSL for DigitalOcean PostgreSQL
const pool = new Pool({
  connectionString,
  // Set connection timeout and retry options
  connectionTimeoutMillis: 5000, // 5 second timeout
  max: 10, // Maximum 10 clients in pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  ssl: sslConfig
});

// Test database connection only once and only in development or when explicitly requested
if (shouldLog && !global.__dbConnectionTested) {
  global.__dbConnectionTested = true;
  pool.connect()
    .then(client => {
      console.log('✅ Successfully connected to DigitalOcean PostgreSQL database');
      console.log(`✅ SSL configuration: ${caCert ? 'Using CA certificate' : 'Certificate validation disabled'}`);
      client.release();
    })
    .catch(err => {
      console.error('❌ Failed to connect to database:', err.message);

      // Additional handling for specific error codes
      if (err.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
        console.error('This is a self-signed certificate error. Try setting DISABLE_SSL_VALIDATION=true in environment variables.');
      }

      // We don't throw here to allow the app to start, but the error will be logged
    });
}

// Export drizzle instance with pool
export const db = drizzle(pool, { logger: false });