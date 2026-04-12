import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ProjectType } from './create-project.dto';

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ProjectType)
  @IsOptional()
  type?: ProjectType;
}
