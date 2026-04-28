import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, registerAndLogin } from './test-utils';

describe('Players (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let playerId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const result = await registerAndLogin(app, 'pl');
    token = result.token;
    playerId = result.playerId;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /players', () => {
    it('should return list of players without passwords', async () => {
      const res = await request(app.getHttpServer()).get('/players').expect(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        expect((res.body.data as Array<{ password?: string }>)[0].password).toBeUndefined();
      }
    });
  });

  describe('GET /players/:id', () => {
    it('should return player profile without password', async () => {
      const res = await request(app.getHttpServer()).get(`/players/${playerId}`).expect(200);
      expect(res.body.data.id).toBe(playerId);
      expect(res.body.data.password).toBeUndefined();
    });

    it('should return 404 for unknown player', async () => {
      await request(app.getHttpServer())
        .get('/players/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app.getHttpServer()).get('/players/not-a-uuid').expect(400);
    });
  });

  describe('GET /players/:id/tournaments', () => {
    it('should return tournaments for player', async () => {
      const res = await request(app.getHttpServer())
        .get(`/players/${playerId}/tournaments`)
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 404 for unknown player', async () => {
      await request(app.getHttpServer())
        .get('/players/00000000-0000-0000-0000-000000000000/tournaments')
        .expect(404);
    });
  });

  describe('GET /players/:id/stats', () => {
    it('should return player stats', async () => {
      const res = await request(app.getHttpServer())
        .get(`/players/${playerId}/stats`)
        .expect(200);
      expect(res.body.data.totalTournaments).toBeDefined();
      expect(res.body.data.winRate).toBeDefined();
    });
  });

  describe('PUT /players/:id', () => {
    it('should reject update without token', async () => {
      await request(app.getHttpServer())
        .put(`/players/${playerId}`)
        .send({ username: 'newname' })
        .expect(401);
    });

    it('should update own profile', async () => {
      const res = await request(app.getHttpServer())
        .put(`/players/${playerId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ username: `updated_${Date.now()}` })
        .expect(200);
      expect(res.body.data.password).toBeUndefined();
    });
  });
});
