import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  OneToMany,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Player } from '../../players/entities/player.entity';
import { Game } from '../../games/entities/game.entity';
import { Match } from '../../matches/entities/match.entity';

export enum TournamentStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

@Entity('tournaments')
export class Tournament {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ example: 'World Championship 2025' })
  @Column()
  name!: string;

  @ApiProperty({ example: 8 })
  @Column()
  maxPlayers!: number;

  @ApiProperty()
  @Column({ type: 'timestamptz' })
  startDate!: Date;

  @ApiProperty({ enum: TournamentStatus, default: TournamentStatus.PENDING })
  @Column({ type: 'enum', enum: TournamentStatus, default: TournamentStatus.PENDING })
  status!: TournamentStatus;

  @ApiProperty()
  @Column()
  gameId!: string;

  @ApiProperty()
  @Column()
  createdById!: string;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  winnerId?: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Game, (game) => game.tournaments, { eager: true })
  @JoinColumn({ name: 'gameId' })
  game!: Game;

  @ManyToOne(() => Player, (player) => player.createdTournaments)
  @JoinColumn({ name: 'createdById' })
  createdBy!: Player;

  @ManyToOne(() => Player, { nullable: true, eager: false })
  @JoinColumn({ name: 'winnerId' })
  winner?: Player;

  @ManyToMany(() => Player, (player) => player.tournaments, { eager: false })
  @JoinTable({
    name: 'tournament_players',
    joinColumn: { name: 'tournamentId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'playerId', referencedColumnName: 'id' },
  })
  players!: Player[];

  @OneToMany(() => Match, (match) => match.tournament, { cascade: true })
  matches!: Match[];
}
