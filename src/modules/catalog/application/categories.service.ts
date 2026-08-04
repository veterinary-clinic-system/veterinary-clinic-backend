import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Category } from '@/modules/catalog/domain/entities/category.entity';
import { Item } from '@/modules/catalog/domain/entities/item.entity';
import { ItemType } from '@/shared/common/enums/item-type.enum';
import { CreateCategoryDto } from '@/modules/catalog/presentation/dto/create-category.dto';
import { UpdateCategoryDto } from '@/modules/catalog/presentation/dto/update-category.dto';

/** Mot nut cua cay danh muc tra ve cho giao dien. */
export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Item) private readonly itemsRepository: Repository<Item>,
  ) {}

  async create(dto: CreateCategoryDto): Promise<Category> {
    await this.assertCodeIsFree(dto.code, null);

    if (dto.parentId) {
      const parent = await this.loadOrThrow(dto.parentId);
      this.assertSameItemType(parent, dto.itemType);
    }

    const category = this.categoriesRepository.create({
      categoryName: dto.categoryName,
      code: dto.code,
      itemType: dto.itemType,
      parentId: dto.parentId ?? null,
      active: true,
    });
    return this.categoriesRepository.save(category);
  }

  /**
   * Tra ve DANG CAY, khong phai danh sach phang (acceptance FR-16).
   *
   * Nap toan bo bang mot lan roi dung cay trong bo nho, thay vi truy van de quy: danh
   * muc cua mot phong kham la hang chuc dong chu khong phai hang van, va mot truy van
   * phang doc mot lan van re hon mot `WITH RECURSIVE` cong nhieu vong di ve.
   */
  async findTree(itemType?: ItemType, includeInactive = false): Promise<CategoryTreeNode[]> {
    const all = await this.categoriesRepository.find({
      where: {
        ...(itemType ? { itemType } : {}),
        ...(includeInactive ? {} : { active: true }),
      },
      order: { categoryName: 'ASC' },
    });

    const byId = new Map<string, CategoryTreeNode>(
      all.map((category) => [category.id, { ...category, children: [] } as CategoryTreeNode]),
    );

    const roots: CategoryTreeNode[] = [];
    for (const node of byId.values()) {
      // Danh muc co cha nhung cha bi loc ra (khac itemType, hoac dang inactive khi
      // `includeInactive=false`) duoc coi la goc - de no khong bien mat khoi cay.
      const parent = node.parentId ? byId.get(node.parentId) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async findOne(id: string): Promise<Category> {
    return this.loadOrThrow(id);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.loadOrThrow(id);

    if (dto.code !== undefined) {
      await this.assertCodeIsFree(dto.code, id);
    }

    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) {
        throw new BadRequestException('Một danh mục không thể là danh mục cha của chính nó.');
      }
      const parent = await this.loadOrThrow(dto.parentId);
      this.assertSameItemType(parent, category.itemType);
      await this.assertNotDescendant(id, dto.parentId);
    }

    await this.categoriesRepository.update(id, {
      ...(dto.categoryName !== undefined ? { categoryName: dto.categoryName } : {}),
      ...(dto.code !== undefined ? { code: dto.code } : {}),
      ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    });

    return this.loadOrThrow(id);
  }

  /**
   * Xoa mem. Chan khi danh muc con con hoac con hang ben trong (acceptance FR-16):
   * xoa mot danh muc dang chua hang se lam ca nhom hang do bien mat khoi bo loc ma
   * khong ai biet - nguoi dung phai chuyen hang di truoc, mot cach co y thuc.
   */
  async remove(id: string): Promise<void> {
    await this.loadOrThrow(id);

    const childCount = await this.categoriesRepository.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new ConflictException(
        `Không thể xoá: danh mục này còn ${childCount} danh mục con. Hãy xoá hoặc chuyển chúng trước.`,
      );
    }

    const itemCount = await this.itemsRepository.count({ where: { categoryId: id } });
    if (itemCount > 0) {
      throw new ConflictException(
        `Không thể xoá: còn ${itemCount} mặt hàng thuộc danh mục này. Hãy chuyển chúng sang danh mục khác trước.`,
      );
    }

    await this.categoriesRepository.softDelete(id);
  }

  private async loadOrThrow(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục');
    }
    return category;
  }

  private assertSameItemType(parent: Category, itemType: ItemType): void {
    if (parent.itemType !== itemType) {
      throw new BadRequestException(
        `Danh mục cha "${parent.categoryName}" thuộc loại ${parent.itemType}, không thể chứa danh mục loại ${itemType}.`,
      );
    }
  }

  /**
   * Chan chu trinh: dat A lam con cua B trong khi B dang la hau due cua A se tao mot
   * vong kin, va moi lan duyet cay sau do se lap vo tan. Chi muc CSDL khong bat duoc
   * viec nay (`chk_categories_not_self_parent` chi chan vong do dai 1).
   */
  private async assertNotDescendant(id: string, candidateParentId: string): Promise<void> {
    const seen = new Set<string>([id]);
    let cursor: string | null = candidateParentId;

    while (cursor) {
      if (seen.has(cursor)) {
        throw new BadRequestException(
          'Không thể đặt danh mục này làm con của một danh mục nằm bên dưới nó (sẽ tạo vòng lặp).',
        );
      }
      seen.add(cursor);
      const parent: Category | null = await this.categoriesRepository.findOne({
        where: { id: cursor },
        select: { id: true, parentId: true },
      });
      cursor = parent?.parentId ?? null;
    }
  }

  /**
   * Chi muc `uq_categories_code` la chot chan cuoi, nhung de no bat thi nguoi dung nhan
   * mot loi 500 kho hieu thay vi biet ma nao dang bi trung.
   */
  private async assertCodeIsFree(code: string, excludeId: string | null): Promise<void> {
    const existing = await this.categoriesRepository.findOne({
      where: excludeId ? { code, id: Not(excludeId), deletedAt: IsNull() } : { code },
    });
    if (existing) {
      throw new ConflictException(
        `Mã danh mục "${code}" đã được dùng cho "${existing.categoryName}".`,
      );
    }
  }
}
