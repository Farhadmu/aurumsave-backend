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
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      process.env.FRONTEND_URL || '',
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key'],
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
