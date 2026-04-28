import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Player } from '../players/entities/player.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface AuthTokenResponse {
  access_token: string;
  player: Omit<Player, 'password'>;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokenResponse> {
    const existing = await this.playerRepository.findOne({
      where: [{ email: dto.email }, { username: dto.username }],
    });
    if (existing) {
      if (existing.email === dto.email) {
        throw new ConflictException('Email already in use');
      }
      throw new ConflictException('Username already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const player = this.playerRepository.create({
      ...dto,
      password: hashedPassword,
    });
    const saved = await this.playerRepository.save(player);

    return this.buildTokenResponse(saved);
  }

  async login(dto: LoginDto): Promise<AuthTokenResponse> {
    const player = await this.playerRepository.findOne({ where: { email: dto.email } });
    if (!player) throw new UnauthorizedException('Invalid credentials');

    const passwordValid = await bcrypt.compare(dto.password, player.password);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

    return this.buildTokenResponse(player);
  }

  private buildTokenResponse(player: Player): AuthTokenResponse {
    const payload = { sub: player.id, email: player.email, role: player.role };
    const token = this.jwtService.sign(payload);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...playerWithoutPassword } = player;

    return {
      access_token: token,
      player: playerWithoutPassword as Omit<Player, 'password'>,
    };
  }
}
