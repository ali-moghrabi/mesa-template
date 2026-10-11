import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, Types } from 'mongoose';
import {
  fieldConflict,
  formError,
  isDuplicateKey,
  toFormError,
} from 'lib/form-errors';
import { mediaUrl } from 'lib/media-url';
import { escapeRegex } from 'lib/pagination';
import { RESERVED_SLUGS, slugify } from 'lib/slug';
import {
  MediaService,
  type StoredImage,
} from 'src/features/media/media.service';
import {
  MenuCategory,
  type MenuCategoryDocument,
} from 'src/schemas/category.schema';
import { MenuItem, type MenuItemDocument } from 'src/schemas/item.schema';
import type { CreateMenuCategoryDto } from './dto/create-category.dto';

export type AdminMenuCategory = {
  id: string;
  slug: string;
  name: string;
  description: string;
  image?: string;
  imageBlur?: string;
  sortOrder: number;
  isActive: boolean;
  servingHours: { days: string[]; from: string; to: string }[];
  itemCount: number;
  soldOutCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type CategoryRow = MenuCategory & {
  _id: Types.ObjectId;
  itemCount?: number;
  soldOutCount?: number;
};

const toAdminCategory = (row: CategoryRow): AdminMenuCategory => ({
  id: String(row._id),
  slug: row.slug,
  name: row.name,
  description: row.description ?? '',
  image: mediaUrl(row.image),
  imageBlur: row.imageBlur,
  sortOrder: row.sortOrder,
  isActive: row.isActive,
  servingHours: (row.servingHours ?? []).map((w) => ({
    days: w.days ?? [],
    from: w.from,
    to: w.to,
  })),
  itemCount: row.itemCount ?? 0,
  soldOutCount: row.soldOutCount ?? 0,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

@Injectable()
export class MenuCategoriesService {
  constructor(
    @InjectModel(MenuCategory.name)
    private readonly categoryModel: Model<MenuCategoryDocument>,
    @InjectModel(MenuItem.name)
    private readonly itemModel: Model<MenuItemDocument>,
    private readonly media: MediaService,
  ) {}

  async list(): Promise<AdminMenuCategory[]> {
    const rows = await this.categoryModel.aggregate<CategoryRow>([
      { $sort: { sortOrder: 1, name: 1, _id: 1 } },
      {
        $lookup: {
          from: this.itemModel.collection.name,
          localField: '_id',
          foreignField: 'categoryId',
          as: 'counts',
          pipeline: [
            {
              $group: {
                _id: null,
                itemCount: { $sum: 1 },
                soldOutCount: { $sum: { $cond: ['$isAvailable', 0, 1] } },
              },
            },
          ],
        },
      },
      {
        $set: {
          itemCount: { $ifNull: [{ $first: '$counts.itemCount' }, 0] },
          soldOutCount: { $ifNull: [{ $first: '$counts.soldOutCount' }, 0] },
        },
      },
      { $unset: 'counts' },
    ]);
    return rows.map(toAdminCategory);
  }

  async create(dto: CreateMenuCategoryDto): Promise<AdminMenuCategory> {
    const sameTime = dto.servingHours.findIndex((w) => w.from === w.to);
    if (sameTime >= 0)
      throw formError({
        [`servingHours.${sameTime}.to`]:
          'The end time must differ from the start',
      });

    const slug = dto.slug
      ? await this.checkSlugIsFree(dto.slug)
      : await this.freeSlugFrom(dto.name);

    const doc = new this.categoryModel({
      name: dto.name,
      slug,
      description: dto.description ?? '',
      isActive: dto.isActive,
      servingHours: dto.servingHours,
      sortOrder: dto.sortOrder ?? (await this.nextSortOrder()),
    });

    try {
      await doc.validate();
    } catch (error) {
      throw toFormError(error);
    }

    let cover: StoredImage | undefined;
    if (dto.image) {
      cover = await this.media.keepMenuImage(dto.image);
      doc.image = cover.key;
      doc.imageBlur = cover.blurDataURL;
    }

    try {
      await doc.save();
    } catch (error) {
      await this.media.deleteQuietly(cover?.key);
      if (isDuplicateKey(error)) throw slugTaken(slug);
      throw toFormError(error);
    }

    if (dto.image) void this.media.deleteQuietly(dto.image);

    return toAdminCategory({
      ...doc.toObject(),
      itemCount: 0,
      soldOutCount: 0,
    });
  }

  async deleteMany(
    ids: string[],
    deleteDishes: boolean,
  ): Promise<{
    deleted: number;
    dishesDeleted: number;
    photosDeleted: number;
  }> {
    const categories = await this.categoryModel
      .find({ _id: { $in: ids } }, { name: 1, image: 1 })
      .lean();
    if (categories.length === 0)
      throw new NotFoundException('These categories no longer exist');
    const categoryIds = categories.map((c) => c._id);

    if (!deleteDishes) {
      const dishCount = await this.itemModel.countDocuments({
        categoryId: { $in: categoryIds },
      });
      if (dishCount > 0) {
        throw new ConflictException(
          `${dishCount} ${dishCount === 1 ? 'dish is' : 'dishes are'} still in ${
            categories.length === 1 ? categories[0].name : 'these categories'
          }. Delete them too, or move them to another category first.`,
        );
      }
    }

    const { deletedCount } = await this.categoryModel.deleteMany({
      _id: { $in: categoryIds },
    });

    let dishPhotos: (string | undefined)[] = [];
    let dishesDeleted = 0;
    if (deleteDishes) {
      const dishes = await this.itemModel
        .find({ categoryId: { $in: categoryIds } }, { image: 1 })
        .lean();
      if (dishes.length) {
        dishesDeleted = (
          await this.itemModel.deleteMany({
            _id: { $in: dishes.map((d) => d._id) },
          })
        ).deletedCount;
        dishPhotos = dishes.map((d) => d.image);
      }
    }

    const photosDeleted = await this.media.deleteManyQuietly([
      ...categories.map((c) => c.image),
      ...dishPhotos,
    ]);
    return { deleted: deletedCount, dishesDeleted, photosDeleted };
  }

  private async freeSlugFrom(name: string): Promise<string> {
    const base = slugify(name) || 'category';
    const root = RESERVED_SLUGS.has(base) ? `${base}-menu` : base;
    const taken = await this.categoryModel
      .find(
        { slug: new RegExp(`^${escapeRegex(root)}(-\\d+)?$`) },
        { slug: 1, _id: 0 },
      )
      .lean();
    const used = new Set(taken.map((t) => t.slug));
    if (!used.has(root)) return root;
    let n = 2;
    while (used.has(`${root}-${n}`)) n++;
    return `${root}-${n}`;
  }

  private async checkSlugIsFree(slug: string): Promise<string> {
    if (RESERVED_SLUGS.has(slug))
      throw formError({ slug: `"${slug}" is reserved. Pick another one.` });
    if (await this.categoryModel.exists({ slug })) throw slugTaken(slug);
    return slug;
  }

  private async nextSortOrder(): Promise<number> {
    const last = await this.categoryModel
      .findOne({}, { sortOrder: 1 })
      .sort({ sortOrder: -1 })
      .lean();
    return last ? last.sortOrder + 1 : 0;
  }
}

const slugTaken = (slug: string) =>
  fieldConflict('slug', `Another category already uses "${slug}".`);
