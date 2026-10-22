import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThan } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt } from 'crypto';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { RefreshToken } from '@/modules/identity/domain/entities/refresh-token.entity';
import { PasswordResetCode } from '@/modules/identity/domain/entities/password-reset-code.entity';
import { NotificationsService } from '@/modules/notification/application';
import { Role } from '@/shared/common/enums/role.enum';
import { AUDIT_RECORDER, AuditRecorder } from '@/shared/common/audit/audit-recorder.port';
import { AuditAction } from '@/shared/common/enums/audit-action.enum';

const BCRYPT_ROUNDS = 12;
export const RESET_CODE_TTL_MS = 10 * 60 * 1000;
export const RESET_CODE_MAX_ATTEMPTS = 5;
export const RESET_CODE_RESEND_COOLDOWN_MS = 60 * 1000;
const RESET_CODES_PER_HOUR = 5;

const INVALID_CODE = 'Mã xác nhận không đúng hoặc đã hết hạn';

export interface ForgotPasswordResult {
  /** Luôn true - không tiết lộ số điện thoại có tài khoản hay không. */
  sent: true;
  /** NOTIFICATION_PROVIDER=log: mã chỉ nằm trong log máy chủ (môi trường dev). */
  simulated: boolean;
  expiresInSeconds: number;
}

/**
 * Quên mật khẩu cho CHỦ NUÔI: mã 6 số gửi qua Zalo (theo SĐT) và Gmail (nếu có). Nhân viên
 * do quản trị viên đặt lại mật khẩu, không đi đường này.
 *
 * Hồ sơ khách vãng lai (chưa có mật khẩu) cũng dùng được: nhận mã qua chính SĐT đó là
 * bằng chứng chính chủ, nên đặt mật khẩu ở đây an toàn hơn đăng ký "nhận" hồ sơ.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
    @Inject(AUDIT_RECORDER) private readonly auditRecorder: AuditRecorder,
  ) {}

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private findOwner(phone: string): Promise<User | null> {
    return this.dataSource
      .getRepository(User)
      .findOne({ where: { phone: phone.trim(), role: Role.PET_OWNER, active: true } });
  }

  async requestCode(phone: string): Promise<ForgotPasswordResult> {
    const result: ForgotPasswordResult = {
      sent: true,
      simulated: false,
      expiresInSeconds: RESET_CODE_TTL_MS / 1000,
    };
    const user = await this.findOwner(phone);
    if (!user) return result;

    const codes = this.dataSource.getRepository(PasswordResetCode);
    const latest = await codes.findOne({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
    });
    if (latest && Date.now() - latest.createdAt.getTime() < RESET_CODE_RESEND_COOLDOWN_MS) {
      throw new HttpException(
        'Vui lòng đợi một phút trước khi yêu cầu mã mới',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const recent = await codes.count({
      where: { userId: user.id, createdAt: MoreThan(new Date(Date.now() - 60 * 60 * 1000)) },
    });
    if (recent >= RESET_CODES_PER_HOUR) {
      throw new HttpException(
        'Bạn đã yêu cầu quá nhiều mã, vui lòng thử lại sau một giờ',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    // Mã mới thay mọi mã cũ còn hiệu lực.
    await codes.update({ userId: user.id, usedAt: IsNull() }, { usedAt: new Date() });
    await codes.save(
      codes.create({
        userId: user.id,
        codeHash: this.hash(code),
        expiresAt: new Date(Date.now() + RESET_CODE_TTL_MS),
      }),
    );

    const report = await this.notifications.sendAccountMessage({
      recipientPhone: user.phone,
      recipientEmail: user.email,
      subject: 'Mã khôi phục mật khẩu VetCare',
      message:
        `[VetCare] Mã khôi phục mật khẩu của bạn là ${code}. Mã có hiệu lực trong 10 phút. ` +
        'Không chia sẻ mã này cho bất kỳ ai, kể cả nhân viên phòng khám.',
    });
    if (report.deliveries.every((d) => d.status !== 'SENT')) {
      this.logger.warn(`Không gửi được mã khôi phục tới ${user.phone}`);
    }

    return { ...result, simulated: report.simulated };
  }

  async resetPassword(phone: string, code: string, newPassword: string): Promise<void> {
    const user = await this.findOwner(phone);
    if (!user) throw new BadRequestException(INVALID_CODE);

    const codes = this.dataSource.getRepository(PasswordResetCode);
    const active = await codes.findOne({
      where: { userId: user.id, usedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
    if (!active || active.attempts >= RESET_CODE_MAX_ATTEMPTS) {
      throw new BadRequestException(INVALID_CODE);
    }

    if (active.codeHash !== this.hash(code.trim())) {
      active.attempts += 1;
      await codes.save(active);
      const left = RESET_CODE_MAX_ATTEMPTS - active.attempts;
      throw new BadRequestException(
        left > 0
          ? `Mã xác nhận không đúng, bạn còn ${left} lần thử`
          : 'Nhập sai quá nhiều lần, vui lòng yêu cầu mã mới',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const now = new Date();
    await this.dataSource.transaction(async (manager) => {
      await manager.update(PasswordResetCode, { id: active.id }, { usedAt: now });
      await manager.update(User, { id: user.id }, { passwordHash });
      // Đổi mật khẩu vì nghi lộ: đăng xuất mọi máy đang đăng nhập.
      await manager.update(
        RefreshToken,
        { userId: user.id, revokedAt: IsNull() },
        { revokedAt: now },
      );
    });

    this.auditRecorder.record({
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      entityName: 'User',
      entityId: user.id,
      changes: { passwordReset: true },
      ipAddress: null,
      userAgent: null,
    });
  }
}
