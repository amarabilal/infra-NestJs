import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { GamesService } from './games.service';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PlayerRole } from '../players/entities/player.entity';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';

@ApiTags('Games')
@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get()
  @ApiOperation({ summary: 'Liste de tous les jeux' })
  findAll() {
    return this.gamesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un jeu' })
  @ApiResponse({ status: 404, description: 'Jeu non trouvé' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.gamesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlayerRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ajouter un jeu (admin uniquement)' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  create(@Body() dto: CreateGameDto) {
    return this.gamesService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlayerRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Modifier un jeu (admin uniquement)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGameDto) {
    return this.gamesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlayerRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un jeu (admin uniquement)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.gamesService.remove(id);
  }
}
