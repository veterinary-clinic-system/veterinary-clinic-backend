import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { Permission } from '@/shared/common/enums/permission.enum';
import { PosService } from '@/modules/sales/application/pos.service';
import { AddCartItemDto, SetCartItemQuantityDto } from './dto/add-cart-item.dto';
import { CheckoutCartDto } from './dto/checkout-cart.dto';
import { CreateCartDto } from './dto/create-cart.dto';
import { QueryCartsDto } from './dto/query-carts.dto';
import { SearchPosProductsDto } from './dto/search-pos-products.dto';
import { SetCartDiscountDto } from './dto/set-cart-discount.dto';

/**
 * Ban hang tai quay - SRS muc 15 (`/api/pos`), FR-19.
 *
 * Toan bo be mat nay dung MOT quyen `POS_SELL` (STAFF, RECEPTIONIST, MANAGER, ADMIN).
 * Khong tach quyen rieng cho "sua gio" va "thanh toan": o quay chi co mot nguoi lam ca
 * hai viec, tach ra chi tao ra mot ma tran quyen khong ai cau hinh dung. Cai PHAI tach
 * la hoan tien - no nam o `BillingController` voi `PAYMENT_REFUND`.
 */
@ApiTags('pos')
@Controller('pos')
export class PosController {
  constructor(private readonly posService: PosService) {}

  /** O tim san pham cua man hinh POS - tra ve SO BAN DUOC, khong phai so ton tong. */
  @RequirePermissions(Permission.POS_SELL)
  @Get('products')
  searchProducts(@Query() query: SearchPosProductsDto) {
    return this.posService.searchProducts(query);
  }

  @RequirePermissions(Permission.POS_SELL)
  @Post('carts')
  createCart(@Body() dto: CreateCartDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.posService.createCart(dto, actor.userId);
  }

  @RequirePermissions(Permission.POS_SELL)
  @Get('carts')
  findAll(@Query() query: QueryCartsDto) {
    return this.posService.findAll(query);
  }

  @RequirePermissions(Permission.POS_SELL)
  @Get('carts/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.posService.findOne(id);
  }

  @RequirePermissions(Permission.POS_SELL)
  @Post('carts/:id/items')
  addItem(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddCartItemDto) {
    return this.posService.addItem(id, dto);
  }

  @RequirePermissions(Permission.POS_SELL)
  @Patch('carts/:id/items/:itemId')
  setItemQuantity(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: SetCartItemQuantityDto,
  ) {
    return this.posService.setItemQuantity(id, itemId, dto.quantity);
  }

  @RequirePermissions(Permission.POS_SELL)
  @Delete('carts/:id/items/:itemId')
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.posService.removeItem(id, itemId);
  }

  /** Giam gia thu cong muc gio hang - P8-T6. Nguoi ap duoc ghi lai cho audit (P10). */
  @RequirePermissions(Permission.POS_SELL)
  @Patch('carts/:id/discount')
  setDiscount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCartDiscountDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.posService.setDiscount(id, dto, actor.userId);
  }

  /** UC-04 - mot transaction: kiem ton, lap hoa don, ghi tien, tru kho. */
  @RequirePermissions(Permission.POS_SELL)
  @Post('carts/:id/checkout')
  checkout(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckoutCartDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.posService.checkout(id, dto, actor.userId);
  }

  @RequirePermissions(Permission.POS_SELL)
  @Post('carts/:id/abandon')
  abandon(@Param('id', ParseUUIDPipe) id: string) {
    return this.posService.abandon(id);
  }
}
