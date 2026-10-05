import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🏥 United Union Health — Seeding Doctor Users\n');

  const doctorUsers = [
    {
      firstName: 'Sarah',
      lastName: 'Jenkins',
      email: 'dr.sarah@unitedunionhealth.com',
      password: 'Doctor@123',
      title: 'Cardiologist & Chief Medical Officer',
      clinicName: 'United Union Health Clinic',
      licenseNumber: 'MED-AUS-2024-001',
    },
    {
      firstName: 'Admin',
      lastName: 'Portal',
      email: 'admin@unitedunionhealth.com',
      password: 'Admin@123',
      title: 'Clinic Administrator',
      clinicName: 'United Union Health HQ',
      licenseNumber: 'ADMIN-AUS-2024-001',
    },
  ];

  for (const doc of doctorUsers) {
    const existing = await prisma.user.findUnique({ where: { email: doc.email } });

    if (existing) {
      console.log(`⚠️  User already exists: ${doc.email} — skipping`);
      continue;
    }

    const passwordHash = await bcrypt.hash(doc.password, 12);

    const user = await prisma.user.create({
      data: {
        email: doc.email,
        passwordHash,
        firstName: doc.firstName,
        lastName: doc.lastName,
        role: UserRole.DOCTOR,
        isEmailVerified: true,
        profile: {
          create: {
            subscriptionTier: 'GLOBAL_TIER',
          },
        },
        doctorProfile: {
          create: {
            title: doc.title,
            clinicName: doc.clinicName,
            licenseNumber: doc.licenseNumber,
          },
        },
      },
    });

    console.log(`✅ Doctor created: ${user.firstName} ${user.lastName}`);
    console.log(`   📧 Email:    ${doc.email}`);
    console.log(`   🔑 Password: ${doc.password}`);
    console.log(`   🆔 ID:       ${user.id}\n`);
  }

  // Also create a test patient and link to the first doctor
  const patientEmail = 'patient@unitedunionhealth.com';
  let patient = await prisma.user.findUnique({ where: { email: patientEmail } });

  if (!patient) {
    const patientHash = await bcrypt.hash('Patient@123', 12);
    patient = await prisma.user.create({
      data: {
        email: patientEmail,
        passwordHash: patientHash,
        firstName: 'Alex',
        lastName: 'Mitchell',
        role: UserRole.MEMBER,
        isEmailVerified: true,
        profile: { create: { subscriptionTier: 'GLOBAL_TIER', heightCm: 178, weightKg: 75 } },
      },
    });
    console.log(`✅ Test Patient created: ${patient.firstName} ${patient.lastName}`);
    console.log(`   📧 Email:    ${patientEmail}`);
    console.log(`   🔑 Password: Patient@123`);
    console.log(`   🆔 ID:       ${patient.id}\n`);

    // Link patient to doctor
    const doctor = await prisma.user.findUnique({ where: { email: 'dr.sarah@unitedunionhealth.com' } });
    if (doctor) {
      await prisma.patientDoctorRelation.create({
        data: {
          patientId: patient.id,
          doctorId: doctor.id,
          isTelemetryActive: true,
        },
      });
      console.log(`🔗 Linked patient ${patient.firstName} to Dr. ${doctor.lastName}\n`);
    }
  } else {
    console.log(`⚠️  Test patient already exists: ${patientEmail} — skipping\n`);
  }

  console.log('🎉 Seeding complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 Doctor Portal:  http://localhost:3001');
  console.log('📖 Swagger API:    http://localhost:3000/api/docs');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => { console.error('❌ Seed error:', e); process.exit(1); })
  .finally(async () => await prisma.$disconnect());
