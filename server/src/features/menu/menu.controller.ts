import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  type PipeTransform,
} from '@nestjs/common';
import { SLUG_PATTERN } from 'lib/constants/menuConstants';
import { Authorize, RequirePermissions } from 'decorators/permission.decorator';
import { CreateMenuCategoryDto } from './dto/create-category.dto';
import {
  CreateMenuItemDto,
  UpdateMenuItemDto,
} from './dto/create-menu-item.dto';
import { DeleteMenuCategoriesDto } from './dto/delete-menu-categories.dto';
import { DeleteMenuItemsDto } from './dto/delete-menu-items.dto';
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

  /**
   * POST /api/v1/admin/menu/categories/delete  { ids: [...], deleteDishes?: true }
   *   → { deleted, dishesDeleted, photosDeleted }
   * 409 when a category still holds dishes and deleteDishes isn't true.
   */
  @Post('categories/delete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('menu:manage')
  deleteCategories(@Body() dto: DeleteMenuCategoriesDto) {
    return this.categories.deleteMany(dto.ids, dto.deleteDishes);
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

  /**
   * PATCH /api/v1/admin/menu/items/:id → the saved dish
   * Body: the whole dish (like creating) + image (new tmp key) / removeImage / version.
   * 404 gone · 409 slug taken or someone saved in between · 400 field errors
   */
  @Patch('items/:id')
  @RequirePermissions('menu:manage')
  updateItem(@Param('id') id: string, @Body() dto: UpdateMenuItemDto) {
    return this.menu.updateItem(id, dto);
  }

  /**
   * POST /api/v1/admin/menu/items/delete  { ids: [...] } → { deleted, photosDeleted }
   * One dish (the dish page) or many (the list's multi-select). Their S3 photos go too.
   * POST rather than DELETE: a DELETE with a body is dropped by some proxies.
   */
  @Post('items/delete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('menu:manage')
  deleteItems(@Body() dto: DeleteMenuItemsDto) {
    return this.menu.deleteItems(dto.ids);
  }

  /** GET /api/v1/admin/menu/summary: totals and categories (with item counts) for the page header and filters */
  @Get('summary')
  summary() {
    return this.menu.summary();
  }
}
