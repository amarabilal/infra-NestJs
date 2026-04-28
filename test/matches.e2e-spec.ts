import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { createTestApp, registerAndLogin } from './test-utils';

describe('Matches (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let adminPlayerId: string;
  let player1Token: string;
  let player1Id: string;
  let player2Token: string;
  let player2Id: string;
  let outsiderToken: string;
  let tournamentId: string;
  let matchId: string;

  beforeAll(async () => {
    app = await createTestApp();

    // r1 → futur admin et créateur du tournoi
    const r1 = await registerAndLogin(app, 'm1');
    adminPlayerId = r1.playerId;

    // r2 et r3 → joueurs du match
    const r2 = await registerAndLogin(app, 'm2');
    player1Token = r2.token;
    player1Id = r2.playerId;

    const r3 = await registerAndLogin(app, 'm3');
    player2Token = r3.token;
    player2Id = r3.playerId;

    const r4 = await registerAndLogin(app, 'm4');
    outsiderToken = r4.token;

    // Élever r1 en admin et récupérer un token à jour
    const dataSource = app.get(DataSource);
    await dataSource.query(`UPDATE players SET role = 'admin' WHERE id = $1`, [adminPlayerId]);

    const players = await dataSource.query(
      `SELECT email FROM players WHERE id = $1`,
      [adminPlayerId],
    ) as Array<{ email: string }>;

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: players[0].email, password: 'password123' });
    adminToken = (loginRes.body as { data: { access_token: string } }).data.access_token;

    // Créer jeu + tournoi 2 joueurs
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
      expect((res.body.data as unknown[]).length).toBeGreaterThan(0);
    });

    it('should return 404 for unknown tournament', async () => {
      await request(app.getHttpServer())
        .get('/tournaments/00000000-0000-0000-0000-000000000000/matches')
        .expect(404);
    });
  });

  describe('POST /matches/:id/result', () => {
    it('should reject without token', async () => {
      expect(matchId).toBeDefined();
      await request(app.getHttpServer())
        .post(`/matches/${matchId}/result`)
        .send({ winnerId: player1Id, score: '3-1' })
        .expect(401);
    });

    it('should reject outsider player', async () => {
      expect(matchId).toBeDefined();
      await request(app.getHttpServer())
        .post(`/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ winnerId: player1Id, score: '3-1' })
        .expect(403);
    });

    it('should reject invalid winnerId (not a match player)', async () => {
      expect(matchId).toBeDefined();
      await request(app.getHttpServer())
        .post(`/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ winnerId: '00000000-0000-0000-0000-000000000000', score: '3-1' })
        .expect(400);
    });

    it('should accept result from a match player', async () => {
      expect(matchId).toBeDefined();
      const matchRes = await request(app.getHttpServer())
        .get(`/tournaments/${tournamentId}/matches`);
      const match = (matchRes.body as { data: Array<{ id: string; player1Id: string }> }).data
        .find((m) => m.id === matchId);
      expect(match).toBeDefined();

      const res = await request(app.getHttpServer())
        .post(`/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${player1Token}`)
        .send({ winnerId: match!.player1Id, score: '3-1' })
        .expect(201);

      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.winnerId).toBe(match!.player1Id);
    });

    it('should reject result on already completed match', async () => {
      expect(matchId).toBeDefined();
      const matchRes = await request(app.getHttpServer())
        .get(`/tournaments/${tournamentId}/matches`);
      const match = (matchRes.body as { data: Array<{ id: string; player1Id: string }> }).data
        .find((m) => m.id === matchId);

      await request(app.getHttpServer())
        .post(`/matches/${matchId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ winnerId: match!.player1Id, score: '2-0' })
        .expect(409);
    });
  });

  describe('Tournament finalization (2 players)', () => {
    it('should finalize tournament after last match result', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tournaments/${tournamentId}`)
        .expect(200);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.winnerId).toBeDefined();
    });
  });

  describe('Bracket progression (4 players, multi-round)', () => {
    let bracketTournamentId: string;
    let bracketAdminToken: string;

    beforeAll(async () => {
      const dataSource = app.get(DataSource);

      const admin = await registerAndLogin(app, 'br_adm');
      await dataSource.query(`UPDATE players SET role = 'admin' WHERE id = $1`, [admin.playerId]);
      const players = await dataSource.query(
        `SELECT email FROM players WHERE id = $1`,
        [admin.playerId],
      ) as Array<{ email: string }>;
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: players[0].email, password: 'password123' });
      bracketAdminToken = (loginRes.body as { data: { access_token: string } }).data.access_token;

      const gameRes = await request(app.getHttpServer())
        .post('/games')
        .set('Authorization', `Bearer ${bracketAdminToken}`)
        .send({ name: 'Bracket Game', publisher: 'BPub', releaseDate: '2020-01-01', genre: 'FPS' });
      const bracketGameId = (gameRes.body as { data: { id: string } }).data.id;

      const tRes = await request(app.getHttpServer())
        .post('/tournaments')
        .set('Authorization', `Bearer ${bracketAdminToken}`)
        .send({ name: 'Bracket Test', maxPlayers: 4, startDate: '2030-01-01T00:00:00Z', gameId: bracketGameId });
      bracketTournamentId = (tRes.body as { data: { id: string } }).data.id;

      // 4 joueurs rejoignent
      for (let i = 0; i < 4; i++) {
        const p = await registerAndLogin(app, `brp${i}`);
        await request(app.getHttpServer())
          .post(`/tournaments/${bracketTournamentId}/join`)
          .set('Authorization', `Bearer ${p.token}`);
      }

      // Démarrage
      await request(app.getHttpServer())
        .put(`/tournaments/${bracketTournamentId}`)
        .set('Authorization', `Bearer ${bracketAdminToken}`)
        .send({ status: 'in_progress' });
    });

    it('should generate 2 matches in round 1', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tournaments/${bracketTournamentId}/matches`)
        .expect(200);
      const round1 = (res.body.data as Array<{ round: number }>).filter((m) => m.round === 1);
      expect(round1.length).toBe(2);
    });

    it('should generate round 2 after round 1 completed', async () => {
      const matchesRes = await request(app.getHttpServer())
        .get(`/tournaments/${bracketTournamentId}/matches`);
      const round1 = (matchesRes.body.data as Array<{ id: string; round: number; player1Id: string; isBye: boolean }>)
        .filter((m) => m.round === 1 && !m.isBye);

      // Soumettre les résultats du round 1
      for (const m of round1) {
        await request(app.getHttpServer())
          .post(`/matches/${m.id}/result`)
          .set('Authorization', `Bearer ${bracketAdminToken}`)
          .send({ winnerId: m.player1Id, score: '2-1' })
          .expect(201);
      }

      const allMatchesRes = await request(app.getHttpServer())
        .get(`/tournaments/${bracketTournamentId}/matches`);
      const round2 = (allMatchesRes.body.data as Array<{ round: number }>).filter((m) => m.round === 2);
      expect(round2.length).toBe(1);
    });

    it('should finalize tournament after round 2', async () => {
      const matchesRes = await request(app.getHttpServer())
        .get(`/tournaments/${bracketTournamentId}/matches`);
      const round2 = (matchesRes.body.data as Array<{ id: string; round: number; player1Id: string; isBye: boolean }>)
        .filter((m) => m.round === 2 && !m.isBye);

      for (const m of round2) {
        await request(app.getHttpServer())
          .post(`/matches/${m.id}/result`)
          .set('Authorization', `Bearer ${bracketAdminToken}`)
          .send({ winnerId: m.player1Id, score: '2-0' })
          .expect(201);
      }

      const tournRes = await request(app.getHttpServer())
        .get(`/tournaments/${bracketTournamentId}`)
        .expect(200);
      expect(tournRes.body.data.status).toBe('completed');
      expect(tournRes.body.data.winnerId).toBeDefined();
    });
  });

  describe('BYE match (3 players — odd number)', () => {
    let byeTournamentId: string;
    let byeAdminToken: string;

    beforeAll(async () => {
      const dataSource = app.get(DataSource);

      const admin = await registerAndLogin(app, 'bye_adm');
      await dataSource.query(`UPDATE players SET role = 'admin' WHERE id = $1`, [admin.playerId]);
      const players = await dataSource.query(
        `SELECT email FROM players WHERE id = $1`,
        [admin.playerId],
      ) as Array<{ email: string }>;
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: players[0].email, password: 'password123' });
      byeAdminToken = (loginRes.body as { data: { access_token: string } }).data.access_token;

      const gameRes = await request(app.getHttpServer())
        .post('/games')
        .set('Authorization', `Bearer ${byeAdminToken}`)
        .send({ name: 'BYE Game', publisher: 'BPub', releaseDate: '2020-01-01', genre: 'RPG' });
      const byeGameId = (gameRes.body as { data: { id: string } }).data.id;

      const tRes = await request(app.getHttpServer())
        .post('/tournaments')
        .set('Authorization', `Bearer ${byeAdminToken}`)
        .send({ name: 'BYE Test', maxPlayers: 4, startDate: '2030-01-01T00:00:00Z', gameId: byeGameId });
      byeTournamentId = (tRes.body as { data: { id: string } }).data.id;

      for (let i = 0; i < 3; i++) {
        const p = await registerAndLogin(app, `byep${i}`);
        await request(app.getHttpServer())
          .post(`/tournaments/${byeTournamentId}/join`)
          .set('Authorization', `Bearer ${p.token}`);
      }

      await request(app.getHttpServer())
        .put(`/tournaments/${byeTournamentId}`)
        .set('Authorization', `Bearer ${byeAdminToken}`)
        .send({ status: 'in_progress' });
    });

    it('should create a BYE match for the odd player', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tournaments/${byeTournamentId}/matches`)
        .expect(200);
      const byeMatch = (res.body.data as Array<{ isBye: boolean; status: string }>).find((m) => m.isBye);
      expect(byeMatch).toBeDefined();
      expect(byeMatch!.status).toBe('completed');
    });

    it('should reject result submission for a BYE match', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tournaments/${byeTournamentId}/matches`);
      const byeMatch = (res.body.data as Array<{ id: string; isBye: boolean; player1Id: string }>).find((m) => m.isBye);
      expect(byeMatch).toBeDefined();

      await request(app.getHttpServer())
        .post(`/matches/${byeMatch!.id}/result`)
        .set('Authorization', `Bearer ${byeAdminToken}`)
        .send({ winnerId: byeMatch!.player1Id, score: 'BYE' })
        .expect(400);
    });
  });
});
