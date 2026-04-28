import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Player } from '../../players/entities/player.entity';
import { Tournament } from '../../tournaments/entities/tournament.entity';

export enum MatchStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

@Entity('matches')
export class Match {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  @Column()
  round!: number;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  score?: string;

  @ApiProperty({ enum: MatchStatus, default: MatchStatus.PENDING })
  @Column({ type: 'enum', enum: MatchStatus, default: MatchStatus.PENDING })
  status!: MatchStatus;

  @ApiProperty({ default: false })
  @Column({ default: false })
  isBye!: boolean;

  @ApiProperty()
  @Column()
  tournamentId!: string;

  @ApiProperty()
  @Column()
  player1Id!: string;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  player2Id?: string;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  winnerId?: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Tournament, (tournament) => tournament.matches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournamentId' })
  tournament!: Tournament;

  @ManyToOne(() => Player, (player) => player.matchesAsPlayer1, { eager: true })
  @JoinColumn({ name: 'player1Id' })
  player1!: Player;

  @ManyToOne(() => Player, (player) => player.matchesAsPlayer2, { nullable: true, eager: true })
  @JoinColumn({ name: 'player2Id' })
  player2?: Player;

  @ManyToOne(() => Player, (player) => player.wonMatches, { nullable: true, eager: false })
  @JoinColumn({ name: 'winnerId' })
  winner?: Player;
}
