import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { Item } from '@/modules/catalog/domain/entities/item.entity';
import { Product } from '@/modules/catalog/domain/entities/product.entity';
import { ItemType } from '@/shared/common/enums/item-type.enum';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import { CreateProductDto } from '@/modules/catalog/presentation/dto/create-product.dto';
import { UpdateProductDto } from '@/modules/catalog/presentation/dto/update-product.dto';
import { QueryProductsDto } from '@/modules/catalog/presentation/dto/query-products.dto';

const ITEM_SORT_COLUMNS = new Set(['itemName', 'unitPrice', 'code']);
const PRODUCT_SORT_COLUMNS = new Set(['sku', 'brand', 'costPrice', 'createdAt', 'updatedAt']);

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly productsRepository: Repository<Product>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateProductDto): Promise<Product> {
    await this.assertSkuIsFree(dto.sku, null);

    const productId = await this.dataSource.transaction(async (manager) => {
      const item = await manager.save(
        manager.create(Item, {
          itemName: dto.itemName,
          imageUrl: dto.imageUrl ?? '/images/default-item.svg',
          describe: dto.describe ?? null,
          itemType: ItemType.PRODUCT,
          unitPrice: dto.unitPrice,
          categoryId: dto.categoryId ?? null,
          active: true,
        }),
      );

      const product = await manager.save(
        manager.create(Product, {
          itemId: item.id,
          sku: dto.sku,
          brand: dto.brand ?? null,
          unit: dto.unit,
          costPrice: dto.costPrice ?? 0,
          minimumStock: dto.minimumStock ?? 0,
          active: true,
        }),
      );

      return product.id;
    });

    return this.findOne(productId);
  }

  async findAll(query: QueryProductsDto): Promise<PaginatedResultDto<Product>> {
    const qb = this.productsRepository
      .createQueryBuilder('product')
      .innerJoinAndSelect('product.item', 'item')
      .leftJoinAndSelect('item.category', 'category');

    if (query.search?.trim()) {
      qb.andWhere(
        `(f_unaccent(item.item_name) ILIKE f_unaccent(:search)
          OR product.sku ILIKE :search
          OR item.code ILIKE :search)`,
        { search: `%${query.search.trim()}%` },
      );
    }
    if (query.categoryId) {
      qb.andWhere('item.category_id = :categoryId', { categoryId: query.categoryId });
    }
    qb.andWhere('product.active = :active', { active: query.active ?? true });

    const requestedSort = query.sortBy;
    const sortColumn = ITEM_SORT_COLUMNS.has(requestedSort ?? '')
      ? `item.${requestedSort}`
      : PRODUCT_SORT_COLUMNS.has(requestedSort ?? '')
        ? `product.${requestedSort}`
        : 'item.itemName';

    qb.orderBy(sortColumn, query.sortOrder ?? 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: ['item', 'item.category'],
    });
    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);

    if (dto.sku !== undefined) {
      await this.assertSkuIsFree(dto.sku, id);
    }

    await this.dataSource.transaction(async (manager) => {

      const itemUpdates: Partial<
        Pick<Item, 'itemName' | 'imageUrl' | 'describe' | 'unitPrice' | 'categoryId' | 'active'>
      > = {};
      if (dto.itemName !== undefined) itemUpdates.itemName = dto.itemName;
      if (dto.imageUrl !== undefined) itemUpdates.imageUrl = dto.imageUrl;
      if (dto.describe !== undefined) itemUpdates.describe = dto.describe;
      if (dto.unitPrice !== undefined) itemUpdates.unitPrice = dto.unitPrice;
      if (dto.categoryId !== undefined) itemUpdates.categoryId = dto.categoryId;
      if (dto.active !== undefined) itemUpdates.active = dto.active;
      if (Object.keys(itemUpdates).length > 0) {
        await manager.update(Item, product.itemId, itemUpdates);
      }

      const productUpdates: Partial<
        Pick<Product, 'sku' | 'brand' | 'unit' | 'costPrice' | 'minimumStock' | 'active'>
      > = {};
      if (dto.sku !== undefined) productUpdates.sku = dto.sku;
      if (dto.brand !== undefined) productUpdates.brand = dto.brand;
      if (dto.unit !== undefined) productUpdates.unit = dto.unit;
      if (dto.costPrice !== undefined) productUpdates.costPrice = dto.costPrice;
      if (dto.minimumStock !== undefined) productUpdates.minimumStock = dto.minimumStock;
      if (dto.active !== undefined) productUpdates.active = dto.active;
      if (Object.keys(productUpdates).length > 0) {
        await manager.update(Product, id, productUpdates);
      }
    });

    return this.findOne(id);
  }

  private async assertSkuIsFree(sku: string, excludeId: string | null): Promise<void> {
    const existing = await this.productsRepository.findOne({
      where: excludeId ? { sku, id: Not(excludeId), deletedAt: IsNull() } : { sku },
      relations: ['item'],
    });
    if (existing) {
      throw new ConflictException(`SKU "${sku}" đã được dùng cho "${existing.item.itemName}".`);
    }
  }
}
