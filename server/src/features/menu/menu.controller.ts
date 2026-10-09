import { Controller, Get, Query } from '@nestjs/common';
import {
  AdminListMenuItemsQuery,
  ListMenuItemsQuery,
} from './dto/list-menu-items.query';
import { MenuService } from './menu.service';
import { Authorize } from 'decorators/permission.decorator';

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
  constructor(private readonly menu: MenuService) {}

  /** GET /api/v1/admin/menu/items?page=1&limit=10&search=lamb&visibility=hidden */
  @Get('items')
  listItems(@Query() query: AdminListMenuItemsQuery) {
    return this.menu.listAdminItems(query);
  }

  /** GET /api/v1/admin/menu/summary: totals and categories (with item counts) for the page header and filters */
  @Get('summary')
  summary() {
    return this.menu.summary();
  }
}
