import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';
import { Tournament } from './entities/tournament.entity';
import { Player } from '../players/entities/player.entity';
import { Game } from '../games/entities/game.entity';
import { BracketsModule } from '../brackets/brackets.module';
import { MatchesModule } from '../matches/matches.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tournament, Player, Game]),
    BracketsModule,
    forwardRef(() => MatchesModule),
  ],
  controllers: [TournamentsController],
  providers: [TournamentsService],
  exports: [TournamentsService, TypeOrmModule],
})
export class TournamentsModule {}
