import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { createTestApp, registerAndLogin } from './test-utils';

describe('Tournaments (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let playerId: string;
  let token2: string;
  let gameId: string;
  let tournamentId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const r1 = await registerAndLogin(app, 't1');
    token = r1.token;
    playerId = r1.playerId;

    const r2 = await registerAndLogin(app, 't2');
    token2 = r2.token;

    const dataSource = app.get(DataSource);
    await dataSource.query(`UPDATE players SET role = 'admin' WHERE id = $1`, [playerId]);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `testt1${Date.now() - 1}@test.com`,
        password: 'password123',
      });

    const players = await dataSource.query(
      `SELECT id, email FROM players WHERE id = $1 LIMIT 1`,
      [playerId],
    ) as Array<{ id: string; email: string }>;

    if (players.length > 0) {
      const loginRes2 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: players[0].email, password: 'password123' });
      if ((loginRes2.body as { data?: { access_token?: string } }).data?.access_token) {
        token = (loginRes2.body as { data: { access_token: string } }).data.access_token;
      }
    }

    const gameRes = await request(app.getHttpServer())
      .post('/games')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Game', publisher: 'TestPub', releaseDate: '2020-01-01', genre: 'FPS' });
    gameId = (gameRes.body as { data: { id: string } }).data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /tournaments', () => {
    it('should return list of tournaments', async () => {
      const res = await request(app.getHttpServer()).get('/tournaments').expect(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/tournaments?status=pending')
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should reject invalid status filter', async () => {
      await request(app.getHttpServer()).get('/tournaments?status=invalid').expect(400);
    });
  });

  describe('POST /tournaments', () => {
    it('should reject without token', async () => {
      await request(app.getHttpServer())
        .post('/tournaments')
        .send({ name: 'T', maxPlayers: 4, startDate: '2030-01-01', gameId })
        .expect(401);
    });

    it('should create tournament', async () => {
      const res = await request(app.getHttpServer())
        .post('/tournaments')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Tournament', maxPlayers: 4, startDate: '2030-01-01T00:00:00Z', gameId })
        .expect(201);

      expect(res.body.data.status).toBe('pending');
      tournamentId = res.body.data.id as string;
    });

    it('should reject maxPlayers < 2', async () => {
      await request(app.getHttpServer())
        .post('/tournaments')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bad', maxPlayers: 1, startDate: '2030-01-01', gameId })
        .expect(400);
    });

    it('should reject unknown gameId', async () => {
      await request(app.getHttpServer())
        .post('/tournaments')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'NoGame', maxPlayers: 4, startDate: '2030-01-01', gameId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);
    });
  });

  describe('GET /tournaments/:id', () => {
    it('should return tournament detail', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tournaments/${tournamentId}`)
        .expect(200);
      expect(res.body.data.id).toBe(tournamentId);
    });

    it('should return 404 for unknown tournament', async () => {
      await request(app.getHttpServer())
        .get('/tournaments/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app.getHttpServer()).get('/tournaments/not-a-uuid').expect(400);
    });
  });

  describe('PUT /tournaments/:id', () => {
    it('should reject update without token', async () => {
      await request(app.getHttpServer())
        .put(`/tournaments/${tournamentId}`)
        .send({ name: 'Updated' })
        .expect(401);
    });

    it('should reject update by non-owner', async () => {
      await request(app.getHttpServer())
        .put(`/tournaments/${tournamentId}`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ name: 'Hijacked' })
        .expect(403);
    });

    it('should update tournament as owner', async () => {
      const res = await request(app.getHttpServer())
        .put(`/tournaments/${tournamentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Tournament' })
        .expect(200);
      expect(res.body.data.name).toBe('Updated Tournament');
    });
  });

  describe('POST /tournaments/:id/join', () => {
    it('should reject join without token', async () => {
      await request(app.getHttpServer())
        .post(`/tournaments/${tournamentId}/join`)
        .expect(401);
    });

    it('should join tournament', async () => {
      await request(app.getHttpServer())
        .post(`/tournaments/${tournamentId}/join`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(201);
    });

    it('should reject duplicate join', async () => {
      await request(app.getHttpServer())
        .post(`/tournaments/${tournamentId}/join`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(409);
    });

    it('should reject when tournament is full', async () => {
      const r3 = await registerAndLogin(app, 'tf3');
      const r4 = await registerAndLogin(app, 'tf4');

      await request(app.getHttpServer())
        .post(`/tournaments/${tournamentId}/join`)
        .set('Authorization', `Bearer ${token}`)
        .send();

      await request(app.getHttpServer())
        .post(`/tournaments/${tournamentId}/join`)
        .set('Authorization', `Bearer ${r3.token}`)
        .send();

      await request(app.getHttpServer())
        .post(`/tournaments/${tournamentId}/join`)
        .set('Authorization', `Bearer ${r4.token}`)
        .expect(400);
    });
  });

  describe('DELETE /tournaments/:id', () => {
    it('should reject delete without token', async () => {
      await request(app.getHttpServer())
        .delete(`/tournaments/${tournamentId}`)
        .expect(401);
    });

    it('should reject delete by non-owner', async () => {
      await request(app.getHttpServer())
        .delete(`/tournaments/${tournamentId}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(403);
    });

    it('should delete tournament as owner', async () => {
      const newTournament = await request(app.getHttpServer())
        .post('/tournaments')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'To Delete', maxPlayers: 4, startDate: '2030-01-01T00:00:00Z', gameId });

      const idToDelete = (newTournament.body as { data: { id: string } }).data.id;

      await request(app.getHttpServer())
        .delete(`/tournaments/${idToDelete}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });
  });

  describe('GET /tournaments/:id/matches', () => {
    it('should return matches (empty before start)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tournaments/${tournamentId}/matches`)
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
