import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PushSubscriptionKeysDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  p256dh!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  auth!: string;
}

export class UpsertPushSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(2048)
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys!: PushSubscriptionKeysDto;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;
}

export class DeletePushSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(2048)
  endpoint!: string;
}
