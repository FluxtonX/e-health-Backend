import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMoodLogDto } from './dto/create-mood-log.dto';

@Injectable()
export class MentalWellnessService {
  constructor(private prisma: PrismaService) {}

  async getMoodLogs(userId: string) {
    return this.prisma.moodLog.findMany({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
      take: 30,
    });
  }

  async createMoodLog(userId: string, dto: CreateMoodLogDto) {
    return this.prisma.moodLog.create({
      data: {
        userId,
        moodLabel: dto.moodLabel,
        emoji: dto.emoji,
        reflectionNotes: dto.reflectionNotes,
        loggedAt: new Date(),
      },
    });
  }

  async getSessions() {
    return [
      {
        id: 'sess_01',
        title: 'Parasympathetic Downregulation',
        durationMinutes: 10,
        category: 'BREATHWORK',
        description:
          'Box breathing (4-4-4-4) to lower resting sympathetic tone and stabilize heart rate.',
        instructor: 'Dr. Elena Rossi, PhD',
        audioUrl: 'https://unitedunionhealth.com/audio/box-breathing.mp3',
      },
      {
        id: 'sess_02',
        title: 'Deep Rest Non-Sleep Restoration (NSDR)',
        durationMinutes: 20,
        category: 'MEDITATION',
        description:
          'Guided body scan to promote cellular recovery and support sleep staging.',
        instructor: 'Marcus Vance, Mindfulness Lead',
        audioUrl: 'https://unitedunionhealth.com/audio/nsdr-deep-rest.mp3',
      },
      {
        id: 'sess_03',
        title: 'Pre-Sleep Cognitive Unburdening',
        durationMinutes: 15,
        category: 'JOURNALING',
        description:
          'Clear active cognitive load before your evening sleep window.',
        instructor: 'Clinical Wellness Alliance',
        audioUrl:
          'https://unitedunionhealth.com/audio/cognitive-unburdening.mp3',
      },
    ];
  }
}
