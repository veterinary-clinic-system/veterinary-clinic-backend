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
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { Role } from '@/shared/common/enums/role.enum';
import { BranchesService } from '@/modules/organization/application/branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { OperatingHourDto } from './dto/operating-hour.dto';

@ApiTags('branches')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Public()
  @Get()
  findAllPublic() {
    return this.branchesService.findAllPublic();
  }

  @Roles(Role.ADMIN)
  @RequirePermissions(Permission.BRANCH_MANAGE)
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
  @RequirePermissions(Permission.BRANCH_MANAGE)
  @Post()
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Roles(Role.ADMIN)
  @RequirePermissions(Permission.BRANCH_MANAGE)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @RequirePermissions(Permission.BRANCH_MANAGE)
  @Put(':id/opening-hours')
  replaceOpeningHours(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ParseArrayPipe({ items: OperatingHourDto })) hours: OperatingHourDto[],
  ) {
    return this.branchesService.replaceOpeningHours(id, hours);
  }
}
