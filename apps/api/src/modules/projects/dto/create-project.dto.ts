import { IsString, IsEnum, IsNotEmpty } from 'class-validator';

export enum ProjectType {
  RESIDENTIAL = 'RESIDENTIAL',
  COMMERCIAL = 'COMMERCIAL',
  NEW_BUILD = 'NEW_BUILD',
}

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsEnum(ProjectType)
  @IsNotEmpty()
  type: ProjectType;

  @IsString()
  @IsNotEmpty()
  zipCode: string;
}
