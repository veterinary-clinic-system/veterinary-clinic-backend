import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { Permission } from '@/shared/common/enums/permission.enum';
import { StockTakesService } from '@/modules/catalog/application/stock-takes.service';
import {
  ConfirmStockTakeDto,
  CreateStockTakeDto,
  SubmitStockTakeCountsDto,
} from './dto/create-stock-take.dto';
import { QueryStockTakesDto } from './dto/query-stock-takes.dto';

/**
 * Kiem ke - SRS FR-18-03.
 *
 * TAO phieu cung doi `INVENTORY_EXPORT` chu khong chi `INVENTORY_VIEW`: phieu kiem ke
 * chup so ton he thong ngay luc tao, va so do chinh la moc de dieu chinh ton sau nay.
 * Cho nguoi chi co quyen xem tao phieu thi ho quyet dinh duoc moc so sanh cua mot lan
 * dieu chinh ma ho khong duoc phep thuc hien.
 */
@ApiTags('catalog')
@Controller('catalog/stock-takes')
export class StockTakesController {
  constructor(private readonly stockTakesService: StockTakesService) {}

  @RequirePermissions(Permission.INVENTORY_VIEW)
  @Get()
  findAll(@Query() query: QueryStockTakesDto) {
    return this.stockTakesService.findAll(query);
  }

  @RequirePermissions(Permission.INVENTORY_VIEW)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.stockTakesService.findOne(id);
  }

  @RequirePermissions(Permission.INVENTORY_EXPORT)
  @Post()
  create(@Body() dto: CreateStockTakeDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.stockTakesService.create(dto, actor.userId);
  }

  @RequirePermissions(Permission.INVENTORY_EXPORT)
  @Patch(':id/counts')
  submitCounts(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitStockTakeCountsDto) {
    return this.stockTakesService.submitCounts(id, dto);
  }

  @RequirePermissions(Permission.INVENTORY_EXPORT)
  @Post(':id/confirm')
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmStockTakeDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.stockTakesService.confirm(id, dto, actor.userId);
  }

  @RequirePermissions(Permission.INVENTORY_EXPORT)
  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.stockTakesService.cancel(id);
  }
}
