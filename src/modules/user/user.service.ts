import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isEmailVerified: true,
        profileImageUrl: true,
        createdAt: true,
        profile: true,
        consent: true,
        esimPlan: true,
        nutritionTarget: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return {
      ...user,
      fullName: `${user.firstName} ${user.lastName}`,
      initials:
        `${user.firstName[0] || ''}${user.lastName[0] || ''}`.toUpperCase(),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    // Update user root fields if provided
    if (dto.firstName || dto.lastName) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          firstName: dto.firstName ?? user.firstName,
          lastName: dto.lastName ?? user.lastName,
        },
      });
    }

    // Upsert UserProfile demographics
    await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        gender: dto.gender,
        birthdate: dto.birthdate ? new Date(dto.birthdate) : undefined,
        heightCm: dto.heightCm,
        weightKg: dto.weightKg,
        bloodType: dto.bloodType,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
        subscriptionTier: dto.subscriptionTier,
      },
      update: {
        gender: dto.gender,
        birthdate: dto.birthdate ? new Date(dto.birthdate) : undefined,
        heightCm: dto.heightCm,
        weightKg: dto.weightKg,
        bloodType: dto.bloodType,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
        subscriptionTier: dto.subscriptionTier,
      },
    });

    return this.getProfile(userId);
  }

  async getConsent(userId: string) {
    const consent = await this.prisma.consentPreference.findUnique({
      where: { userId },
    });
    return (
      consent || {
        continuousWearableStream: true,
        bloodBiomarkers: true,
        mentalWellness: false,
        doctorElectronicAccess: true,
        aiAdvisorProcessing: true,
        researchAlliance: false,
      }
    );
  }

  async updateConsent(userId: string, dto: any) {
    const consent = await this.prisma.consentPreference.upsert({
      where: { userId },
      create: {
        userId,
        ...dto,
      },
      update: {
        ...dto,
      },
    });

    return consent;
  }
}
