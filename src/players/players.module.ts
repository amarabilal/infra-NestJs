import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { Player } from './entities/player.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Player, Tournament])],
  controllers: [PlayersController],
  providers: [PlayersService],
  exports: [PlayersService, TypeOrmModule],
})
export class PlayersModule {}
