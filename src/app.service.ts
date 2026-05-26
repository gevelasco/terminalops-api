import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      service: 'terminalops-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
