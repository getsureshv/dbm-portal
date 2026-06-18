import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsDateString,
  IsUUID,
  IsEnum,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TaskStatus } from '@prisma/client';

export class CreateTaskDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  @Transform(({ value }) =>
    value === '' ? undefined : value,
  )
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  // Nullable: allow passing null to clear the due date.
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => (value === null || value === '' ? null : value))
  dueAt?: string | null;

  // Nullable: allow passing null to remove project association.
  @IsOptional()
  @IsUUID()
  @Transform(({ value }) => (value === null || value === '' ? null : value))
  projectId?: string | null;

  // Nullable: allow passing null to unassign.
  @IsOptional()
  @IsUUID()
  @Transform(({ value }) => (value === null || value === '' ? null : value))
  assigneeId?: string | null;
}

export class ConvertMessageToTaskDto {
  @IsIn(['project_message', 'direct_message', 'channel_message'])
  sourceType: 'project_message' | 'direct_message' | 'channel_message';

  @IsUUID()
  sourceId: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;
}
