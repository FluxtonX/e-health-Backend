import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EsimService } from './esim.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('eSIM & Cellular Telemetry')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('esim')
export class EsimController {
  constructor(private readonly esimService: EsimService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get global health cellular eSIM telemetry status and consumption' })
  async getStatus(@CurrentUser('id') userId: string) {
    return this.esimService.getStatus(userId);
  }

  @Post('activate')
  @ApiOperation({ summary: 'Provision or reactivate global eSIM telemetry profile' })
  async activate(@CurrentUser('id') userId: string) {
    return this.esimService.activateEsim(userId);
  }
}
