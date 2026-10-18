import { IsString, IsNotEmpty, IsEnum, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KycDocumentType, KycStatus } from '@aurumsave/shared';

export class SubmitKycDto {
  @ApiProperty({ example: 'NID' })
  @IsString()
  @IsNotEmpty()
  idType: string;

  @ApiProperty({ example: '19951234567890' })
  @IsString()
  @IsNotEmpty()
  idNumber: string;

  @ApiPropertyOptional({ example: 'Abdur Rahim' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'Abdul Jalil' })
  @IsOptional()
  @IsString()
  fatherName?: string;

  @ApiPropertyOptional({ example: 'Rasheda Begum' })
  @IsOptional()
  @IsString()
  motherName?: string;

  @ApiPropertyOptional({ example: '1990-05-15' })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'Private Service / Business' })
  @IsOptional()
  @IsString()
  occupation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  presentAddress?: {
    division: string;
    district: string;
    upazila: string;
    addressLine1: string;
    postalCode: string;
  };

  @ApiPropertyOptional()
  @IsOptional()
  permanentAddress?: {
    division: string;
    district: string;
    upazila: string;
    addressLine1: string;
    postalCode: string;
  };

  @ApiPropertyOptional()
  @IsOptional()
  nominee?: {
    name: string;
    relationship: string;
    phone: string;
    nidNumber: string;
  };

  @ApiProperty({
    type: [Object],
    example: [
      {
        docType: KycDocumentType.NID_FRONT,
        storageKey: 'kyc_user_abc123.jpg',
        fileName: 'nid_front.jpg',
      },
      {
        docType: KycDocumentType.NID_BACK,
        storageKey: 'kyc_user_abc456.jpg',
        fileName: 'nid_back.jpg',
      },
    ],
  })
  @IsArray()
  documents: Array<{
    docType: KycDocumentType;
    storageKey?: string;
    securePath?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  }>;
}

export class ReviewKycDto {
  @ApiProperty({ enum: [KycStatus.APPROVED, KycStatus.REJECTED, KycStatus.ACTION_REQUIRED] })
  @IsEnum(KycStatus)
  decision: KycStatus;

  @ApiPropertyOptional({ example: 'Front of NID is blurred or expired' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiPropertyOptional({ example: 'Identity verified against EC database' })
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
