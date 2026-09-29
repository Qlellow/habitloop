import { Logger } from '@nestjs/common';
import { createApp } from './app';

async function bootstrap() {
  const app = await createApp();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  new Logger('Bootstrap').log(`루프 API: http://localhost:${port}/api`);
}

void bootstrap();
