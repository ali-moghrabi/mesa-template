import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, PipelineStage } from 'mongoose';
import { pageOffset, paginationMeta, type Paginated } from 'lib/pagination';
import { allTermsMatch, relevanceScore, searchTerms } from 'lib/search';
import {
  MenuCategory,
  type MenuCategoryDocument,
} from 'src/schemas/category.schema';
import { MenuItem, type MenuItemDocument } from 'src/schemas/item.schema';
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
  ) {}

  /** Guests: only dishes and categories that are switched on. */
  listPublicItems(
    query: ListMenuItemsQuery,
  ): Promise<Paginated<PublicMenuItem>> {
    return this.list(query, 'public', toPublicMenuItem);
  }

  /** Admin panel: everything, including hidden dishes and hidden categories. */
  listAdminItems(
    query: AdminListMenuItemsQuery,
  ): Promise<Paginated<AdminMenuItem>> {
    return this.list(query, 'admin', toAdminMenuItem);
  }

  /**
   * The numbers at the top of the admin menu page and the category filter.
   * Counts ignore the current search on purpose: they describe the whole menu.
   */
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
