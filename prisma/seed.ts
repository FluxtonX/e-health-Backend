import { PrismaClient, UserRole, Gender, SubscriptionTier, MetricType, HealthDataSource, DeviceCategory, ConnectionStatus, NotificationType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting United Union Health database seed...');

  // Clean existing seed data
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.foodLog.deleteMany();
  await prisma.nutritionTarget.deleteMany();
  await prisma.moodLog.deleteMany();
  await prisma.healthGoal.deleteMany();
  await prisma.consentPreference.deleteMany();
  await prisma.doctorNote.deleteMany();
  await prisma.patientDoctorRelation.deleteMany();
  await prisma.doctorProfile.deleteMany();
  await prisma.connectedDevice.deleteMany();
  await prisma.dailyStepActivity.deleteMany();
  await prisma.sleepSummary.deleteMany();
  await prisma.healthMetric.deleteMany();
  await prisma.esimPlan.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();

  const saltRounds = 10;
  const standardPasswordHash = await bcrypt.hash('Password123!', saltRounds);

  // 1. Create Elena Vance (Member)
  const elena = await prisma.user.create({
    data: {
      email: 'member@unitedunionhealth.com',
      passwordHash: standardPasswordHash,
      firstName: 'Elena',
      lastName: 'Vance',
      role: UserRole.MEMBER,
      isEmailVerified: true,
      profile: {
        create: {
          gender: Gender.FEMALE,
          birthdate: new Date('1994-06-15'),
          heightCm: 172.0,
          weightKg: 64.5,
          bloodType: 'O+',
          emergencyContactName: 'Marcus Vance',
          emergencyContactPhone: '+1-555-019-2834',
          subscriptionTier: SubscriptionTier.GLOBAL_TIER,
        },
      },
    },
  });

  // 2. Create Dr. Sarah Jenkins (Doctor)
  const drJenkins = await prisma.user.create({
    data: {
      email: 'doctor@unitedunionhealth.com',
      passwordHash: standardPasswordHash,
      firstName: 'Sarah',
      lastName: 'Jenkins',
      role: UserRole.DOCTOR,
      isEmailVerified: true,
      doctorProfile: {
        create: {
          title: 'Cardiovascular Health & Preventive Medicine',
          clinicName: 'United Union Health Care Alliance - North Center',
          licenseNumber: 'MD-89241-US',
          avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
        },
      },
    },
  });

  // 3. Create Patient-Doctor Relationship
  const reviewDate = new Date();
  reviewDate.setDate(reviewDate.getDate() + 4);

  await prisma.patientDoctorRelation.create({
    data: {
      patientId: elena.id,
      doctorId: drJenkins.id,
      isTelemetryActive: true,
      nextScheduledReview: reviewDate,
    },
  });

  // 4. Create Doctor Clinical Notes
  await prisma.doctorNote.createMany({
    data: [
      {
        patientId: elena.id,
        doctorId: drJenkins.id,
        doctorName: 'Dr. Sarah Jenkins, MD',
        category: 'Quarterly Cardiovascular Follow-up',
        noteText:
          'Resting heart rate has improved by 4 bpm following consistent zone 2 walking. SpO2 overnight averages remain stable at 98%. Continue current regimen without alteration.',
        recommendations: [
          'Maintain 45 minutes of aerobic exercise 4x weekly',
          'Target sleep duration above 7.5 hours nightly',
          'Log hydration during warmer training sessions',
        ],
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        patientId: elena.id,
        doctorId: drJenkins.id,
        doctorName: 'Dr. Sarah Jenkins, MD',
        category: 'Baseline Intake Assessment',
        noteText:
          'Initial health telemetry setup completed. Normalized data streams from wearable active. Baseline vitals establish normal sinus rhythm.',
        recommendations: [
          'Wear tracker consistently during overnight sleep windows',
          'Perform initial walk test for baseline aerobic fitness score',
        ],
        date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  // 5. Create Devices for Elena
  await prisma.connectedDevice.createMany({
    data: [
      {
        userId: elena.id,
        name: 'United Union Wristband V2',
        model: 'UU-WB2-PRO',
        category: DeviceCategory.WRISTBAND,
        status: ConnectionStatus.CONNECTED,
        batteryPercent: 88,
        firmwareVersion: 'v2.4.1',
        isDefault: true,
        lastSyncedAt: new Date(),
      },
      {
        userId: elena.id,
        name: 'Apple Health Sync Hub',
        model: 'iOS HealthKit 18.2',
        category: DeviceCategory.OS_PLATFORM,
        status: ConnectionStatus.CONNECTED,
        batteryPercent: null,
        firmwareVersion: '18.2.0',
        isDefault: false,
        lastSyncedAt: new Date(Date.now() - 15 * 60 * 1000),
      },
      {
        userId: elena.id,
        name: 'Smart Scale Pro',
        model: 'SC-800-BT',
        category: DeviceCategory.SMART_SCALE,
        status: ConnectionStatus.DISCONNECTED,
        batteryPercent: 64,
        firmwareVersion: 'v1.0.8',
        isDefault: false,
        lastSyncedAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
      },
    ],
  });

  // 6. Create Health Telemetry Data (Current & 7-Day History)
  const now = new Date();

  // Heart Rate
  await prisma.healthMetric.create({
    data: {
      userId: elena.id,
      type: MetricType.HEART_RATE,
      value: 72,
      unit: 'bpm',
      source: HealthDataSource.WRISTBAND,
      recordedAt: new Date(now.getTime() - 8 * 60 * 1000),
      metadata: { restingBpm: 64, minBpm: 58, maxBpm: 124 },
    },
  });

  // SpO2
  await prisma.healthMetric.create({
    data: {
      userId: elena.id,
      type: MetricType.SPO2,
      value: 98.4,
      unit: '%',
      source: HealthDataSource.WRISTBAND,
      recordedAt: new Date(now.getTime() - 25 * 60 * 1000),
      metadata: { quality: 'optimal' },
    },
  });

  // Sleep Summary
  await prisma.sleepSummary.create({
    data: {
      userId: elena.id,
      totalDurationMinutes: 462, // 7h 42m
      deepMinutes: 114,
      remMinutes: 95,
      lightMinutes: 253,
      awakeMinutes: 24,
      sleepEfficiencyScore: 89.0,
      source: HealthDataSource.WRISTBAND,
      recordedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
    },
  });

  // Daily Step Activity for Today
  await prisma.dailyStepActivity.create({
    data: {
      userId: elena.id,
      stepCount: 8430,
      stepGoal: 10000,
      activeMinutes: 46,
      activeCaloriesBurned: 480,
      distanceKm: 6.2,
      date: new Date(new Date().setHours(0, 0, 0, 0)),
    },
  });

  // 7-day Historical points for graphs
  for (let i = 6; i >= 0; i--) {
    const historicalDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const hrVal = 68.0 + (i % 4) * 3.0;
    const spo2Val = 97.5 + (i % 3) * 0.8;
    const sleepMins = 420 + (i % 3) * 30;
    const stepCount = 7500 + i * 450;

    await prisma.healthMetric.createMany({
      data: [
        {
          userId: elena.id,
          type: MetricType.HEART_RATE,
          value: hrVal,
          unit: 'bpm',
          source: HealthDataSource.WRISTBAND,
          recordedAt: historicalDate,
          metadata: { restingBpm: Math.round(hrVal - 6) },
        },
        {
          userId: elena.id,
          type: MetricType.SPO2,
          value: spo2Val,
          unit: '%',
          source: HealthDataSource.WRISTBAND,
          recordedAt: historicalDate,
        },
        {
          userId: elena.id,
          type: MetricType.STEPS,
          value: stepCount,
          unit: 'steps',
          source: HealthDataSource.WRISTBAND,
          recordedAt: historicalDate,
        },
      ],
    });

    if (i > 0) {
      await prisma.dailyStepActivity.create({
        data: {
          userId: elena.id,
          stepCount: stepCount,
          stepGoal: 10000,
          activeMinutes: 35 + i * 5,
          activeCaloriesBurned: 400 + i * 25,
          distanceKm: 5.0 + i * 0.4,
          date: new Date(new Date(historicalDate).setHours(0, 0, 0, 0)),
        },
      });

      await prisma.sleepSummary.create({
        data: {
          userId: elena.id,
          totalDurationMinutes: sleepMins,
          deepMinutes: 90,
          remMinutes: 80,
          lightMinutes: sleepMins - 190,
          awakeMinutes: 20,
          sleepEfficiencyScore: 84.0 + (i % 5),
          source: HealthDataSource.WRISTBAND,
          recordedAt: historicalDate,
        },
      });
    }
  }

  // 7. Consent Governance
  await prisma.consentPreference.create({
    data: {
      userId: elena.id,
      continuousWearableStream: true,
      bloodBiomarkers: true,
      mentalWellness: false,
      doctorElectronicAccess: true,
      aiAdvisorProcessing: true,
      researchAlliance: false,
    },
  });

  // 8. Health Goals
  await prisma.healthGoal.createMany({
    data: [
      {
        userId: elena.id,
        title: 'Daily Steps',
        target: '10,000 steps',
        current: '8,430 steps',
        progress: 0.84,
        iconName: 'directions_walk_rounded',
        setBy: 'Personal Goal',
      },
      {
        userId: elena.id,
        title: 'Resting Heart Rate < 68 bpm',
        target: '< 68 bpm',
        current: '64 bpm',
        progress: 0.85,
        iconName: 'favorite_outline_rounded',
        setBy: 'Dr. Sarah Jenkins, MD',
      },
      {
        userId: elena.id,
        title: 'Target 8 Hours Sleep',
        target: '8 hrs nightly',
        current: '7h 42m',
        progress: 0.95,
        iconName: 'bedtime_outlined',
        setBy: 'Personal Goal',
      },
      {
        userId: elena.id,
        title: 'Aerobic Zone 2 Activity',
        target: '180 min / week',
        current: '142 min',
        progress: 0.78,
        iconName: 'fitness_center_rounded',
        setBy: 'Dr. Sarah Jenkins, MD',
      },
    ],
  });

  // 9. Mental Wellness Mood Logs
  await prisma.moodLog.createMany({
    data: [
      {
        userId: elena.id,
        moodLabel: 'Energized',
        emoji: '⚡',
        reflectionNotes: 'Great morning run and steady vitals recovery.',
        loggedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      },
      {
        userId: elena.id,
        moodLabel: 'Calm',
        emoji: '🌿',
        reflectionNotes: 'Evening breathing session completed.',
        loggedAt: new Date(now.getTime() - 28 * 60 * 60 * 1000),
      },
    ],
  });

  // 10. Nutrition Target & Food Log
  await prisma.nutritionTarget.create({
    data: {
      userId: elena.id,
      dailyCaloriesKcal: 2200,
      proteinGrams: 140,
      carbsGrams: 210,
      fatsGrams: 65,
    },
  });

  await prisma.foodLog.create({
    data: {
      userId: elena.id,
      foodName: 'Grilled Chicken Breast & Roasted Vegetables',
      portionDescription: '320g • High Protein / Low Glycemic',
      portionGrams: 320,
      calories: 380,
      proteinGrams: 42,
      carbsGrams: 14,
      fatsGrams: 8,
      confidenceScore: 0.94,
      loggedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
    },
  });

  // 11. eSIM Telemetry Plan
  await prisma.esimPlan.create({
    data: {
      userId: elena.id,
      planName: 'United Union Global Health eSIM',
      isActivated: true,
      dataUsedGb: 1.4,
      dataTotalGb: 5.0,
      iccid: '89014103211118510720',
      status: 'Active',
    },
  });

  // 12. Notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: elena.id,
        title: 'Doctor Note Added',
        body: 'Dr. Sarah Jenkins reviewed your weekly cardiovascular vitals and updated your activity target.',
        type: NotificationType.DOCTOR_NOTE,
        isRead: false,
        createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
      {
        userId: elena.id,
        title: 'Sleep Goal Reached',
        body: 'You attained 7h 42m of restful sleep with 89% sleep efficiency.',
        type: NotificationType.GOAL_ACHIEVEMENT,
        isRead: true,
        createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
      },
      {
        userId: elena.id,
        title: 'Wristband Synchronized',
        body: 'Continuous PPG telemetry successfully synced to secure clinical storage.',
        type: NotificationType.DEVICE_SYNC,
        isRead: true,
        createdAt: new Date(now.getTime() - 8 * 60 * 1000),
      },
    ],
  });

  console.log('✅ Database successfully seeded with Elena Vance and Dr. Sarah Jenkins demo records!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
