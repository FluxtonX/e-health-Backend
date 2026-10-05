import { Injectable, NotFoundException } from '@nestjs/common';
import { ConnectionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { SyncDeviceDto } from './dto/sync-device.dto';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  async getUserDevices(userId: string) {
    const devices = await this.prisma.connectedDevice.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { lastSyncedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // Deduplicate devices by model & name (keeps the most recently synced record)
    const seen = new Set<string>();
    const uniqueDevices: typeof devices = [];
    const duplicateIdsToDelete: string[] = [];

    for (const d of devices) {
      const key = `${d.category}_${d.model}`;
      if (seen.has(key)) {
        duplicateIdsToDelete.push(d.id);
      } else {
        seen.add(key);
        uniqueDevices.push(d);
      }
    }

    if (duplicateIdsToDelete.length > 0) {
      // Clean up orphaned duplicates in the background
      this.prisma.connectedDevice
        .deleteMany({
          where: { id: { in: duplicateIdsToDelete } },
        })
        .catch(() => {});
    }

    return uniqueDevices;
  }

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    if (dto.isDefault) {
      await this.prisma.connectedDevice.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    // Check if device with this model or name already exists for this user
    const existing = await this.prisma.connectedDevice.findFirst({
      where: {
        userId,
        OR: [{ model: dto.model }, { name: dto.name }],
      },
    });

    if (existing) {
      return this.prisma.connectedDevice.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          category: dto.category,
          batteryPercent: dto.batteryPercent ?? existing.batteryPercent,
          firmwareVersion: dto.firmwareVersion ?? existing.firmwareVersion,
          status: ConnectionStatus.CONNECTED,
          lastSyncedAt: new Date(),
        },
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
      throw new NotFoundException(
        'Device not found or not paired with this user',
      );
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
