import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { SyncDeviceDto } from './dto/sync-device.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Devices & Hardware')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @ApiOperation({
    summary: 'List all paired devices and sensors for current user',
  })
  async getDevices(@CurrentUser('id') userId: string) {
    return this.devicesService.getUserDevices(userId);
  }

  @Post('register')
  @ApiOperation({
    summary: 'Register and bind a new BLE device or platform source',
  })
  async registerDevice(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.devicesService.registerDevice(userId, dto);
  }

  @Post('sync')
  @ApiOperation({
    summary: 'Update device synchronization timestamp and status',
  })
  async syncDevice(
    @CurrentUser('id') userId: string,
    @Body() dto: SyncDeviceDto,
  ) {
    return this.devicesService.syncDevice(userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Unbind and remove a device' })
  async removeDevice(
    @CurrentUser('id') userId: string,
    @Param('id') deviceId: string,
  ) {
    return this.devicesService.removeDevice(userId, deviceId);
  }
}
