import {
  Body,
  Controller,
  Get,
  Param,
  ParseArrayPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@/shared/common/decorators/public.decorator';
import { Roles } from '@/shared/common/decorators/roles.decorator';
import { Role } from '@/shared/common/enums/role.enum';
import { BranchesService } from '@/modules/organization/application/branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { OperatingHourDto } from './dto/operating-hour.dto';

@ApiTags('branches')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  /** Public listing - active branches only. `GET /branches/admin` below is the staff view. */
  @Public()
  @Get()
  findAllPublic() {
    return this.branchesService.findAllPublic();
  }

  /**
   * Declared before `GET :id` (and uses a literal path Nest/Express matches before the
   * generic wildcard) so a request to `/branches/admin` isn't swallowed by `:id`.
   */
  @Roles(Role.ADMIN)
  @Get('admin')
  findAllAdmin() {
    return this.branchesService.findAllAdmin();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.branchesService.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(id, dto);
  }

  /** Body is a raw JSON array, so `ParseArrayPipe` (not a wrapper DTO) validates each item. */
  @Roles(Role.ADMIN)
  @Put(':id/opening-hours')
  replaceOpeningHours(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ParseArrayPipe({ items: OperatingHourDto })) hours: OperatingHourDto[],
  ) {
    return this.branchesService.replaceOpeningHours(id, hours);
  }
}
