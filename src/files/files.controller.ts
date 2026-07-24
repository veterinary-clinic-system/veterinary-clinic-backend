import {
  BadRequestException,
  Controller,
  ParseEnumPipe,
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
import { FilesService } from './files.service';
import { FileCategory } from './file-category.enum';
import { Public } from '@/common/decorators/public.decorator';

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

@ApiTags('files')
@Controller('files')
@UseGuards(ThrottlerGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * Public because Section 4's booking flow lets a Guest attach symptom photos before
   * an account exists. Rate-limited via Throttle + capped size/mime-type to bound abuse
   * of an unauthenticated upload endpoint.
   */
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
    @Query('category', new ParseEnumPipe(FileCategory)) category: FileCategory,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file was uploaded');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    return this.filesService.save(category, file);
  }
}
