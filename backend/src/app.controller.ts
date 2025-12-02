import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHello(): object {
    return {
      message: '0Sync API',
      version: '0.1.0',
      status: 'ok',
    };
  }

  @Get('health')
  getHealth(): object {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}
