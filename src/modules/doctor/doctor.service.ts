import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDoctorNoteDto } from './dto/create-doctor-note.dto';
import { UpdateConsentDto } from './dto/update-consent.dto';

@Injectable()
export class DoctorService {
  constructor(private prisma: PrismaService) {}

  async getOverview(patientId: string) {
    const relation = await this.prisma.patientDoctorRelation.findFirst({
      where: { patientId },
      include: {
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            doctorProfile: true,
          },
        },
      },
    });

    if (!relation || !relation.doctor?.doctorProfile) {
      return null;
    }

    const doc = relation.doctor;
    const profile = doc.doctorProfile;
    if (!profile) {
      return null;
    }

    return {
      id: doc.id,
      name: `Dr. ${doc.firstName} ${doc.lastName}, MD`,
      title: profile.title,
      clinicName: profile.clinicName,
      licenseNumber: profile.licenseNumber,
      avatarUrl: profile.avatarUrl,
      isTelemetryActive: relation.isTelemetryActive,
      nextScheduledReview: relation.nextScheduledReview,
    };
  }

  async getNotes(patientId: string) {
    return this.prisma.doctorNote.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
    });
  }

  async createNote(doctorId: string, dto: CreateDoctorNoteDto) {
    const doctor = await this.prisma.user.findUnique({
      where: { id: doctorId },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor profile not found');
    }

    return this.prisma.doctorNote.create({
      data: {
        patientId: dto.patientId,
        doctorId,
        doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}, MD`,
        category: dto.category,
        noteText: dto.noteText,
        recommendations: dto.recommendations,
        date: new Date(),
      },
    });
  }

  async getSharedReports(patientId: string) {
    // Return diagnostic lab and cardiovascular reports
    return [
      {
        id: 'rep_01',
        title: 'Comprehensive Cardiovascular Biomarker Panel',
        date: '2026-08-14',
        type: 'LAB_PANEL',
        status: 'NORMAL',
        metricsIncluded: ['Lipid Profile', 'ApoB', 'hs-CRP', 'HbA1c'],
        reviewedBy: 'Dr. Sarah Jenkins, MD',
        fileUrl: 'https://unitedunionhealth.com/reports/sample-panel-01.pdf',
      },
      {
        id: 'rep_02',
        title: 'Overnight PPG & Sleep Telemetry Ingestion Audit',
        date: '2026-09-12',
        type: 'TELEMETRY_AUDIT',
        status: 'OPTIMAL',
        metricsIncluded: ['Continuous Heart Rate', 'SpO2 Consistency', 'REM/Deep Cycles'],
        reviewedBy: 'Dr. Sarah Jenkins, MD',
        fileUrl: 'https://unitedunionhealth.com/reports/sample-telemetry-02.pdf',
      },
    ];
  }

  async getConsentSettings(userId: string) {
    const consent = await this.prisma.consentPreference.findUnique({
      where: { userId },
    });
    if (!consent) {
      return this.prisma.consentPreference.create({
        data: { userId },
      });
    }
    return consent;
  }

  async updateConsentSettings(userId: string, dto: UpdateConsentDto) {
    return this.prisma.consentPreference.upsert({
      where: { userId },
      create: {
        userId,
        ...dto,
      },
      update: {
        ...dto,
      },
    });
  }
}
