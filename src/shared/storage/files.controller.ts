import {
  BadRequestException,
  Controller,
  Inject,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { STORAGE_PROVIDER, StorageProvider } from './ports/storage.port';
import { FileCategory } from './file-category.enum';
import { Public } from '@/shared/common/decorators/public.decorator';

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

@ApiTags('files')
@Controller('files')
@UseGuards(ThrottlerGuard)
export class FilesController {
  constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly storage: StorageProvider,
  ) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  async upload(
    @Query('category') category: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const fileCategory = parseFileCategory(category);

    if (!file) {
      throw new BadRequestException('No file was uploaded');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    return this.storage.save(fileCategory, file);
  }
}

function parseFileCategory(value: string | undefined): FileCategory {
  const normalized = value?.trim();
  const categories = Object.values(FileCategory);

  if (!normalized || !categories.includes(normalized as FileCategory)) {
    throw new BadRequestException(
      `Invalid upload category. Expected one of: ${categories.join(', ')}`,
    );
  }

  return normalized as FileCategory;
}
