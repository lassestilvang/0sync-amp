import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { logger } from './common/logger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const httpAdapterHost = app.get(HttpAdapterHost);

  // Security headers
  app.use(helmet());

  // Global filters
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('0Sync API')
    .setDescription('The 0Sync bi-directional synchronization platform API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: configService.get('FRONTEND_URL'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    exposedHeaders: ['Content-Length', 'x-request-id'],
    maxAge: 3600,
  });

  const port = configService.get('API_PORT', 3000);
  await app.listen(port);
  logger.info(`Server running on port ${port}`);
}

bootstrap().catch((error) => {
  logger.error(error, 'Bootstrap failed');
  process.exit(1);
});
