import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  Error as MongooseError,
  type Model,
  type PipelineStage,
  type Types,
} from 'mongoose';
import { toMinor } from 'lib/money';
import {
  escapeRegex,
  pageOffset,
  paginationMeta,
  type Paginated,
} from 'lib/pagination';
import { allTermsMatch, relevanceScore, searchTerms } from 'lib/search';
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
import type { CreateMenuItemDto } from './dto/create-menu-item.dto';
import type {
  AdminListMenuItemsQuery,
  ListMenuItemsQuery,
  MenuSort,
} from './dto/list-menu-items.query';
import {
  toAdminMenuItem,
  toPublicMenuItem,
  type AdminMenuItem,
  type MenuItemRow,
  type PublicMenuItem,
} from './menu.mapper';

const MENU_ORDER = {
  'category.sortOrder': 1,
  'category.name': 1,
  sortOrder: 1,
  name: 1,
  _id: 1,
} as const;
const SORTS: Record<MenuSort, Record<string, 1 | -1>> = {
  relevance: { score: -1, ...MENU_ORDER },
  menu: MENU_ORDER,
  name: { name: 1, _id: 1 },
  price: { price: 1, name: 1, _id: 1 },
  '-price': { price: -1, name: 1, _id: 1 },
  newest: { createdAt: -1, _id: -1 },
};

const SEARCH_FIELDS = [
  'name',
  'description',
  'slug',
  'category.name',
  'dietaryTags',
  'badges',
] as const;

type Scope = 'public' | 'admin';

const VISIBLE = { $and: ['$isActive', '$category.isActive'] };

export type MenuItemNeighbors = {
  position: number;
  total: number;
  previous?: { slug: string; name: string };
  next?: { slug: string; name: string };
};

export type AdminMenuItemDetail = AdminMenuItem & {
  neighbors: MenuItemNeighbors;
};

export type MenuSummary = {
  totals: { all: number; visible: number; hidden: number; soldOut: number };
  categories: {
    id: string;
    slug: string;
    name: string;
    isActive: boolean;
    itemCount: number;
  }[];
};

@Injectable()
export class MenuService {
  constructor(
    @InjectModel(MenuItem.name)
    private readonly itemModel: Model<MenuItemDocument>,
    @InjectModel(MenuCategory.name)
    private readonly categoryModel: Model<MenuCategoryDocument>,
    private readonly media: MediaService,
  ) {}

  async createItem(dto: CreateMenuItemDto): Promise<AdminMenuItem> {
    const category = await this.categoryModel
      .findById(dto.categoryId, { name: 1, slug: 1, sortOrder: 1, isActive: 1 })
      .lean();
    if (!category)
      throw formError({
        categoryId: 'This category no longer exists. Pick another one.',
      });

    const slug = dto.slug
      ? await this.checkSlugIsFree(dto.slug)
      : await this.freeSlugFrom(dto.name);

    const variants = dto.variants.map((v) => ({
      ...v,
      price: toMinor(v.price),
    }));

    if (variants.length > 0 && !variants.some((v) => v.isDefault))
      variants[0].isDefault = true;

    const doc = new this.itemModel({
      name: dto.name,
      slug,
      description: dto.description ?? '',
      categoryId: category._id,
      price: dto.price === undefined ? undefined : toMinor(dto.price),
      compareAtPrice:
        dto.compareAtPrice === undefined
          ? undefined
          : toMinor(dto.compareAtPrice),
      variants,
      modifierGroups: dto.modifierGroups.map((group) => ({
        ...group,
        options: group.options.map((option) => ({
          ...option,
          priceDelta: toMinor(option.priceDelta ?? 0),
        })),
      })),
      dietaryTags: dto.dietaryTags,
      allergens: dto.allergens,
      spiceLevel: dto.spiceLevel,
      badges: dto.badges,
      calories: dto.calories,
      prepTimeMinutes: dto.prepTimeMinutes,
      isActive: dto.isActive,
      isAvailable: dto.isAvailable,
      sortOrder: dto.sortOrder ?? (await this.nextSortOrder(category._id)),
    });

    try {
      await doc.validate();
    } catch (error) {
      throw toFormError(error);
    }

    let photo: StoredImage | undefined;
    if (dto.image) {
      photo = await this.media.keepMenuImage(dto.image);
      doc.image = photo.key;
      doc.imageBlur = photo.blurDataURL;
    }

    try {
      await doc.save();
    } catch (error) {
      await this.media.deleteQuietly(photo?.key);
      if (isDuplicateKey(error)) throw slugTaken(slug);
      throw toFormError(error);
    }

    if (dto.image) void this.media.deleteQuietly(dto.image);

    const row: MenuItemRow = {
      ...doc.toObject(),
      category: {
        _id: category._id,
        name: category.name,
        slug: category.slug,
        sortOrder: category.sortOrder,
        isActive: category.isActive,
      },
    };
    return toAdminMenuItem(row);
  }

