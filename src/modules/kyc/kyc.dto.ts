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

  @ApiProperty({
    type: [Object],
    example: [
      {
        docType: KycDocumentType.NID_FRONT,
        fileName: 'nid_front.jpg',
        fileSize: 1048576,
        mimeType: 'image/jpeg',
        securePath: '/vault/kyc/doc_front_enc.bin',
      },
      {
        docType: KycDocumentType.NID_BACK,
        fileName: 'nid_back.jpg',
        fileSize: 1048576,
        mimeType: 'image/jpeg',
        securePath: '/vault/kyc/doc_back_enc.bin',
      },
    ],
  })
  @IsArray()
  documents: Array<{
    docType: KycDocumentType;
    fileName: string;
    fileSize: number;
    mimeType: string;
    securePath: string;
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
