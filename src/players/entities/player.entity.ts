import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { ApiProperty, ApiHideProperty } from '@nestjs/swagger';
import { Tournament } from '../../tournaments/entities/tournament.entity';
import { Match } from '../../matches/entities/match.entity';

export enum PlayerRole {
  PLAYER = 'player',
  ADMIN = 'admin',
}

@Entity('players')
export class Player {
  @ApiProperty({ example: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ example: 'john_doe' })
  @Column({ unique: true })
  username!: string;

  @ApiProperty({ example: 'john@example.com' })
  @Column({ unique: true })
  email!: string;

  @ApiHideProperty()
  @Exclude()
  @Column()
  password!: string;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  avatar?: string;

  @ApiProperty({ enum: PlayerRole, default: PlayerRole.PLAYER })
  @Column({ type: 'enum', enum: PlayerRole, default: PlayerRole.PLAYER })
  role!: PlayerRole;

  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToMany(() => Tournament, (tournament) => tournament.players)
  tournaments!: Tournament[];

  @OneToMany(() => Match, (match) => match.player1)
  matchesAsPlayer1!: Match[];

  @OneToMany(() => Match, (match) => match.player2)
  matchesAsPlayer2!: Match[];

  @OneToMany(() => Match, (match) => match.winner)
  wonMatches!: Match[];

  @OneToMany(() => Tournament, (tournament) => tournament.createdBy)
  createdTournaments!: Tournament[];
}
