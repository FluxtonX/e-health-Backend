import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDoctorNoteDto } from './dto/create-doctor-note.dto';
import { UpdateConsentDto } from './dto/update-consent.dto';
import { RelationStatus, UserRole } from '@prisma/client';

@Injectable()
export class DoctorService {
  constructor(private prisma: PrismaService) {}

  async getDirectory(search?: string) {
    let whereClause: any = { role: UserRole.DOCTOR };

    if (search) {
      whereClause = {
        ...whereClause,
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          {
            doctorProfile: {
              specialty: { contains: search, mode: 'insensitive' },
            },
          },
          {
            doctorProfile: {
              clinicName: { contains: search, mode: 'insensitive' },
            },
          },
        ],
      };
    }

    const doctors = await this.prisma.user.findMany({
      where: whereClause,
      include: { doctorProfile: true },
    });

    return doctors.map((doc) => ({
      id: doc.id,
      name: `Dr. ${doc.firstName} ${doc.lastName}`,
      title: doc.doctorProfile?.title,
      specialty: doc.doctorProfile?.specialty,
      clinicName: doc.doctorProfile?.clinicName,
      avatarUrl: doc.doctorProfile?.avatarUrl,
      bio: doc.doctorProfile?.bio,
    }));
  }

  async requestConnection(patientId: string, doctorId: string) {
    const existing = await this.prisma.patientDoctorRelation.findUnique({
      where: { patientId_doctorId: { patientId, doctorId } },
    });

    if (existing) {
      throw new BadRequestException('Connection already exists or is pending');
    }

    return this.prisma.patientDoctorRelation.create({
      data: {
        patientId,
        doctorId,
        status: RelationStatus.PENDING,
      },
    });
  }

  async connectByInvitation(patientId: string, code: string) {
    const doctorProfile = await this.prisma.doctorProfile.findUnique({
      where: { invitationCode: code },
      include: { user: true },
    });

    if (!doctorProfile) {
      throw new NotFoundException('Invalid invitation code');
    }

    return this.prisma.patientDoctorRelation.upsert({
      where: {
        patientId_doctorId: { patientId, doctorId: doctorProfile.userId },
      },
      update: { status: RelationStatus.ACTIVE },
      create: {
        patientId,
        doctorId: doctorProfile.userId,
        status: RelationStatus.ACTIVE,
      },
    });
  }

  async getPatientsForDoctor(doctorId: string) {
    const relations = await this.prisma.patientDoctorRelation.findMany({
      where: { doctorId, status: RelationStatus.ACTIVE },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: true,
            metrics: {
              orderBy: { recordedAt: 'desc' },
              take: 50,
            },
          },
        },
      },
    });

    return relations.map((rel) => {
      const p = rel.patient as any;
      const hrMetric = p.metrics.find((m: any) => m.type === 'HEART_RATE');
      const spo2Metric = p.metrics.find((m: any) => m.type === 'SPO2');

      let status = 'NORMAL';
      if (hrMetric && hrMetric.value > 100) status = 'ALERT';
      else if (spo2Metric && spo2Metric.value < 95) status = 'WARNING';

      let age: number | string = 'N/A';
      if (p.profile?.birthdate) {
        const today = new Date();
        const birthDate = new Date(p.profile.birthdate);
        age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
      }

      return {
        id: p.id,
        name: `${p.firstName} ${p.lastName}`,
        age: age,
        gender: p.profile?.gender || 'Not Specified',
        condition: 'Active Telemetry Monitoring',
        lastSync: hrMetric ? hrMetric.recordedAt : 'Never',
        hr: hrMetric ? hrMetric.value : '--',
        spo2: spo2Metric ? spo2Metric.value : '--',
        status,
        avatar: `${p.firstName[0]}${p.lastName[0]}`,
        isTelemetryActive: rel.isTelemetryActive,
      };
    });
  }

  async getOverview(targetId: string) {
    // Check if targetId belongs to a DOCTOR who wants their own profile
    const doctorUser = await this.prisma.user.findUnique({
      where: { id: targetId },
      include: { doctorProfile: true },
    });

    if (doctorUser?.role === 'DOCTOR' && doctorUser.doctorProfile) {
      const profile = doctorUser.doctorProfile;
      return {
        id: doctorUser.id,
        name: `Dr. ${doctorUser.firstName} ${doctorUser.lastName}, MD`,
        title: profile.title,
        clinicName: profile.clinicName,
        licenseNumber: profile.licenseNumber,
        avatarUrl: profile.avatarUrl,
        isTelemetryActive: true, // Default true for the doctor's own summary view
      };
    }

    // Otherwise, treat as a patient fetching their assigned doctor
    const relation = await this.prisma.patientDoctorRelation.findFirst({
      where: { patientId: targetId },
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

  async getAllNotesForDoctor(doctorId: string) {
    return this.prisma.doctorNote.findMany({
      where: { doctorId },
      orderBy: { date: 'desc' },
    });
  }

  async getAllReportsForDoctor(doctorId: string) {
    return this.prisma.clinicalReport.findMany({
      where: { doctorId },
      orderBy: { date: 'desc' },
    });
  }

  async createNote(doctorId: string, dto: CreateDoctorNoteDto) {
    await this.assertDoctorCanAccessPatient(doctorId, dto.patientId, 'CREATE', 'clinical_note');
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
    return this.prisma.clinicalReport.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
    });
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
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'CONSENT_CHANGE',
        resource: 'consent_preference',
        details: { ...dto },
      },
    });
    return consent;
  }

  /**
   * Enforces the server-side clinical access boundary.  UI state is never a
   * permission check: callers must have an active relationship and the member
   * must currently permit electronic clinician access.
   */
  async assertDoctorCanAccessPatient(
    doctorId: string,
    patientId: string,
    action: 'VIEW' | 'CREATE' | 'EXPORT',
    resource: string,
  ): Promise<void> {
    const relation = await this.prisma.patientDoctorRelation.findUnique({
      where: { patientId_doctorId: { patientId, doctorId } },
      include: { patient: { select: { consent: true } } },
    });

    if (!relation || relation.status !== RelationStatus.ACTIVE) {
      throw new ForbiddenException('You are not assigned to this patient');
    }
    if (!relation.isTelemetryActive || relation.patient.consent?.doctorElectronicAccess === false) {
      throw new ForbiddenException('The patient has not authorized electronic clinical access');
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: doctorId,
        action,
        resource,
        details: { patientId },
      },
    });
  }
}
