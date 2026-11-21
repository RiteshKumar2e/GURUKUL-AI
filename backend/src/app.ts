import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import api from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { enforceHttps, globalLimiter } from './middleware/security';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', 1);

  app.use(enforceHttps);
  app.use(
    helmet({
      // API only serves JSON; the frontend sets its own CSP
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      hsts: env.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || env.frontendOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  );
  if (!env.isTest) {
    // Log method, path, status and time only — never bodies (they may contain student answers or passwords)
    app.use(morgan(env.isProd ? ':method :url :status :response-time ms' : 'dev'));
  }
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());
  app.use('/api', globalLimiter, api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
