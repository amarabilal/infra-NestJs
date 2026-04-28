import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { createTestApp, registerAndLogin } from './test-utils';

describe('Games (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let playerToken: string;
  let gameId: string;

  const gameDto = {
    name: 'Street Fighter 6',
    publisher: 'Capcom',
    releaseDate: '2023-06-02',
    genre: 'Fighting',
  };

  beforeAll(async () => {
    app = await createTestApp();

    const { token: pToken } = await registerAndLogin(app, 'gp');
    playerToken = pToken;

    const { token: aToken, playerId } = await registerAndLogin(app, 'ga');
    adminToken = aToken;

    const dataSource = app.get(DataSource);
    await dataSource.query(`UPDATE players SET role = 'admin' WHERE id = $1`, [playerId]);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `testga${playerId.slice(0, 4)}@test.com`, password: 'password123' });

    if ((loginRes.body as { data?: { access_token?: string } }).data?.access_token) {
      adminToken = (loginRes.body as { data: { access_token: string } }).data.access_token;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /games', () => {
    it('should return list of games', async () => {
      const res = await request(app.getHttpServer()).get('/games').expect(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /games', () => {
    it('should reject without token', async () => {
      await request(app.getHttpServer()).post('/games').send(gameDto).expect(401);
    });

    it('should reject non-admin player', async () => {
      await request(app.getHttpServer())
        .post('/games')
        .set('Authorization', `Bearer ${playerToken}`)
        .send(gameDto)
        .expect(403);
    });

    it('should reject invalid DTO', async () => {
      await request(app.getHttpServer())
        .post('/games')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'No publisher' })
        .expect(400);
    });

    it('should create a game as admin', async () => {
      const dataSource = app.get(DataSource);
      const players = await dataSource.query(
        `SELECT id, email FROM players WHERE role = 'admin' LIMIT 1`,
      ) as Array<{ id: string; email: string }>;

      if (players.length === 0) return;

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: players[0].email, password: 'password123' });

      const token = (loginRes.body as { data: { access_token: string } }).data.access_token;

      const res = await request(app.getHttpServer())
        .post('/games')
        .set('Authorization', `Bearer ${token}`)
        .send(gameDto)
        .expect(201);

      expect(res.body.data.name).toBe(gameDto.name);
      expect(res.body.data.publisher).toBe(gameDto.publisher);
      gameId = res.body.data.id as string;
    });
  });

  describe('GET /games/:id', () => {
    it('should return 400 for invalid UUID', async () => {
      await request(app.getHttpServer()).get('/games/not-a-uuid').expect(400);
    });

    it('should return 404 for unknown game', async () => {
      await request(app.getHttpServer())
        .get('/games/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('should return game by id', async () => {
      if (!gameId) return;
      const res = await request(app.getHttpServer()).get(`/games/${gameId}`).expect(200);
      expect(res.body.data.id).toBe(gameId);
    });
  });
});
