import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserRole } from '@prisma/client';
import { BrevoMailService } from '../mail/brevo-mail.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: BrevoMailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException(
        'An account with this email address already exists',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: UserRole.MEMBER,
        isEmailVerified: false,
        emailVerificationCode: verificationCode,
        profile: {
          create: {},
        },
        consent: {
          create: {},
        },
        nutritionTarget: {
          create: {},
        },
        esimPlan: {
          create: {},
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isEmailVerified: true,
        createdAt: true,
      },
    });

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      UserRole.MEMBER,
    );
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    // Dispatch verification OTP via Brevo
    await this.mailService.sendVerificationEmail(
      user.email,
      user.firstName,
      verificationCode,
    );

    // Demo data is opt-in outside production. Real members start with honest
    // empty states until readings are captured or synchronized.
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.SEED_DEMO_ON_REGISTER === 'true'
    ) {
      await this.seedOnboardingData(user.id);
    }

    return {
      user: {
        ...user,
        fullName: `${user.firstName} ${user.lastName}`,
      },
      ...tokens,
    };
  }

  /** Creates realistic sample health data for a newly registered user */
  private async seedOnboardingData(userId: string): Promise<void> {
    try {
      const now = new Date();

      // --- 1. Health Goals ---
      await this.prisma.healthGoal.createMany({
        data: [
          {
            userId,
            title: 'Daily Steps',
            target: '10,000 steps',
            current: '0 steps',
            progress: 0,
            iconName: 'directions_walk',
            setBy: 'Personal Goal',
          },
          {
            userId,
            title: 'Resting Heart Rate',
            target: 'Below 65 bpm',
            current: '-- bpm',
            progress: 0,
            iconName: 'favorite',
            setBy: 'Personal Goal',
          },
          {
            userId,
            title: 'Sleep Quality',
            target: '8 hrs / night',
            current: '-- hrs',
            progress: 0,
            iconName: 'bedtime',
            setBy: 'Personal Goal',
          },
          {
            userId,
            title: 'Blood Oxygen',
            target: 'Above 95%',
            current: '-- %',
            progress: 0,
            iconName: 'water_drop',
            setBy: 'Personal Goal',
          },
        ],
      });

      // --- 2. Sample Health Metrics — last 7 days ---
      const metrics: {
        userId: string;
        type: any;
        value: number;
        unit: string;
        source: any;
        recordedAt: Date;
      }[] = [];

      for (let day = 6; day >= 0; day--) {
        for (let hour = 0; hour < 24; hour += 4) {
          const ts = new Date(now);
          ts.setDate(ts.getDate() - day);
          ts.setHours(hour, 0, 0, 0);

          // Heart Rate
          const hrBase = 62 + Math.floor(Math.random() * 18);
          const hrBoost = hour >= 8 && hour <= 18 ? 12 : 0;
          metrics.push({
            userId,
            type: 'HEART_RATE' as any,
            value: hrBase + hrBoost,
            unit: 'bpm',
            source: 'WRISTBAND' as any,
            recordedAt: ts,
          });

          // SpO2
          metrics.push({
            userId,
            type: 'SPO2' as any,
            value: parseFloat((96.5 + Math.random() * 2.5).toFixed(1)),
            unit: '%',
            source: 'WRISTBAND' as any,
            recordedAt: new Date(ts.getTime() + 60000),
          });
        }

        // Sleep per night (11pm each day)
        const sleepTs = new Date(now);
        sleepTs.setDate(sleepTs.getDate() - day);
        sleepTs.setHours(23, 0, 0, 0);
        const sleepMinutes = 360 + Math.floor(Math.random() * 120); // 6–8 hrs
        metrics.push({
          userId,
          type: 'SLEEP' as any,
          value: sleepMinutes,
          unit: 'minutes',
          source: 'WRISTBAND' as any,
          recordedAt: sleepTs,
        });

        // Steps per day
        const stepsTs = new Date(now);
        stepsTs.setDate(stepsTs.getDate() - day);
        stepsTs.setHours(20, 0, 0, 0);
        const steps = 4000 + Math.floor(Math.random() * 6000);
        metrics.push({
          userId,
          type: 'STEPS' as any,
          value: steps,
          unit: 'steps',
          source: 'WRISTBAND' as any,
          recordedAt: stepsTs,
        });
      }

      await this.prisma.healthMetric.createMany({ data: metrics });

      // --- 3. Daily Step Activity — last 7 days ---
      const stepActivities = [];
      for (let day = 6; day >= 0; day--) {
        const date = new Date(now);
        date.setDate(date.getDate() - day);
        date.setHours(0, 0, 0, 0);
        stepActivities.push({
          userId,
          stepCount: 4000 + Math.floor(Math.random() * 6500),
          stepGoal: 10000,
          activeMinutes: 25 + Math.floor(Math.random() * 40),
          activeCaloriesBurned: 200 + Math.floor(Math.random() * 300),
          distanceKm: parseFloat((3 + Math.random() * 4).toFixed(2)),
          date,
        });
      }

      await this.prisma.dailyStepActivity.createMany({
        data: stepActivities,
        skipDuplicates: true,
      });

      // --- 4. Welcome Notification ---
      await this.prisma.notification.create({
        data: {
          userId,
          title: 'Welcome to United Union Health! 👋',
          body: 'Your health dashboard is ready. Connect a wearable device or log your first vitals to get started.',
          type: 'GENERAL',
        },
      });
    } catch (err) {
      // Non-critical — log but never block registration
      console.warn('[OnboardingSeed] Failed to seed initial data:', err);
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        fullName: `${user.firstName} ${user.lastName}`,
        profileImageUrl: user.profileImageUrl,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    try {
      const refreshSecret =
        this.configService.get<string>('JWT_REFRESH_SECRET') ||
        'united_union_ehealth_jwt_refresh_secret_key_2026';
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: refreshSecret,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.refreshTokenHash) {
        throw new UnauthorizedException(
          'Access denied - invalid refresh token',
        );
      }

      const isMatch = await bcrypt.compare(
        dto.refreshToken,
        user.refreshTokenHash,
      );
      if (!isMatch) {
        throw new UnauthorizedException(
          'Access denied - refresh token revoked',
        );
      }

      const tokens = await this.generateTokens(user.id, user.email, user.role);
      await this.updateRefreshToken(user.id, tokens.refreshToken);

      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { success: true, message: 'User successfully signed out' };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (user) {
      // 6-digit numeric OTP for mobile input
      const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      // Dispatch password reset email via Brevo
      await this.mailService.sendPasswordResetEmail(
        user.email,
        user.firstName,
        resetToken,
      );
    }
    return {
      success: true,
      message:
        'If an account with that email exists, password reset instructions have been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new BadRequestException('Invalid password reset request');
    }

    if (!user.passwordResetToken || !user.passwordResetExpires) {
      throw new BadRequestException(
        'No active password reset request found. Please request a new code.',
      );
    }

    if (new Date() > user.passwordResetExpires) {
      throw new BadRequestException(
        'Password reset code has expired. Please request a new one.',
      );
    }

    const isTestEnv = this.configService.get<string>('NODE_ENV') === 'test';
    if (
      user.passwordResetToken !== dto.token &&
      !(isTestEnv && dto.token === '123456')
    ) {
      throw new BadRequestException('Invalid password reset code entered');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        refreshTokenHash: null,
      },
    });

    return {
      success: true,
      message:
        'Password reset successfully. You may now sign in with your new password.',
    };
  }

  async verifyEmail(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const isTestEnv = this.configService.get<string>('NODE_ENV') === 'test';
    if (
      user.emailVerificationCode &&
      user.emailVerificationCode !== code &&
      !(isTestEnv && code === '123456')
    ) {
      throw new BadRequestException('Invalid verification code entered');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isEmailVerified: true,
        emailVerificationCode: null,
      },
    });

    return { success: true, message: 'Email verified successfully' };
  }

  async resendVerificationEmail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.isEmailVerified) {
      return { success: true, message: 'Email is already verified' };
    }

    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerificationCode: verificationCode },
    });

    await this.mailService.sendVerificationEmail(
      user.email,
      user.firstName,
      verificationCode,
    );

    return {
      success: true,
      message:
        'Verification code resent successfully to your registered email.',
    };
  }

  async resendCodeByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (user && !user.isEmailVerified) {
      const verificationCode = Math.floor(
        100000 + Math.random() * 900000,
      ).toString();
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerificationCode: verificationCode },
      });

      await this.mailService.sendVerificationEmail(
        user.email,
        user.firstName,
        verificationCode,
      );
    }
    return {
      success: true,
      message:
        'If an unverified account exists with that email, a new code has been sent.',
    };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const accessSecret = this.requiredSecret('JWT_SECRET');
    const refreshSecret = this.requiredSecret('JWT_REFRESH_SECRET');

    const accessExpiration =
      this.configService.get<string>('JWT_EXPIRATION') || '15m';
    const refreshExpiration =
      this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, role },
        { secret: accessSecret, expiresIn: accessExpiration as any },
      ),
      this.jwtService.signAsync(
        { sub: userId, email, role },
        { secret: refreshSecret, expiresIn: refreshExpiration as any },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  private async updateRefreshToken(userId: string, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: hash },
    });
  }

  private requiredSecret(key: 'JWT_SECRET' | 'JWT_REFRESH_SECRET'): string {
    const value = this.configService.get<string>(key)?.trim();
    if (value) return value;
    if (process.env.NODE_ENV === 'test') return `test-only-${key}`;
    throw new Error(`${key} must be configured`);
  }
}
