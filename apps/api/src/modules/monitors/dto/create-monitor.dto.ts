import { IsString, IsUrl, IsInt, Min, Max, IsOptional } from 'class-validator';

export class CreateMonitorDto {
  @IsString()
  name: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url: string;

  @IsInt()
  @Min(1)
  @Max(60)
  @IsOptional()
  intervalMinutes?: number = 5;
}