  private async freeSlugFrom(name: string): Promise<string> {
    const base = slugify(name) || 'item';
    const root = RESERVED_SLUGS.has(base) ? `${base}-item` : base;
    const taken = await this.itemModel
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
    if (await this.itemModel.exists({ slug })) throw slugTaken(slug);
    return slug;
  }

  private async nextSortOrder(categoryId: Types.ObjectId): Promise<number> {
    const last = await this.itemModel
      .findOne({ categoryId }, { sortOrder: 1 })
      .sort({ sortOrder: -1 })
      .lean();
    return last ? last.sortOrder + 1 : 0;
  }

  async getAdminItem(slug: string): Promise<AdminMenuItemDetail> {
    const [row] = await this.itemModel.aggregate<MenuItemRow>([
      { $match: { slug } },
      this.joinCategory(),
      { $unwind: '$category' },
      { $limit: 1 },
    ]);
    if (!row) throw new NotFoundException(`No dish with the URL id "${slug}"`);

    const siblings = await this.itemModel
      .find({ categoryId: row.categoryId }, { slug: 1, name: 1, _id: 0 })
      .sort({ sortOrder: 1, name: 1, _id: 1 })
      .lean();
    const index = siblings.findIndex((s) => s.slug === row.slug);
    const pick = (i: number) =>
      siblings[i]
        ? { slug: siblings[i].slug, name: siblings[i].name }
        : undefined;

    return {
      ...toAdminMenuItem(row),
      neighbors: {
        position: index + 1,
        total: siblings.length,
        previous: pick(index - 1),
        next: pick(index + 1),
      },
    };
  }

  listPublicItems(
    query: ListMenuItemsQuery,
  ): Promise<Paginated<PublicMenuItem>> {
    return this.list(query, 'public', toPublicMenuItem);
  }

  listAdminItems(
    query: AdminListMenuItemsQuery,
  ): Promise<Paginated<AdminMenuItem>> {
    return this.list(query, 'admin', toAdminMenuItem);
  }

  async summary(): Promise<MenuSummary> {
    const [totals] = await this.itemModel.aggregate<MenuSummary['totals']>([
      this.joinCategory(),
      { $unwind: '$category' },
      {
        $group: {
          _id: null,
          all: { $sum: 1 },
          visible: { $sum: { $cond: [VISIBLE, 1, 0] } },
          soldOut: { $sum: { $cond: ['$isAvailable', 0, 1] } },
        },
      },
      {
        $project: {
          _id: 0,
          all: 1,
          visible: 1,
          soldOut: 1,
          hidden: { $subtract: ['$all', '$visible'] },
        },
      },
    ]);

    const categories = await this.categoryModel.aggregate<{
      _id: unknown;
      slug: string;
      name: string;
      isActive: boolean;
      itemCount: number;
    }>([
      { $sort: { sortOrder: 1, name: 1, _id: 1 } },
      {
        $lookup: {
          from: this.itemModel.collection.name,
          localField: '_id',
          foreignField: 'categoryId',
          as: 'items',
          pipeline: [{ $project: { _id: 1 } }],
        },
      },
      {
        $project: {
          slug: 1,
          name: 1,
          isActive: 1,
          itemCount: { $size: '$items' },
        },
      },
    ]);

    return {
      totals: totals ?? { all: 0, visible: 0, hidden: 0, soldOut: 0 },
      categories: categories.map((c) => ({
        id: String(c._id),
        slug: c.slug,
        name: c.name,
        isActive: c.isActive,
        itemCount: c.itemCount,
      })),
    };
  }

