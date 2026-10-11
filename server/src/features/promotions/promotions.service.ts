import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Types, type Model } from 'mongoose';
import { formError } from 'lib/form-errors';
import { mediaUrl } from 'lib/media-url';
import { fromMinor } from 'lib/money';
import { isValidTimeZone } from 'lib/opening-hours';
import {
  appliesTo,
  bestSale,
  localClock,
  minutesUntilNextChange,
  promotionIssues,
  promotionState,
  salePrice,
  type PromotionRule,
  type PromotionState,
} from 'lib/promotions';
import {
  MenuCategory,
  type MenuCategoryDocument,
} from 'src/schemas/category.schema';
import { MenuItem, type MenuItemDocument } from 'src/schemas/item.schema';
import {
  Promotion,
  type PromotionDocument,
} from 'src/schemas/promotion.schema';
import type { SavePromotionDto } from './dto/promotion.dto';

export type AdminPromotion = PromotionRule & {
  status: PromotionState;
  affectedCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PromotionCatalog = {
  categories: {
    id: string;
    name: string;
    isActive: boolean;
    itemCount: number;
  }[];
  dishes: {
    id: string;
    name: string;
    categoryId: string;
    image?: string;
    imageBlur?: string;
    price: number;
    priceMinor: number;
    variants: { id: string; name: string; price: number; priceMinor: number }[];
    isVisible: boolean;
  }[];
};

export type DishSale = {
  id: string;
  name: string;
  percentOff: number;
  endsAt: string | null;
  timezone: string;
};

export class Pricing {
  constructor(
    private readonly rules: PromotionRule[],
    private readonly now: Date,
  ) {}

  saleFor(dish: { id: string; categoryId: string }) {
    const sale = bestSale(this.rules, dish, this.now);
    if (!sale) return null;
    const { rule, endsAt } = sale;
    return {
      info: {
        id: rule.id,
        name: rule.name,
        percentOff: rule.percentOff,
        endsAt,
        timezone: rule.timezone,
      } satisfies DishSale,
      price: (minor: number) => salePrice(minor, rule),
    };
  }

  get secondsUntilNextChange(): number | null {
    const minutes = minutesUntilNextChange(this.rules, this.now);
    return minutes === null ? null : Math.max(30, Math.round(minutes * 60));
  }
}

const CACHE_MS = 30_000;

@Injectable()
export class PromotionsService {
  private cache: { rules: PromotionRule[]; at: number } | null = null;

  constructor(
    @InjectModel(Promotion.name)
    private readonly promotionModel: Model<PromotionDocument>,
    @InjectModel(MenuItem.name)
    private readonly itemModel: Model<MenuItemDocument>,
    @InjectModel(MenuCategory.name)
    private readonly categoryModel: Model<MenuCategoryDocument>,
  ) {}

  async pricing(now: Date = new Date()): Promise<Pricing> {
    if (!this.cache || Date.now() - this.cache.at > CACHE_MS) {
      const rows = await this.promotionModel.find({ isActive: true }).lean();
      this.cache = { rules: rows.map(toRule), at: Date.now() };
    }
    return new Pricing(this.cache.rules, now);
  }

  async list(): Promise<AdminPromotion[]> {
    const [rows, dishes] = await Promise.all([
      this.promotionModel.find().sort({ createdAt: -1 }).lean(),
      this.itemModel.find({}, { categoryId: 1 }).lean(),
    ]);
    const now = new Date();
    const light = dishes.map((d) => ({
      id: String(d._id),
      categoryId: String(d.categoryId),
    }));
    return rows.map((row) => toAdmin(row, light, now));
  }

  async get(id: string): Promise<AdminPromotion> {
    const row = await this.findRow(id);
    const dishes = await this.itemModel.find({}, { categoryId: 1 }).lean();
    return toAdmin(
      row,
      dishes.map((d) => ({
        id: String(d._id),
        categoryId: String(d.categoryId),
      })),
      new Date(),
    );
  }

  async catalog(): Promise<PromotionCatalog> {
    const [categories, dishes] = await Promise.all([
      this.categoryModel
        .find({}, { name: 1, isActive: 1, sortOrder: 1 })
        .sort({ sortOrder: 1, name: 1 })
        .lean(),
      this.itemModel
        .find(
          {},
          {
            name: 1,
            categoryId: 1,
            image: 1,
            imageBlur: 1,
            price: 1,
            variants: 1,
            isActive: 1,
            sortOrder: 1,
          },
        )
        .sort({ sortOrder: 1, name: 1 })
        .lean(),
    ]);
    const activeCategory = new Map(
      categories.map((c) => [String(c._id), c.isActive]),
    );
    return {
      categories: categories.map((c) => ({
        id: String(c._id),
        name: c.name,
        isActive: c.isActive,
        itemCount: dishes.filter((d) => String(d.categoryId) === String(c._id))
          .length,
      })),
      dishes: dishes.map((d) => ({
        id: String(d._id),
        name: d.name,
        categoryId: String(d.categoryId),
        image: mediaUrl(d.image),
        imageBlur: d.imageBlur,
        price: fromMinor(d.price) ?? 0,
        priceMinor: d.price,
        variants: (d.variants ?? []).map((v) => ({
          id: String(v._id),
          name: v.name,
          price: fromMinor(v.price) ?? 0,
          priceMinor: v.price,
        })),
        isVisible:
          d.isActive && activeCategory.get(String(d.categoryId)) === true,
      })),
    };
  }

  async create(dto: SavePromotionDto): Promise<AdminPromotion> {
    const fields = await this.checked(dto);
    const row = await this.promotionModel.create(fields);
    this.cache = null;
    return this.get(String(row._id));
  }

  async update(id: string, dto: SavePromotionDto): Promise<AdminPromotion> {
    await this.findRow(id);
    const fields = await this.checked(dto);
    await this.promotionModel.updateOne({ _id: id }, { $set: fields });
    this.cache = null;
    return this.get(id);
  }

  async setActive(id: string, isActive: boolean): Promise<AdminPromotion> {
    await this.findRow(id);
    await this.promotionModel.updateOne({ _id: id }, { $set: { isActive } });
    this.cache = null;
    return this.get(id);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findRow(id);
    await this.promotionModel.deleteOne({ _id: id });
    this.cache = null;
    return { deleted: true };
  }

  private async checked(dto: SavePromotionDto) {
    const rule = {
      name: dto.name.trim(),
      percentOff: dto.percentOff,
      roundTo: dto.roundTo,
      scope: dto.scope,
      categoryIds: dto.scope === 'categories' ? dto.categoryIds : [],
      dishIds: dto.scope === 'dishes' ? dto.dishIds : [],
      excludedDishIds: dto.scope === 'dishes' ? [] : dto.excludedDishIds,
      startsAt: dto.startsAt ?? null,
      endsAt: dto.endsAt ?? null,
      windows: dto.windows.map((w) => ({
        days: w.days,
        from: w.from,
        to: w.to,
      })),
      timezone: dto.timezone,
    };

    const issues = promotionIssues(rule);
    if (!isValidTimeZone(rule.timezone))
      issues.timezone = 'Set the time zone in Settings → Opening hours';
    if (Object.keys(issues).length) throw formError(issues);

    const [categoryIds, dishIds, excludedDishIds] = await Promise.all([
      this.existing(this.categoryModel, rule.categoryIds),
      this.existing(this.itemModel, rule.dishIds),
      this.existing(this.itemModel, rule.excludedDishIds),
    ]);
    if (rule.scope === 'categories' && categoryIds.length === 0)
      throw formError({ categoryIds: 'Those categories no longer exist' });
    if (rule.scope === 'dishes' && dishIds.length === 0)
      throw formError({ dishIds: 'Those dishes no longer exist' });

    if (rule.endsAt && rule.endsAt <= localClock(rule.timezone).stamp)
      throw formError({ endsAt: 'This is already in the past' });

    return { ...rule, categoryIds, dishIds, excludedDishIds };
  }

  private async existing(
    model: Model<MenuItemDocument> | Model<MenuCategoryDocument>,
    ids: string[],
  ): Promise<Types.ObjectId[]> {
    if (ids.length === 0) return [];
    const found = await (
      model as Model<MenuItemDocument | MenuCategoryDocument>
    )
      .find({ _id: { $in: ids } }, { _id: 1 })
      .lean();
    const keep = new Set(found.map((f) => String(f._id)));
    return ids.filter((id) => keep.has(id)).map((id) => new Types.ObjectId(id));
  }

  private async findRow(id: string) {
    if (!isValidObjectId(id))
      throw new NotFoundException('This promotion no longer exists');
    const row = await this.promotionModel.findById(id).lean();
    if (!row) throw new NotFoundException('This promotion no longer exists');
    return row;
  }
}

type PromotionRow = Promotion & { _id: Types.ObjectId };

function toRule(row: PromotionRow): PromotionRule {
  return {
    id: String(row._id),
    name: row.name,
    percentOff: row.percentOff,
    roundTo: row.roundTo ?? 0,
    scope: row.scope,
    categoryIds: (row.categoryIds ?? []).map(String),
    dishIds: (row.dishIds ?? []).map(String),
    excludedDishIds: (row.excludedDishIds ?? []).map(String),
    startsAt: row.startsAt ?? null,
    endsAt: row.endsAt ?? null,
    windows: (row.windows ?? []).map((w) => ({
      days: w.days,
      from: w.from,
      to: w.to,
    })),
    timezone: row.timezone,
    isActive: row.isActive !== false,
  };
}

function toAdmin(
  row: PromotionRow,
  dishes: { id: string; categoryId: string }[],
  now: Date,
): AdminPromotion {
  const rule = toRule(row);
  return {
    ...rule,
    status: promotionState(rule, now),
    affectedCount: dishes.filter((d) => appliesTo(rule, d)).length,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
