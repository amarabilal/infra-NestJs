import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-utils';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should register a new player', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'testplayer', email: 'test@test.com', password: 'password123' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.access_token).toBeDefined();
      expect(res.body.data.player.password).toBeUndefined();
    });

    it('should reject duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'player2', email: 'dup@test.com', password: 'password123' });

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'player3', email: 'dup@test.com', password: 'password123' })
        .expect(409);
    });

    it('should reject invalid payload (no email)', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'noemail', password: 'password123' })
        .expect(400);
    });

    it('should reject short password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'weakpwd', email: 'weak@test.com', password: '123' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login and return JWT', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'loginuser', email: 'login@test.com', password: 'password123' });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'login@test.com', password: 'password123' })
        .expect(200);

      expect(res.body.data.access_token).toBeDefined();
      expect(res.body.data.player.password).toBeUndefined();
    });

    it('should reject wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'login@test.com', password: 'wrongpassword' })
        .expect(401);
    });

    it('should reject unknown email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'unknown@test.com', password: 'password123' })
        .expect(401);
    });

    it('should reject access to protected route without token', async () => {
      await request(app.getHttpServer())
        .post('/tournaments')
        .send({ name: 'Test', maxPlayers: 4, startDate: '2030-01-01', gameId: '00000000-0000-0000-0000-000000000000' })
        .expect(401);
    });
  });
});
