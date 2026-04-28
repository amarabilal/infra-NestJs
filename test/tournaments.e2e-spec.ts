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

    const players = await dataSource.query(
      `SELECT id, email FROM players WHERE id = $1 LIMIT 1`,
      [playerId],
    ) as Array<{ id: string; email: string }>;

    if (players.length > 0) {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: players[0].email, password: 'password123' });
      if ((loginRes.body as { data?: { access_token?: string } }).data?.access_token) {
        token = (loginRes.body as { data: { access_token: string } }).data.access_token;
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

    it('should update tournament name as owner', async () => {
      const res = await request(app.getHttpServer())
        .put(`/tournaments/${tournamentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Tournament' })
        .expect(200);
      expect(res.body.data.name).toBe('Updated Tournament');
    });

    it('should update gameId while pending', async () => {
      const game2Res = await request(app.getHttpServer())
        .post('/games')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Game 2', publisher: 'Pub2', releaseDate: '2021-01-01', genre: 'RPG' });
      const game2Id = (game2Res.body as { data: { id: string } }).data.id;

      const res = await request(app.getHttpServer())
        .put(`/tournaments/${tournamentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ gameId: game2Id })
        .expect(200);
      expect(res.body.data.gameId).toBe(game2Id);

      // restore original gameId
      await request(app.getHttpServer())
        .put(`/tournaments/${tournamentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ gameId });
    });

    it('should reject unknown gameId update', async () => {
      await request(app.getHttpServer())
        .put(`/tournaments/${tournamentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ gameId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);
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

  describe('Start tournament', () => {
    let startTournamentId: string;
    let playerA: { token: string; playerId: string };
    let playerB: { token: string; playerId: string };

    beforeAll(async () => {
      playerA = await registerAndLogin(app, 'tsa');
      playerB = await registerAndLogin(app, 'tsb');

      const res = await request(app.getHttpServer())
        .post('/tournaments')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Start Test', maxPlayers: 2, startDate: '2030-01-01T00:00:00Z', gameId })
        .expect(201);
      startTournamentId = (res.body as { data: { id: string } }).data.id;

      await request(app.getHttpServer())
        .post(`/tournaments/${startTournamentId}/join`)
        .set('Authorization', `Bearer ${playerA.token}`);
      await request(app.getHttpServer())
        .post(`/tournaments/${startTournamentId}/join`)
        .set('Authorization', `Bearer ${playerB.token}`);
    });

    it('should reject start by non-owner', async () => {
      await request(app.getHttpServer())
        .put(`/tournaments/${startTournamentId}`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ status: 'in_progress' })
        .expect(403);
    });

    it('should start tournament and generate matches', async () => {
      const res = await request(app.getHttpServer())
        .put(`/tournaments/${startTournamentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'in_progress' })
        .expect(200);

      expect(res.body.data.status).toBe('in_progress');

      const matchesRes = await request(app.getHttpServer())
        .get(`/tournaments/${startTournamentId}/matches`)
        .expect(200);
      expect((matchesRes.body.data as unknown[]).length).toBeGreaterThan(0);
    });

    it('should reject join after tournament started', async () => {
      const extra = await registerAndLogin(app, 'tsex');
      await request(app.getHttpServer())
        .post(`/tournaments/${startTournamentId}/join`)
        .set('Authorization', `Bearer ${extra.token}`)
        .expect(400);
    });

    it('should reject maxPlayers update after start', async () => {
      await request(app.getHttpServer())
        .put(`/tournaments/${startTournamentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ maxPlayers: 8 })
        .expect(400);
    });

    it('should reject startDate update after start', async () => {
      await request(app.getHttpServer())
        .put(`/tournaments/${startTournamentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ startDate: '2031-01-01T00:00:00Z' })
        .expect(400);
    });

    it('should reject gameId update after start', async () => {
      await request(app.getHttpServer())
        .put(`/tournaments/${startTournamentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ gameId: '00000000-0000-0000-0000-000000000001' })
        .expect(400);
    });

    it('should reject delete of started tournament', async () => {
      await request(app.getHttpServer())
        .delete(`/tournaments/${startTournamentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should reject manual set to completed', async () => {
      await request(app.getHttpServer())
        .put(`/tournaments/${startTournamentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'completed' })
        .expect(400);
    });

    it('should reject revert to pending after start', async () => {
      await request(app.getHttpServer())
        .put(`/tournaments/${startTournamentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'pending' })
        .expect(400);
    });
  });

  describe('Start tournament — less than 2 players', () => {
    it('should reject start with 0 players', async () => {
      const res = await request(app.getHttpServer())
        .post('/tournaments')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Empty', maxPlayers: 4, startDate: '2030-01-01T00:00:00Z', gameId })
        .expect(201);
      const emptyId = (res.body as { data: { id: string } }).data.id;

      await request(app.getHttpServer())
        .put(`/tournaments/${emptyId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'in_progress' })
        .expect(400);
    });
  });

  describe('GET /tournaments/:id/matches', () => {
    it('should return empty array before start', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tournaments/${tournamentId}/matches`)
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect((res.body.data as unknown[]).length).toBe(0);
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

    it('should delete pending tournament as owner', async () => {
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
});
