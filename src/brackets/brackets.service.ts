import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match, MatchStatus } from '../matches/entities/match.entity';
import { Tournament, TournamentStatus } from '../tournaments/entities/tournament.entity';
import { Player } from '../players/entities/player.entity';

@Injectable()
export class BracketsService {
  constructor(
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,
  ) {}

  async generateFirstRound(tournament: Tournament): Promise<Match[]> {
    const players = this.shuffle([...tournament.players]);
    return this.generateRound(tournament, players, 1);
  }

  private async generateRound(
    tournament: Tournament,
    players: Player[],
    roundNumber: number,
  ): Promise<Match[]> {
    const matches: Partial<Match>[] = [];

    for (let i = 0; i < players.length; i += 2) {
      const player1 = players[i];
      const player2 = players[i + 1];

      if (!player2) {
        // BYE: joueur impair passe automatiquement
        const byeMatch = this.matchRepository.create({
          tournamentId: tournament.id,
          player1Id: player1.id,
          player2Id: undefined,
          round: roundNumber,
          status: MatchStatus.COMPLETED,
          isBye: true,
          winnerId: player1.id,
          score: 'BYE',
        });
        matches.push(byeMatch);
      } else {
        const match = this.matchRepository.create({
          tournamentId: tournament.id,
          player1Id: player1.id,
          player2Id: player2.id,
          round: roundNumber,
          status: MatchStatus.PENDING,
          isBye: false,
        });
        matches.push(match);
      }
    }

    return this.matchRepository.save(matches as Match[]);
  }

  async processMatchResult(
    match: Match,
    tournament: Tournament,
    winner: Player,
  ): Promise<void> {
    const allRoundMatches = await this.matchRepository.find({
      where: { tournamentId: tournament.id, round: match.round },
    });

    const allRoundCompleted = allRoundMatches.every((m) => m.status === MatchStatus.COMPLETED);

    if (!allRoundCompleted) return;

    const winners = allRoundMatches.map((m) => {
      const w = new Player();
      w.id = m.winnerId!;
      return w;
    });

    if (winners.length === 1) {
      await this.finalizeTournament(tournament, winners[0]);
      return;
    }

    const nextRound = match.round + 1;
    await this.generateRound(tournament, winners, nextRound);
  }

  private async finalizeTournament(tournament: Tournament, winner: Player): Promise<void> {
    await this.tournamentRepository.update(tournament.id, {
      status: TournamentStatus.COMPLETED,
      winnerId: winner.id,
    });
  }

  private shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
