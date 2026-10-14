import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Types, type Model } from 'mongoose';
import { mediaUrl } from 'lib/media-url';
import { fromMinor } from 'lib/money';
import {
  Cart,
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  type CartDocument,
  type CartLine,
} from 'src/schemas/cart.schema';
import {
  MenuCategory,
  type MenuCategoryDocument,
} from 'src/schemas/category.schema';
import { MenuItem, type MenuItemDocument } from 'src/schemas/item.schema';
import {
  PromotionsService,
  type Pricing,
} from 'src/features/promotions/promotions.service';
import type { MenuItemRow } from 'src/features/menu/menu.mapper';
import type { AddCartLineDto } from './dto/cart.dto';

export type CartIssue = 'removed' | 'sold-out' | 'changed';

export type CartLineView = {
  id: string;
  dish: {
    id: string;
    slug: string;
    name: string;
    image?: string;
    imageBlur?: string;
    category?: string;
  };
  variant?: { id: string; name: string };
  options: { id: string; name: string; group: string }[];
  quantity: number;
  note: string;
  unitPrice: number;
  unitWas?: number;
  total: number;
  sale?: { name: string; percentOff: number };
  issue?: CartIssue;
  issueText?: string;
};

export type CartView = {
  lines: CartLineView[];
  count: number;
  subtotal: number;
  savings: number;
  ready: boolean;
  updatedAt: string | null;
};

const ISSUE_TEXT: Record<CartIssue, string> = {
  removed: 'No longer on the menu',
  'sold-out': 'Sold out right now',
  changed: 'Its choices changed: remove it and add it again',
};

