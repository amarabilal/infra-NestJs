import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament, TournamentStatus } from './entities/tournament.entity';
import { Player, PlayerRole } from '../players/entities/player.entity';
import { Game } from '../games/entities/game.entity';
import { BracketsService } from '../brackets/brackets.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { TournamentQueryDto } from './dto/tournament-query.dto';

@Injectable()
export class TournamentsService {
  constructor(
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
    private readonly bracketsService: BracketsService,
  ) {}

  async findAll(query: TournamentQueryDto): Promise<Tournament[]> {
    const qb = this.tournamentRepository
      .createQueryBuilder('tournament')
      .leftJoinAndSelect('tournament.game', 'game')
      .leftJoinAndSelect('tournament.createdBy', 'createdBy')
      .select([
        'tournament',
        'game',
        'createdBy.id',
        'createdBy.username',
        'createdBy.email',
        'createdBy.role',
        'createdBy.createdAt',
      ]);

    if (query.status) {
      qb.where('tournament.status = :status', { status: query.status });
    }

    return qb.orderBy('tournament.createdAt', 'DESC').getMany();
  }

  async findOne(id: string): Promise<Tournament> {
    const tournament = await this.tournamentRepository
      .createQueryBuilder('tournament')
      .leftJoinAndSelect('tournament.game', 'game')
      .leftJoinAndSelect('tournament.createdBy', 'createdBy')
      .leftJoinAndSelect('tournament.players', 'players')
      .leftJoinAndSelect('tournament.winner', 'winner')
      .where('tournament.id = :id', { id })
      .select([
        'tournament',
        'game',
        'createdBy.id',
        'createdBy.username',
        'createdBy.email',
        'createdBy.role',
        'createdBy.createdAt',
        'players.id',
        'players.username',
        'players.email',
        'players.role',
        'players.createdAt',
        'winner.id',
        'winner.username',
      ])
      .getOne();

    if (!tournament) throw new NotFoundException(`Tournament ${id} not found`);
    return tournament;
  }

  async create(dto: CreateTournamentDto, creator: Player): Promise<Tournament> {
    const game = await this.gameRepository.findOne({ where: { id: dto.gameId } });
    if (!game) throw new NotFoundException(`Game ${dto.gameId} not found`);

    const tournament = this.tournamentRepository.create({
      name: dto.name,
      maxPlayers: dto.maxPlayers,
      startDate: new Date(dto.startDate),
      gameId: dto.gameId,
      createdById: creator.id,
      status: TournamentStatus.PENDING,
    });

    return this.tournamentRepository.save(tournament);
  }

  async update(id: string, dto: UpdateTournamentDto, currentPlayer: Player): Promise<Tournament> {
    const tournament = await this.findOne(id);
    this.assertOwnerOrAdmin(tournament, currentPlayer);

    if (
      tournament.status !== TournamentStatus.PENDING &&
      (dto.maxPlayers !== undefined || dto.startDate !== undefined)
    ) {
      throw new BadRequestException('Cannot modify maxPlayers or startDate after tournament has started');
    }

    if (dto.status === TournamentStatus.IN_PROGRESS) {
      return this.startTournament(tournament, currentPlayer);
    }

    if (dto.status === TournamentStatus.COMPLETED) {
      throw new BadRequestException('Cannot manually set tournament to completed');
    }

    if (dto.name !== undefined) tournament.name = dto.name;
    if (dto.maxPlayers !== undefined) tournament.maxPlayers = dto.maxPlayers;
    if (dto.startDate !== undefined) tournament.startDate = new Date(dto.startDate);

    return this.tournamentRepository.save(tournament);
  }

  async remove(id: string, currentPlayer: Player): Promise<void> {
    const tournament = await this.findOne(id);
    this.assertOwnerOrAdmin(tournament, currentPlayer);

    if (tournament.status !== TournamentStatus.PENDING) {
      throw new BadRequestException('Cannot delete a tournament that has already started or completed');
    }

    await this.tournamentRepository.remove(tournament);
  }

  async join(id: string, player: Player): Promise<Tournament> {
    const tournament = await this.tournamentRepository
      .createQueryBuilder('tournament')
      .leftJoinAndSelect('tournament.players', 'players')
      .where('tournament.id = :id', { id })
      .getOne();

    if (!tournament) throw new NotFoundException(`Tournament ${id} not found`);

    if (tournament.status !== TournamentStatus.PENDING) {
      throw new BadRequestException('Cannot join a tournament that is in progress or completed');
    }

    const alreadyJoined = tournament.players.some((p) => p.id === player.id);
    if (alreadyJoined) {
      throw new ConflictException('Player already registered in this tournament');
    }

    if (tournament.players.length >= tournament.maxPlayers) {
      throw new BadRequestException('Tournament is full');
    }

    tournament.players.push(player);
    await this.tournamentRepository.save(tournament);

    return this.findOne(id);
  }

  private async startTournament(tournament: Tournament, currentPlayer: Player): Promise<Tournament> {
    this.assertOwnerOrAdmin(tournament, currentPlayer);

    if (tournament.status !== TournamentStatus.PENDING) {
      throw new BadRequestException('Tournament is not in pending status');
    }

    const fullTournament = await this.tournamentRepository
      .createQueryBuilder('tournament')
      .leftJoinAndSelect('tournament.players', 'players')
      .where('tournament.id = :id', { id: tournament.id })
      .getOne();

    if (!fullTournament) throw new NotFoundException(`Tournament ${tournament.id} not found`);

    const playerCount = fullTournament.players.length;
    if (playerCount < 2) {
      throw new BadRequestException('Tournament needs at least 2 players to start');
    }

    fullTournament.status = TournamentStatus.IN_PROGRESS;
    await this.tournamentRepository.save(fullTournament);

    await this.bracketsService.generateFirstRound(fullTournament);

    return this.findOne(fullTournament.id);
  }

  private assertOwnerOrAdmin(tournament: Tournament, player: Player): void {
    if (player.role === PlayerRole.ADMIN) return;
    if (tournament.createdById !== player.id) {
      throw new ForbiddenException('Only the tournament creator or an admin can perform this action');
    }
  }
}
