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

    const dataSource = app.get(DataSource);
    await dataSource.query(`UPDATE players SET role = 'admin' WHERE id = $1`, [playerId]);

    const players = await dataSource.query(
      `SELECT email FROM players WHERE id = $1`,
      [playerId],
    ) as Array<{ email: string }>;

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: players[0].email, password: 'password123' });

    adminToken = (loginRes.body as { data?: { access_token?: string } }).data?.access_token ?? aToken;
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
      const res = await request(app.getHttpServer())
        .post('/games')
        .set('Authorization', `Bearer ${adminToken}`)
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
      expect(gameId).toBeDefined();
      const res = await request(app.getHttpServer()).get(`/games/${gameId}`).expect(200);
      expect(res.body.data.id).toBe(gameId);
    });
  });

  describe('PUT /games/:id', () => {
    it('should reject without token', async () => {
      expect(gameId).toBeDefined();
      await request(app.getHttpServer())
        .put(`/games/${gameId}`)
        .send({ name: 'Updated' })
        .expect(401);
    });

    it('should reject non-admin player', async () => {
      expect(gameId).toBeDefined();
      await request(app.getHttpServer())
        .put(`/games/${gameId}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ name: 'Updated' })
        .expect(403);
    });

    it('should update game as admin', async () => {
      expect(gameId).toBeDefined();
      const res = await request(app.getHttpServer())
        .put(`/games/${gameId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Street Fighter 6 Updated' })
        .expect(200);
      expect(res.body.data.name).toBe('Street Fighter 6 Updated');
    });

    it('should return 404 for unknown game', async () => {
      await request(app.getHttpServer())
        .put('/games/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Ghost' })
        .expect(404);
    });
  });

  describe('DELETE /games/:id', () => {
    it('should reject without token', async () => {
      expect(gameId).toBeDefined();
      await request(app.getHttpServer())
        .delete(`/games/${gameId}`)
        .expect(401);
    });

    it('should reject non-admin player', async () => {
      expect(gameId).toBeDefined();
      await request(app.getHttpServer())
        .delete(`/games/${gameId}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(403);
    });

    it('should delete game as admin', async () => {
      // Créer un jeu temporaire pour le supprimer sans affecter les autres tests
      const tmpRes = await request(app.getHttpServer())
        .post('/games')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'To Delete', publisher: 'Del', releaseDate: '2020-01-01', genre: 'Misc' })
        .expect(201);
      const tmpId = (tmpRes.body as { data: { id: string } }).data.id;

      await request(app.getHttpServer())
        .delete(`/games/${tmpId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/games/${tmpId}`)
        .expect(404);
    });
  });
});
