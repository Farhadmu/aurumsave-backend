import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Security Headers
  app.use(helmet());

  // CORS Configuration
  const configuredFrontend = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/+$/, '') : null;
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      const isAllowed =
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.endsWith('.vercel.app') ||
        (configuredFrontend && origin === configuredFrontend);

      if (isAllowed || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key'],
  });

  // URL rewrite middleware: seamlessly support requests calling /auth/..., /gold/..., etc. directly without /api/v1
  app.use((req: any, _res: any, next: any) => {
    if (!req.url.startsWith('/api/v1') && !req.url.startsWith('/api/v1/docs')) {
      const topLevelRoutes = [
        'auth',
        'gold',
        'orders',
        'payments',
        'portfolio',
        'kyc',
        'compliance',
        'support',
        'admin',
        'operations',
        'audit',
        'ai',
        'health',
      ];
      const firstSegment = req.url.split('?')[0].split('/').filter(Boolean)[0];
      if (firstSegment && topLevelRoutes.includes(firstSegment)) {
        req.url = `/api/v1${req.url.startsWith('/') ? req.url : `/${req.url}`}`;
      }
    }
    next();
  });

  // Global Prefix
  app.setGlobalPrefix('api/v1');

  // Input Validation & Transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // OpenAPI / Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('AurumSave Digital Gold Platform API')
    .setDescription(
      'Enterprise-grade fintech REST API for digital gold savings, BAJUS live benchmark pricing, double-entry vault ledger, KYC compliance, and staff administration in Bangladesh.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Authentication')
    .addTag('Gold Pricing')
    .addTag('Quotes')
    .addTag('Orders')
    .addTag('Payments')
    .addTag('Portfolio')
    .addTag('KYC & Compliance')
    .addTag('Customer Support')
    .addTag('Staff & Administration')
    .addTag('Grounded AI Assistant')
    .addTag('System Health')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/v1/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`================================================================`);
  logger.log(` AurumSave Fintech Core API running on: http://localhost:${port}/api/v1`);
  logger.log(` Swagger OpenAPI Documentation: http://localhost:${port}/api/v1/docs`);
  logger.log(`================================================================`);
}

bootstrap();
