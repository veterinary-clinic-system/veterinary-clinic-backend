import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { Public } from '@/shared/common/decorators/public.decorator';
import { ItemType } from '@/shared/common/enums/item-type.enum';
import { CategoriesService } from '@/modules/catalog/application/categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

/**
 * SRS FR-16 - danh muc hang hoa.
 *
 * Doc la `@Public()` giong cac route danh muc khac (`/catalog/items`,
 * `/catalog/services`): trang gia cong khai va man hinh dat lich deu can loc theo danh
 * muc ma khong co token. Ghi doi `CATALOG_MANAGE` (ADMIN, MANAGER, PHARMACIST theo ma
 * tran hien tai).
 */
@ApiTags('catalog')
@Controller('catalog/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  /** Tra ve DANG CAY (acceptance FR-16), khong phai danh sach phang. */
  @Public()
  @Get()
  findTree(
    @Query('itemType') itemType?: ItemType,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.categoriesService.findTree(itemType, includeInactive === 'true');
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.findOne(id);
  }

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.remove(id);
  }
}