  private joinCategory(): PipelineStage.Lookup {
    return {
      $lookup: {
        from: this.categoryModel.collection.name,
        localField: 'categoryId',
        foreignField: '_id',
        as: 'category',
        pipeline: [
          { $project: { name: 1, slug: 1, sortOrder: 1, isActive: 1 } },
        ],
      },
    };
  }

  private async list<T>(
    query: AdminListMenuItemsQuery,
    scope: Scope,
    map: (row: MenuItemRow) => T,
  ): Promise<Paginated<T>> {
    const { page, limit } = query;
    const terms = searchTerms(query.search);

    const sort: MenuSort =
      query.sort === 'relevance' || !query.sort
        ? terms.length
          ? 'relevance'
          : 'menu'
        : query.sort;

    const match: Record<string, unknown> = {};
    if (scope === 'public') match.isActive = true;
    if (query.available !== undefined) match.isAvailable = query.available;

    if (query.category) {
      const category = await this.categoryModel
        .findOne(
          {
            slug: query.category,
            ...(scope === 'public' && { isActive: true }),
          },
          { _id: 1 },
        )
        .lean();
      if (!category) return { items: [], meta: paginationMeta(page, limit, 0) };
      match.categoryId = category._id;
    }

    const afterJoin: Record<string, unknown>[] = [];
    if (scope === 'public') afterJoin.push({ 'category.isActive': true });
    if (scope === 'admin' && query.visibility === 'visible')
      afterJoin.push({ $expr: VISIBLE });
    if (scope === 'admin' && query.visibility === 'hidden')
      afterJoin.push({ $expr: { $not: [VISIBLE] } });
    if (terms.length) afterJoin.push(allTermsMatch(terms, SEARCH_FIELDS));

    const pipeline: PipelineStage[] = [
      { $match: match },
      this.joinCategory(),
      { $unwind: '$category' },
      ...(afterJoin.length
        ? [
            {
              $match:
                afterJoin.length === 1 ? afterJoin[0] : { $and: afterJoin },
            },
          ]
        : []),
      ...(sort === 'relevance'
        ? [{ $addFields: { score: relevanceScore(query.search ?? '', terms) } }]
        : []),
      {
        $facet: {
          items: [
            { $sort: SORTS[sort] },
            { $skip: pageOffset(page, limit) },
            { $limit: limit },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await this.itemModel.aggregate<{
      items: MenuItemRow[];
      total: { count: number }[];
    }>(pipeline);
    const total = result?.total[0]?.count ?? 0;

    return {
      items: (result?.items ?? []).map(map),
      meta: paginationMeta(page, limit, total),
    };
  }
}

function formError(
  errors: Record<string, string>,
  message = 'Please fix the highlighted fields',
) {
  return new BadRequestException({ statusCode: 400, message, errors });
}

function slugTaken(slug: string) {
  const message = `Another dish already uses "${slug}".`;
  return new ConflictException({
    statusCode: 409,
    message,
    errors: { slug: message },
  });
}

function toFormError(error: unknown): unknown {
  if (!(error instanceof MongooseError.ValidationError)) return error;
  const errors: Record<string, string> = {};
  for (const [path, issue] of Object.entries(error.errors))
    errors[path] = issue.message;
  return formError(errors);
}

const isDuplicateKey = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: number }).code === 11000;
