import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { Match } from './entities/match.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { BracketsModule } from '../brackets/brackets.module';

@Module({
  imports: [TypeOrmModule.forFeature([Match, Tournament]), BracketsModule],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService, TypeOrmModule],
})
export class MatchesModule {}
