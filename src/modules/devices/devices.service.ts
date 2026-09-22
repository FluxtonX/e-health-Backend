import { Injectable, NotFoundException } from '@nestjs/common';
import { ConnectionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { SyncDeviceDto } from './dto/sync-device.dto';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  async getUserDevices(userId: string) {
    return this.prisma.connectedDevice.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    if (dto.isDefault) {
      await this.prisma.connectedDevice.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return this.prisma.connectedDevice.create({
      data: {
        userId,
        name: dto.name,
        model: dto.model,
        category: dto.category,
        batteryPercent: dto.batteryPercent,
        firmwareVersion: dto.firmwareVersion,
        isDefault: dto.isDefault ?? false,
        status: ConnectionStatus.CONNECTED,
        lastSyncedAt: new Date(),
      },
    });
  }

  async syncDevice(userId: string, dto: SyncDeviceDto) {
    const device = await this.prisma.connectedDevice.findFirst({
      where: { id: dto.deviceId, userId },
    });
    if (!device) {
      throw new NotFoundException('Device not found or not paired with this user');
    }

    return this.prisma.connectedDevice.update({
      where: { id: dto.deviceId },
      data: {
        lastSyncedAt: new Date(),
        status: dto.status ?? ConnectionStatus.CONNECTED,
        batteryPercent: dto.batteryPercent ?? device.batteryPercent,
      },
    });
  }

  async removeDevice(userId: string, deviceId: string) {
    const device = await this.prisma.connectedDevice.findFirst({
      where: { id: deviceId, userId },
    });
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    await this.prisma.connectedDevice.delete({
      where: { id: deviceId },
    });

    return { success: true, message: 'Device successfully unbound' };
  }
}