type DishRow = MenuItemRow & { category?: MenuItemRow['category'] };

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
    @InjectModel(MenuItem.name)
    private readonly itemModel: Model<MenuItemDocument>,
    @InjectModel(MenuCategory.name)
    private readonly categoryModel: Model<MenuCategoryDocument>,
    private readonly promotions: PromotionsService,
  ) {}

  async view(userId: string): Promise<CartView> {
    const cart = await this.cartModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .lean<Cart & { updatedAt?: Date }>();
    if (!cart || cart.lines.length === 0)
      return {
        lines: [],
        count: 0,
        subtotal: 0,
        savings: 0,
        ready: false,
        updatedAt: cart?.updatedAt?.toISOString() ?? null,
      };

    const [dishes, pricing] = await Promise.all([
      this.dishes(cart.lines.map((l) => l.itemId)),
      this.promotions.pricing(),
    ]);
    const lines = [...cart.lines]
      .sort((a, b) => +new Date(a.addedAt) - +new Date(b.addedAt))
      .map((line) => priceLine(line, dishes.get(String(line.itemId)), pricing));

    const ok = lines.filter((l) => !l.issue);
    const minor = (n: number) => Math.round(n * 1e6);
    const subtotal = ok.reduce((sum, l) => sum + minor(l.total), 0) / 1e6;
    const savings =
      ok.reduce(
        (sum, l) =>
          sum +
          (l.unitWas !== undefined
            ? minor((l.unitWas - l.unitPrice) * l.quantity)
            : 0),
        0,
      ) / 1e6;
    return {
      lines,
      count: ok.reduce((sum, l) => sum + l.quantity, 0),
      subtotal,
      savings,
      ready: ok.length > 0 && ok.length === lines.length,
      updatedAt: cart.updatedAt?.toISOString() ?? null,
    };
  }

  async add(userId: string, dto: AddCartLineDto): Promise<CartView> {
    const owner = new Types.ObjectId(userId);
    const dish = (await this.dishes([new Types.ObjectId(dto.itemId)])).get(
      dto.itemId,
    );
    if (!dish || !dish.isActive || !dish.category?.isActive)
      throw new NotFoundException('This dish is no longer on the menu');
    if (!dish.isAvailable)
      throw new ConflictException(`${dish.name} is sold out right now`);

    const variantId = checkVariant(dish, dto.variantId);
    const optionIds = checkOptions(dish, dto.optionIds ?? []);
    const note = dto.note?.trim() ?? '';

    const cart = await this.cartModel
      .findOneAndUpdate(
        { userId: owner },
        { $setOnInsert: { lines: [] } },
        { upsert: true, returnDocument: 'after' },
      )
      .lean<Cart>();
    const key = lineKey(dto.itemId, variantId, optionIds, note);
    const same = cart.lines.find(
      (l) =>
        lineKey(
          String(l.itemId),
          l.variantId ? String(l.variantId) : undefined,
          l.optionIds.map(String),
          l.note,
        ) === key,
    );

    if (same) {
      const quantity = Math.min(
        MAX_LINE_QUANTITY,
        same.quantity + dto.quantity,
      );
      await this.cartModel.updateOne(
        { userId: owner, 'lines._id': same._id },
        { $set: { 'lines.$.quantity': quantity } },
      );
    } else {
      const line = {
        _id: new Types.ObjectId(),
        itemId: dish._id,
        variantId: variantId ? new Types.ObjectId(variantId) : undefined,
        optionIds: optionIds.map((id) => new Types.ObjectId(id)),
        quantity: dto.quantity,
        note,
        name: dish.name,
        addedAt: new Date(),
      };

      const pushed = await this.cartModel.updateOne(
        { userId: owner, [`lines.${MAX_CART_LINES - 1}`]: { $exists: false } },
        { $push: { lines: line } },
      );
      if (pushed.matchedCount === 0)
        throw new ConflictException(
          `Your cart holds up to ${MAX_CART_LINES} different dishes. Check out, or remove one first.`,
        );
    }
    return this.view(userId);
  }

  async setQuantity(
    userId: string,
    lineId: string,
    quantity: number,
  ): Promise<CartView> {
    if (quantity === 0) return this.remove(userId, lineId);
    const result = await this.cartModel.updateOne(
      { userId: new Types.ObjectId(userId), 'lines._id': toId(lineId) },
      { $set: { 'lines.$.quantity': Math.min(MAX_LINE_QUANTITY, quantity) } },
    );
    if (result.matchedCount === 0)
      throw new NotFoundException('This dish is no longer in your cart');
    return this.view(userId);
  }

  async remove(userId: string, lineId: string): Promise<CartView> {
    await this.cartModel.updateOne(
      { userId: new Types.ObjectId(userId) },
      { $pull: { lines: { _id: toId(lineId) } } },
    );
    return this.view(userId);
  }

  async clear(userId: string): Promise<CartView> {
    await this.cartModel.updateOne(
      { userId: new Types.ObjectId(userId) },
      { $set: { lines: [] } },
    );
    return this.view(userId);
  }

  private async dishes(ids: Types.ObjectId[]): Promise<Map<string, DishRow>> {
    const rows = await this.itemModel.aggregate<DishRow>([
      { $match: { _id: { $in: ids } } },
      {
        $lookup: {
          from: this.categoryModel.collection.name,
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
          pipeline: [
            { $project: { name: 1, slug: 1, sortOrder: 1, isActive: 1 } },
          ],
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    ]);
    return new Map(rows.map((r) => [String(r._id), r]));
  }
}

const toId = (id: string) => {
  if (!isValidObjectId(id))
    throw new NotFoundException('This dish is no longer in your cart');
  return new Types.ObjectId(id);
};

const lineKey = (
  itemId: string,
  variantId: string | undefined,
  optionIds: string[],
  note: string,
) =>
  [
    itemId,
    variantId ?? '-',
    [...optionIds].sort().join(','),
    note.trim().toLowerCase(),
  ].join('|');

function checkVariant(
  dish: DishRow,
  variantId: string | undefined,
): string | undefined {
  const variants = dish.variants ?? [];
  if (variants.length === 0) {
    if (variantId) throw new BadRequestException(`${dish.name} has no sizes`);
    return undefined;
  }
  const variant = variants.find((v) => String(v._id) === variantId);
  if (!variant) throw new BadRequestException(`Choose a size for ${dish.name}`);
  if (variant.isAvailable === false)
    throw new ConflictException(`${variant.name} is sold out right now`);
  return String(variant._id);
}

function checkOptions(dish: DishRow, optionIds: string[]): string[] {
  const unique = [...new Set(optionIds)];
  const groups = dish.modifierGroups ?? [];
  const known = new Set(
    groups.flatMap((g) => g.options.map((o) => String(o._id))),
  );
  if (unique.some((id) => !known.has(id)))
    throw new BadRequestException(
      `Some choices for ${dish.name} changed. Open the dish again.`,
    );

  for (const group of groups) {
    const picked = group.options.filter((o) => unique.includes(String(o._id)));
    const gone = picked.find((o) => o.isAvailable === false);
    if (gone) throw new ConflictException(`${gone.name} is sold out right now`);
    if (picked.length < group.minSelect)
      throw new BadRequestException(
        `Choose ${group.name.toLowerCase()} for ${dish.name}`,
      );
    if (picked.length > group.maxSelect)
      throw new BadRequestException(
        `Pick up to ${group.maxSelect} for ${group.name.toLowerCase()}`,
      );
  }
  return unique.sort();
}

function priceLine(
  line: CartLine,
  dish: DishRow | undefined,
  pricing: Pricing,
): CartLineView {
  const base: CartLineView = {
    id: String(line._id),
    dish: {
      id: String(line.itemId),
      slug: '',
      name: dish?.name ?? line.name ?? 'A dish',
    },
    options: [],
    quantity: line.quantity,
    note: line.note ?? '',
    unitPrice: 0,
    total: 0,
  };
  if (!dish || !dish.isActive || !dish.category?.isActive)
    return { ...base, issue: 'removed', issueText: ISSUE_TEXT.removed };

  base.dish = {
    id: String(dish._id),
    slug: dish.slug,
    name: dish.name,
    image: mediaUrl(dish.image),
    imageBlur: dish.imageBlur,
    category: dish.category.name,
  };

  let issue: CartIssue | undefined = dish.isAvailable ? undefined : 'sold-out';
  const variant = line.variantId
    ? (dish.variants ?? []).find(
        (v) => String(v._id) === String(line.variantId),
      )
    : undefined;
  if (
    (dish.variants ?? []).length > 0 &&
    (!variant || variant.isAvailable === false)
  )
    issue ??= 'changed';
  if ((dish.variants ?? []).length === 0 && line.variantId) issue ??= 'changed';

  const wanted = new Set(line.optionIds.map(String));
  const options: CartLineView['options'] = [];
  let extrasMinor = 0;
  for (const group of dish.modifierGroups ?? []) {
    const picked = group.options.filter((o) => wanted.has(String(o._id)));
    if (
      picked.length < group.minSelect ||
      picked.length > group.maxSelect ||
      picked.some((o) => o.isAvailable === false)
    )
      issue ??= 'changed';
    for (const o of picked) {
      options.push({ id: String(o._id), name: o.name, group: group.name });
      extrasMinor += o.priceDelta ?? 0;
      wanted.delete(String(o._id));
    }
  }
  if (wanted.size > 0) issue ??= 'changed';

  const sale = pricing.saleFor({
    id: String(dish._id),
    categoryId: String(dish.categoryId),
  });
  const listMinor = variant ? variant.price : dish.price;
  const nowMinor = (sale ? sale.price(listMinor) : listMinor) + extrasMinor;
  const wasMinor = sale ? listMinor + extrasMinor : undefined;

  return {
    ...base,
    variant: variant
      ? { id: String(variant._id), name: variant.name }
      : undefined,
    options,
    unitPrice: fromMinor(nowMinor) ?? 0,
    unitWas:
      wasMinor !== undefined && wasMinor > nowMinor
        ? fromMinor(wasMinor)
        : undefined,
    total: issue ? 0 : (fromMinor(nowMinor * line.quantity) ?? 0),
    sale: sale
      ? { name: sale.info.name, percentOff: sale.info.percentOff }
      : undefined,
    ...(issue && { issue, issueText: ISSUE_TEXT[issue] }),
  };
}
