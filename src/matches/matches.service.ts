import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match, MatchStatus } from './entities/match.entity';
import { Tournament, TournamentStatus } from '../tournaments/entities/tournament.entity';
import { Player, PlayerRole } from '../players/entities/player.entity';
import { BracketsService } from '../brackets/brackets.service';
import { SubmitResultDto } from './dto/submit-result.dto';

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,
    private readonly bracketsService: BracketsService,
  ) {}

  async findByTournament(tournamentId: string): Promise<Match[]> {
    const tournament = await this.tournamentRepository.findOne({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException(`Tournament ${tournamentId} not found`);

    return this.matchRepository.find({
      where: { tournamentId },
      order: { round: 'ASC', createdAt: 'ASC' },
    });
  }

  async submitResult(
    matchId: string,
    dto: SubmitResultDto,
    currentPlayer: Player,
  ): Promise<Match> {
    const match = await this.matchRepository.findOne({
      where: { id: matchId },
      relations: ['tournament', 'tournament.createdBy'],
    });

    if (!match) throw new NotFoundException(`Match ${matchId} not found`);

    const tournament = match.tournament;

    if (tournament.status !== TournamentStatus.IN_PROGRESS) {
      throw new BadRequestException('Tournament is not in progress');
    }

    if (match.status === MatchStatus.COMPLETED) {
      throw new ConflictException('Match is already completed');
    }

    if (match.isBye) {
      throw new BadRequestException('Cannot submit result for a BYE match');
    }

    this.assertCanSubmitResult(match, tournament, currentPlayer);

    if (dto.winnerId !== match.player1Id && dto.winnerId !== match.player2Id) {
      throw new BadRequestException('Winner must be one of the two players in this match');
    }

    match.winnerId = dto.winnerId;
    match.score = dto.score;
    match.status = MatchStatus.COMPLETED;

    const saved = await this.matchRepository.save(match);

    const winnerPlayer = new Player();
    winnerPlayer.id = dto.winnerId;

    await this.bracketsService.processMatchResult(saved, tournament, winnerPlayer);

    return this.matchRepository.findOne({ where: { id: matchId } }) as Promise<Match>;
  }

  private assertCanSubmitResult(match: Match, tournament: Tournament, player: Player): void {
    if (player.role === PlayerRole.ADMIN) return;
    if (tournament.createdById === player.id) return;
    if (match.player1Id === player.id || match.player2Id === player.id) return;

    throw new ForbiddenException('Only the tournament creator, admin, or match players can submit results');
  }
}
