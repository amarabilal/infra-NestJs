import { INestApplication, ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { PlayersModule } from '../src/players/players.module';
import { GamesModule } from '../src/games/games.module';
import { TournamentsModule } from '../src/tournaments/tournaments.module';
import { MatchesModule } from '../src/matches/matches.module';
import { BracketsModule } from '../src/brackets/brackets.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
        username: process.env.DB_USERNAME ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'postgres',
        database: process.env.DB_NAME ?? 'tournament_test_db',
        entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
        synchronize: true,
        dropSchema: true,
      }),
      AuthModule,
      PlayersModule,
      GamesModule,
      TournamentsModule,
      MatchesModule,
      BracketsModule,
    ],
  }).compile();

  const app = moduleFixture.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new ResponseInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  await app.init();
  return app;
}

export async function registerAndLogin(
  app: INestApplication,
  suffix = '',
): Promise<{ token: string; playerId: string }> {
  const username = `testuser${suffix}${Date.now()}`;
  const email = `test${suffix}${Date.now()}@test.com`;

  await request(app.getHttpServer())
    .post('/auth/register')
    .send({ username, email, password: 'password123' });

  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: 'password123' });

  return {
    token: (res.body as { data: { access_token: string } }).data.access_token,
    playerId: (res.body as { data: { player: { id: string } } }).data.player.id,
  };
}

export async function createAdminAndLogin(
  app: INestApplication,
): Promise<{ token: string; playerId: string }> {
  const { token: adminToken, playerId } = await registerAndLogin(app, 'admin');

  const dataSource = app.get('DataSource') as { getRepository: (entity: unknown) => { update: (id: string, data: object) => Promise<void> } };
  const playerRepo = dataSource.getRepository('players');
  await playerRepo.update(playerId, { role: 'admin' });

  const email = `testadmin${Date.now()}@test.com`;
  const res2 = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: 'password123' });

  return { token: (res2.body as { data: { access_token: string } })?.data?.access_token ?? adminToken, playerId };
}
