import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PlayersService } from './players.service';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { Player } from './entities/player.entity';

@ApiTags('Players')
@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  @ApiOperation({ summary: 'Liste de tous les joueurs' })
  findAll() {
    return this.playersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Profil d\'un joueur' })
  @ApiResponse({ status: 404, description: 'Joueur non trouvé' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.playersService.findOne(id);
  }

  @Get(':id/tournaments')
  @ApiOperation({ summary: 'Tournois participés par un joueur' })
  @ApiResponse({ status: 404, description: 'Joueur non trouvé' })
  findTournaments(@Param('id', ParseUUIDPipe) id: string) {
    return this.playersService.findTournaments(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Statistiques d\'un joueur (bonus)' })
  @ApiResponse({ status: 404, description: 'Joueur non trouvé' })
  getStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.playersService.getStats(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Modifier son profil' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlayerDto,
    @CurrentPlayer() currentPlayer: Player,
  ) {
    return this.playersService.update(id, dto, currentPlayer);
  }
}
