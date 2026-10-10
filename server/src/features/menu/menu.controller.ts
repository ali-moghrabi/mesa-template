import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  type PipeTransform,
} from '@nestjs/common';
import { SLUG_PATTERN } from 'lib/constants/menuConstants';
import { Authorize, RequirePermissions } from 'decorators/permission.decorator';
import { CreateMenuCategoryDto } from './dto/create-category.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import {
  AdminListMenuItemsQuery,
  ListMenuItemsQuery,
} from './dto/list-menu-items.query';
import { MenuCategoriesService } from './categories.service';
import { MenuService } from './menu.service';
class SlugPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const slug = String(value ?? '').toLowerCase();
    if (slug.length > 100 || !SLUG_PATTERN.test(slug))
      throw new BadRequestException('Invalid URL id');
    return slug;
  }
}

/** Public: the website's menu. No sign-in needed. */
@Controller('menu')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  /** GET /api/v1/menu/items?page=1&limit=10 */
  @Get('items')
  listItems(@Query() query: ListMenuItemsQuery) {
    return this.menu.listPublicItems(query);
  }
}

/**
 * Admin panel: hidden dishes included. Every team role can read it
 * (staff need it to mark dishes sold out; editing will require menu:manage).
 */
@Controller('admin/menu')
@Authorize('menu:availability')
export class AdminMenuController {
  constructor(
    private readonly menu: MenuService,
    private readonly categories: MenuCategoriesService,
  ) {}

  /** GET /api/v1/admin/menu/categories → every category in menu order, with dish counts */
  @Get('categories')
  listCategories() {
    return this.categories.list();
  }

  /**
   * POST /api/v1/admin/menu/categories → 201 with the new category
   * 400 { message, errors: { field: "what to fix" } } · 409 when the slug is taken
   */
  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('menu:manage')
  createCategory(@Body() dto: CreateMenuCategoryDto) {
    return this.categories.create(dto);
  }

  /** GET /api/v1/admin/menu/items?page=1&limit=10&search=lamb&visibility=hidden */
  @Get('items')
  listItems(@Query() query: AdminListMenuItemsQuery) {
    return this.menu.listAdminItems(query);
  }

  /**
   * POST /api/v1/admin/menu/items → 201 with the new dish (same shape as the list)
   * Validation problems come back as 400 { message, errors: { field: "what to fix" } }, a taken slug as 409.
   */
  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('menu:manage')
  createItem(@Body() dto: CreateMenuItemDto) {
    return this.menu.createItem(dto);
  }

  /**
   * GET /api/v1/admin/menu/items/:slug → one dish with everything, plus its neighbours in the category.
   * 404 when it doesn't exist.
   */
  @Get('items/:slug')
  getItem(@Param('slug', SlugPipe) slug: string) {
    return this.menu.getAdminItem(slug);
  }

  /** GET /api/v1/admin/menu/summary: totals and categories (with item counts) for the page header and filters */
  @Get('summary')
  summary() {
    return this.menu.summary();
  }
}
