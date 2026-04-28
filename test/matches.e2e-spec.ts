import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { createTestApp, registerAndLogin } from './test-utils';

describe('Matches (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let player1Token: string;
  let player1Id: string;
  let player2Token: string;
  let player2Id: string;
  let outsiderToken: string;
  let tournamentId: string;
  let matchId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const r1 = await registerAndLogin(app, 'm1');
    adminToken = r1.token;
    player1Id = r1.playerId;

    const r2 = await registerAndLogin(app, 'm2');
    player1Token = r2.token;
    player2Id = r2.playerId;

    const r3 = await registerAndLogin(app, 'm3');
    player2Token = r3.token;

    const r4 = await registerAndLogin(app, 'm4');
    outsiderToken = r4.token;

    const dataSource = app.get(DataSource);
    await dataSource.query(`UPDATE players SET role = 'admin' WHERE id = $1`, [player1Id]);

    const players = await dataSource.query(
      `SELECT id, email FROM players WHERE id = $1`,
      [player1Id],
    ) as Array<{ id: string; email: string }>;

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: players[0].email, password: 'password123' });
    adminToken = (loginRes.body as { data: { access_token: string } }).data.access_token;

    const gameRes = await request(app.getHttpServer())
      .post('/games')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Match Game', publisher: 'Pub', releaseDate: '2020-01-01', genre: 'Sport' });
    const gameId = (gameRes.body as { data: { id: string } }).data.id;

    const tournRes = await request(app.getHttpServer())
      .post('/tournaments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Match Test', maxPlayers: 2, startDate: '2030-01-01T00:00:00Z', gameId });
    tournamentId = (tournRes.body as { data: { id: string } }).data.id;

    await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/join`)
      .set('Authorization', `Bearer ${player1Token}`);

    await request(app.getHttpServer())
      .post(`/tournaments/${tournamentId}/join`)
      .set('Authorization', `Bearer ${player2Token}`);

    await request(app.getHttpServer())
      .put(`/tournaments/${tournamentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'in_progress' });

    const matchesRes = await request(app.getHttpServer())
      .get(`/tournaments/${tournamentId}/matches`);
    const matches = (matchesRes.body as { data: Array<{ id: string; isBye: boolean }> }).data;
    const realMatch = matches.find((m) => !m.isBye);
    if (realMatch) matchId = realMatch.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /tournaments/:id/matches', () => {
    it('should return matches after tournament start', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tournaments/${tournamentId}/matches`)
        .expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should return 404 for unknown tournament', async () => {
      await request(app.getHttpServer())
        .get('/tournaments/00000000-0000-0000-0000-000000000000/matches')
        .expect(404);
    });
  });

  describe('POST /matches/:id/result', () => {
    it('should reject without token', async () => {
      if (!matchId) return;
      await request(app.getHttpServer())
        .post(`/matches/${matchId}/result`)
        .send({ winnerId: player2Id, score: '3-1' })
        .expect(401);
    });

    it('should reject outsider player', async () => {
      if (!matchId) return;
      await request(app.getHttpServer())
        .post(`/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ winnerId: player2Id, score: '3-1' })
        .expect(403);
    });

    it('should reject invalid winnerId', async () => {
      if (!matchId) return;
      await request(app.getHttpServer())
        .post(`/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ winnerId: '00000000-0000-0000-0000-000000000000', score: '3-1' })
        .expect(400);
    });

    it('should submit result as tournament creator', async () => {
      if (!matchId) return;

      const matchRes = await request(app.getHttpServer())
        .get(`/tournaments/${tournamentId}/matches`);
      const matches = (matchRes.body as { data: Array<{ id: string; player1Id: string; isBye: boolean }> }).data;
      const match = matches.find((m) => m.id === matchId);
      if (!match) return;

      const res = await request(app.getHttpServer())
        .post(`/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ winnerId: match.player1Id, score: '3-1' })
        .expect(201);

      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.winnerId).toBe(match.player1Id);
    });

    it('should reject result on already completed match', async () => {
      if (!matchId) return;

      const matchRes = await request(app.getHttpServer())
        .get(`/tournaments/${tournamentId}/matches`);
      const match = (matchRes.body as { data: Array<{ id: string; player1Id: string }> }).data.find((m) => m.id === matchId);
      if (!match) return;

      await request(app.getHttpServer())
        .post(`/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ winnerId: match.player1Id, score: '2-0' })
        .expect(409);
    });
  });
});
