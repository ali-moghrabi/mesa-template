import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Authorize } from 'decorators/permission.decorator';
import { SavePromotionDto, SetPromotionActiveDto } from './dto/promotion.dto';
import { PromotionsService } from './promotions.service';

@Controller('admin/menu/promotions')
@Authorize('menu:manage')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  /** GET /api/v1/admin/menu/promotions → every promotion with its status and how many dishes it covers */
  @Get()
  list() {
    return this.promotions.list();
  }

  /** GET /api/v1/admin/menu/promotions/catalog → categories and dishes (light) for the form */
  @Get('catalog')
  catalog() {
    return this.promotions.catalog();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.promotions.get(id);
  }

  /** POST /api/v1/admin/menu/promotions → 201 · 400 { errors: { field: "…" } } */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: SavePromotionDto) {
    return this.promotions.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: SavePromotionDto) {
    return this.promotions.update(id, dto);
  }

  /** PATCH /api/v1/admin/menu/promotions/:id/active { isActive } — pause or resume */
  @Patch(':id/active')
  setActive(@Param('id') id: string, @Body() dto: SetPromotionActiveDto) {
    return this.promotions.setActive(id, dto.isActive);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.promotions.remove(id);
  }
}
