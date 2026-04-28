import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BracketsService } from './brackets.service';
import { Match } from '../matches/entities/match.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Match, Tournament])],
  providers: [BracketsService],
  exports: [BracketsService],
})
export class BracketsModule {}
