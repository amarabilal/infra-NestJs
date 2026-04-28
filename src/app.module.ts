import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';
import { AuthModule } from './auth/auth.module';
import { PlayersModule } from './players/players.module';
import { GamesModule } from './games/games.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { MatchesModule } from './matches/matches.module';
import { BracketsModule } from './brackets/brackets.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: databaseConfig,
    }),
    AuthModule,
    PlayersModule,
    GamesModule,
    TournamentsModule,
    MatchesModule,
    BracketsModule,
  ],
})
export class AppModule {}
