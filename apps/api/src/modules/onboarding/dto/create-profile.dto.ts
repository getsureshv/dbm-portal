import {
  IsString,
  IsOptional,
  IsEmail,
  IsPhoneNumber,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Owner Profile DTO
export class OwnerProfileDto {
  @IsString()
  @ApiProperty({
    description: 'Owner full name',
    example: 'John Doe',
  })
  name: string;

  @IsString()
  @ApiProperty({
    description: 'Owner phone number',
    example: '+1-555-0123',
  })
  phone: string;
}

// Professional Provider Profile DTO
export class ProfessionalProfileDto {
  @IsString()
  @ApiProperty({
    description: 'First name',
    example: 'John',
  })
  firstName: string;

  @IsString()
  @ApiProperty({
    description: 'Last name',
    example: 'Smith',
  })
  lastName: string;

  @IsString()
  @ApiProperty({
    description: 'Company name',
    example: 'Smith Construction Inc',
  })
  companyName: string;

  @IsString()
  @ApiProperty({
    description: 'Primary contact number',
    example: '+1-555-0123',
  })
  contactNumber1: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Secondary contact number',
    example: '+1-555-0124',
    required: false,
  })
  contactNumber2?: string;

  @IsEmail()
  @ApiProperty({
    description: 'Email address',
    example: 'john@smith-construction.com',
  })
  email: string;

  @IsOptional()
  @IsEnum(['PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED'])
  @ApiProperty({
    description: 'License status',
    enum: ['PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED'],
    required: false,
  })
  licenseStatus?: string;

  @IsString()
  @ApiProperty({
    description: 'Trade name slug (URL-friendly identifier)',
    example: 'smith-construction-inc',
  })
  tradeNameSlug: string;
}

// Supplier Profile DTO
export class SupplierProfileDto {
  @IsString()
  @ApiProperty({
    description: 'Company name',
    example: 'ABC Supply Co',
  })
  companyName: string;

  @IsString()
  @ApiProperty({
    description: 'Contact person name',
    example: 'Jane Supplier',
  })
  contactPerson: string;

  @IsEmail()
  @ApiProperty({
    description: 'Email address',
    example: 'contact@abcsupply.com',
  })
  email: string;

  @IsString()
  @ApiProperty({
    description: 'Phone number',
    example: '+1-555-0200',
  })
  phone: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'Website URL',
    example: 'https://www.abcsupply.com',
    required: false,
  })
  website?: string;
}

// Freight Provider Profile DTO
export class FreightProfileDto {
  @IsString()
  @ApiProperty({
    description: 'Company name',
    example: 'Fast Freight Logistics',
  })
  companyName: string;

  @IsString()
  @ApiProperty({
    description: 'Contact person name',
    example: 'Bob Trucker',
  })
  contactPerson: string;

  @IsString()
  @ApiProperty({
    description: 'Phone number',
    example: '+1-555-0300',
  })
  phone: string;

  @IsEmail()
  @ApiProperty({
    description: 'Email address',
    example: 'dispatch@fastfreight.com',
  })
  email: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'License number',
    example: 'MC-123456',
    required: false,
  })
  licenseNumber?: string;
}

// Union DTO for create profile endpoint
export type CreateProfileDto =
  | OwnerProfileDto
  | ProfessionalProfileDto
  | SupplierProfileDto
  | FreightProfileDto;
