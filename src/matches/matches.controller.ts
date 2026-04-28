import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { MatchesService } from './matches.service';
import { SubmitResultDto } from './dto/submit-result.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { Player } from '../players/entities/player.entity';

@ApiTags('Matches')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post(':id/result')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soumettre un résultat de match' })
  @ApiResponse({ status: 400, description: 'Données invalides ou tournoi non démarré' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 409, description: 'Match déjà terminé' })
  submitResult(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitResultDto,
    @CurrentPlayer() player: Player,
  ) {
    return this.matchesService.submitResult(id, dto, player);
  }
}
