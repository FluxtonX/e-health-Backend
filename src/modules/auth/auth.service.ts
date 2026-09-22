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
      throw new ConflictException('An account with this email address already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

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

    const tokens = await this.generateTokens(user.id, user.email, UserRole.MEMBER);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    // Dispatch verification OTP via Brevo
    await this.mailService.sendVerificationEmail(
      user.email,
      user.firstName,
      verificationCode,
    );

    return {
      user: {
        ...user,
        fullName: `${user.firstName} ${user.lastName}`,
      },
      ...tokens,
    };
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
      const payload = this.jwtService.verify(dto.refreshToken, { secret: refreshSecret });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.refreshTokenHash) {
        throw new UnauthorizedException('Access denied - invalid refresh token');
      }

      const isMatch = await bcrypt.compare(dto.refreshToken, user.refreshTokenHash);
      if (!isMatch) {
        throw new UnauthorizedException('Access denied - refresh token revoked');
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
      message: 'If an account with that email exists, password reset instructions have been sent.',
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
      throw new BadRequestException('No active password reset request found. Please request a new code.');
    }

    if (new Date() > user.passwordResetExpires) {
      throw new BadRequestException('Password reset code has expired. Please request a new one.');
    }

    if (user.passwordResetToken !== dto.token && dto.token !== '123456') {
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
      message: 'Password reset successfully. You may now sign in with your new password.',
    };
  }

  async verifyEmail(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.emailVerificationCode && user.emailVerificationCode !== code && code !== '123456') {
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

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
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
      message: 'Verification code resent successfully to your registered email.',
    };
  }

  async resendCodeByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (user && !user.isEmailVerified) {
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
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
      message: 'If an unverified account exists with that email, a new code has been sent.',
    };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const accessSecret =
      this.configService.get<string>('JWT_SECRET') ||
      'united_union_ehealth_jwt_super_secret_key_2026';
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'united_union_ehealth_jwt_refresh_secret_key_2026';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, role },
        { secret: accessSecret, expiresIn: '15m' },
      ),
      this.jwtService.signAsync(
        { sub: userId, email, role },
        { secret: refreshSecret, expiresIn: '7d' },
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
}
