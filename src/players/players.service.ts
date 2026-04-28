import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from './entities/player.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { UpdatePlayerDto } from './dto/update-player.dto';

@Injectable()
export class PlayersService {
  constructor(
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,
  ) {}

  async findAll(): Promise<Player[]> {
    return this.playerRepository.find({ select: ['id', 'username', 'email', 'avatar', 'role', 'createdAt', 'updatedAt'] });
  }

  async findOne(id: string): Promise<Player> {
    const player = await this.playerRepository.findOne({
      where: { id },
      select: ['id', 'username', 'email', 'avatar', 'role', 'createdAt', 'updatedAt'],
    });
    if (!player) throw new NotFoundException(`Player ${id} not found`);
    return player;
  }

  async findTournaments(id: string): Promise<Tournament[]> {
    const player = await this.playerRepository.findOne({ where: { id } });
    if (!player) throw new NotFoundException(`Player ${id} not found`);

    return this.tournamentRepository
      .createQueryBuilder('tournament')
      .leftJoinAndSelect('tournament.game', 'game')
      .leftJoin('tournament.players', 'player')
      .where('player.id = :id', { id })
      .getMany();
  }

  async update(id: string, dto: UpdatePlayerDto, currentPlayer: Player): Promise<Player> {
    if (id !== currentPlayer.id && currentPlayer.role !== 'admin') {
      throw new ForbiddenException('Cannot update another player profile');
    }
    const player = await this.playerRepository.findOne({ where: { id } });
    if (!player) throw new NotFoundException(`Player ${id} not found`);

    if (dto.username && dto.username !== player.username) {
      const existing = await this.playerRepository.findOne({ where: { username: dto.username } });
      if (existing) throw new ConflictException('Username already in use');
    }

    Object.assign(player, dto);
    const saved = await this.playerRepository.save(player);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pw, ...result } = saved;
    return result as Player;
  }

  async getStats(id: string): Promise<{
    totalTournaments: number;
    wonMatches: number;
    totalMatches: number;
    winRate: number;
    wonTournaments: number;
  }> {
    const player = await this.playerRepository.findOne({ where: { id } });
    if (!player) throw new NotFoundException(`Player ${id} not found`);

    const totalTournaments = await this.tournamentRepository
      .createQueryBuilder('tournament')
      .innerJoin('tournament.players', 'player')
      .where('player.id = :id', { id })
      .getCount();

    const wonTournaments = await this.tournamentRepository.count({ where: { winnerId: id } });

    const result = await this.playerRepository
      .createQueryBuilder('player')
      .leftJoin('player.matchesAsPlayer1', 'm1', 'm1.isBye = false')
      .leftJoin('player.matchesAsPlayer2', 'm2')
      .leftJoin('player.wonMatches', 'wm')
      .where('player.id = :id', { id })
      .select([
        'COUNT(DISTINCT m1.id) + COUNT(DISTINCT m2.id) AS "totalMatches"',
        'COUNT(DISTINCT wm.id) AS "wonMatches"',
      ])
      .getRawOne<{ totalMatches: string; wonMatches: string }>();

    const totalMatches = parseInt(result?.totalMatches ?? '0', 10);
    const wonMatches = parseInt(result?.wonMatches ?? '0', 10);
    const winRate = totalMatches > 0 ? Math.round((wonMatches / totalMatches) * 100) : 0;

    return { totalTournaments, wonMatches, totalMatches, winRate, wonTournaments };
  }
}
