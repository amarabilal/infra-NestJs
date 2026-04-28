import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TournamentsService } from './tournaments.service';
import { MatchesService } from '../matches/matches.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { TournamentQueryDto } from './dto/tournament-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { Player } from '../players/entities/player.entity';

@ApiTags('Tournaments')
@Controller('tournaments')
export class TournamentsController {
  constructor(
    private readonly tournamentsService: TournamentsService,
    private readonly matchesService: MatchesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liste des tournois (filtrable par statut)' })
  findAll(@Query() query: TournamentQueryDto) {
    return this.tournamentsService.findAll(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer un tournoi (authentifié)' })
  @ApiResponse({ status: 404, description: 'Jeu non trouvé' })
  create(@Body() dto: CreateTournamentDto, @CurrentPlayer() player: Player) {
    return this.tournamentsService.create(dto, player);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un tournoi' })
  @ApiResponse({ status: 404, description: 'Tournoi non trouvé' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tournamentsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Modifier un tournoi (créateur ou admin)' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTournamentDto,
    @CurrentPlayer() player: Player,
  ) {
    return this.tournamentsService.update(id, dto, player);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un tournoi (créateur ou admin, statut pending uniquement)' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 400, description: 'Tournoi déjà démarré' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentPlayer() player: Player) {
    return this.tournamentsService.remove(id, player);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'S\'inscrire à un tournoi' })
  @ApiResponse({ status: 400, description: 'Tournoi plein ou déjà démarré' })
  @ApiResponse({ status: 409, description: 'Déjà inscrit' })
  join(@Param('id', ParseUUIDPipe) id: string, @CurrentPlayer() player: Player) {
    return this.tournamentsService.join(id, player);
  }

  @Get(':id/matches')
  @ApiOperation({ summary: 'Liste des matchs d\'un tournoi' })
  @ApiResponse({ status: 404, description: 'Tournoi non trouvé' })
  findMatches(@Param('id', ParseUUIDPipe) id: string) {
    return this.matchesService.findByTournament(id);
  }
}
