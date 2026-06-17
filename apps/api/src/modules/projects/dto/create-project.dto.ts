import {
  IsString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ProjectType {
  RESIDENTIAL = 'RESIDENTIAL',
  COMMERCIAL = 'COMMERCIAL',
  NEW_BUILD = 'NEW_BUILD',
}

// A company associated with the project, plus its primary contact person and
// that person's role in the project. Only companyName is required.
export class ProjectCompanyDto {
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @IsOptional()
  @IsString()
  companyWebsite?: string;

  @IsOptional()
  @IsString()
  companyPhone?: string;

  @IsOptional()
  @IsString()
  contactFirstName?: string;

  @IsOptional()
  @IsString()
  contactLastName?: string;

  @IsOptional()
  @IsString()
  contactTitle?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  roleInProject?: string;
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

  // Optional project site address (ZIP is captured in zipCode above).
  @IsOptional()
  @IsString()
  addressStreet?: string;

  @IsOptional()
  @IsString()
  addressCity?: string;

  @IsOptional()
  @IsString()
  addressState?: string;

  // Zero or more company/contact entries for the project.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectCompanyDto)
  companies?: ProjectCompanyDto[];
}
