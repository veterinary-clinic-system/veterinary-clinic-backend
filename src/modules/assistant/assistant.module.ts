import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service } from '@/modules/catalog/domain/entities/service.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { Breed } from '@/modules/pets/domain/entities/breed.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Species } from '@/modules/pets/domain/entities/species.entity';
import { SchedulingModule } from '@/modules/scheduling/scheduling.module';
import { TriageModule } from '@/modules/triage/triage.module';
import { AiChatAgentService } from '@/modules/assistant/application/ai-chat-agent.service';
import { AiChatController } from '@/modules/assistant/presentation/ai-chat.controller';

/**
 * Trợ lý chat của chủ nuôi: đánh giá triệu chứng (Triage) + đặt lịch (Scheduling).
 * Tách thành module riêng ở TẦNG TRÊN cả hai, vì Scheduling đã phụ thuộc Triage
 * (chạy sàng lọc AI khi đặt lịch) - đặt trợ lý trong Triage sẽ tạo vòng
 * Triage -> Scheduling -> Triage phải vá bằng forwardRef.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Branch, Service, Species, Breed, User, Pet, Doctor]),
    TriageModule,
    SchedulingModule,
  ],
  controllers: [AiChatController],
  providers: [AiChatAgentService],
})
export class AssistantModule {}
