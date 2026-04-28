import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from './entities/game.entity';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';

@Injectable()
export class GamesService {
  constructor(
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
  ) {}

  async findAll(): Promise<Game[]> {
    return this.gameRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Game> {
    const game = await this.gameRepository.findOne({ where: { id } });
    if (!game) throw new NotFoundException(`Game ${id} not found`);
    return game;
  }

  async create(dto: CreateGameDto): Promise<Game> {
    const game = this.gameRepository.create(dto);
    return this.gameRepository.save(game);
  }

  async update(id: string, dto: UpdateGameDto): Promise<Game> {
    const game = await this.findOne(id);
    Object.assign(game, dto);
    return this.gameRepository.save(game);
  }

  async remove(id: string): Promise<void> {
    const game = await this.findOne(id);
    await this.gameRepository.remove(game);
  }
}
