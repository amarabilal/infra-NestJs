import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-utils';

describe('App (e2e) - Health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should have Swagger available at /api', async () => {
    const res = await request(app.getHttpServer()).get('/api').expect(200);
    expect(res.text).toContain('Swagger');
  });

  it('should return 400 for invalid UUID in any route', async () => {
    await request(app.getHttpServer()).get('/players/not-uuid').expect(400);
  });
});
