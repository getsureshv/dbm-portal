import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsDateString,
  IsUUID,
  IsEnum,
  IsIn,
  IsArray,
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

  // Legacy single assignee — kept for backward compat. If assigneeIds is
  // provided it wins; otherwise this is treated as a one-element set.
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  // Preferred: multiple assignees, each independently completing their part.
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  assigneeIds?: string[];
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

  // Replace the full assignee set. null or [] clears all assignments.
  // Adding a new assignee to a DONE task reopens it (IN_PROGRESS).
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  @Transform(({ value }) => (value === null ? null : value))
  assigneeIds?: string[] | null;
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
