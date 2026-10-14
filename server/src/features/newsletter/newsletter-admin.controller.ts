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
  Query,
} from '@nestjs/common';
import { Authorize } from 'decorators/permission.decorator';
import {
  CurrentUser,
  type CurrentActor,
} from 'decorators/current-user.decorator';
import {
  AddSubscriberDto,
  AutomationsDto,
  ExportSubscribersQuery,
  ListCampaignsQuery,
  ListSubscribersQuery,
  SaveCampaignDto,
  SendCampaignDto,
  TestCampaignDto,
} from './dto/newsletter-admin.dto';
import { NewsletterAdminService } from './newsletter-admin.service';

/**
 * The admin panel's newsletter: managers and the owner (content:manage).
 *   GET    /admin/newsletter/stats
 *   GET    /admin/newsletter/subscribers?q&status&source&page     POST …/subscribers { email, consent }
 *   GET    /admin/newsletter/subscribers/export?status
 *   POST   /admin/newsletter/subscribers/:id/resend | /unsubscribe     DELETE …/subscribers/:id
 *   GET    /admin/newsletter/campaigns?status&page                POST …/campaigns
 *   POST   /admin/newsletter/campaigns/preview                    (the editor's live preview)
 *   GET    /admin/newsletter/campaigns/:id    PATCH …/:id    DELETE …/:id
 *   POST   /admin/newsletter/campaigns/:id/test | /send | /duplicate | /unschedule | /pause | /resume | /cancel
 *   GET    /admin/newsletter/dishes                               (dishes to feature)
 *   GET    /admin/newsletter/automations    PATCH …/automations    GET …/automations/sale-preview
 */
@Controller('admin/newsletter')
@Authorize('content:manage')
export class NewsletterAdminController {
  constructor(private readonly admin: NewsletterAdminService) {}

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  /* subscribers */

  @Get('subscribers')
  subscribers(@Query() query: ListSubscribersQuery) {
    return this.admin.subscribers(query);
  }

  @Get('subscribers/export')
  export(@Query() query: ExportSubscribersQuery) {
    return this.admin.exportSubscribers(query.status);
  }

  @Post('subscribers')
  add(@Body() dto: AddSubscriberDto) {
    return this.admin.addSubscriber(dto);
  }

  @Post('subscribers/:id/resend')
  @HttpCode(HttpStatus.OK)
  resend(@Param('id') id: string) {
    return this.admin.resendConfirmation(id);
  }

  @Post('subscribers/:id/unsubscribe')
  @HttpCode(HttpStatus.OK)
  unsubscribe(@Param('id') id: string) {
    return this.admin.unsubscribe(id);
  }

  @Delete('subscribers/:id')
  remove(@Param('id') id: string) {
    return this.admin.deleteSubscriber(id);
  }

  /* campaigns */

  @Get('campaigns')
  campaigns(@Query() query: ListCampaignsQuery) {
    return this.admin.campaigns(query);
  }

  @Post('campaigns')
  create(@CurrentUser() me: CurrentActor, @Body() dto: SaveCampaignDto) {
    return this.admin.createCampaign(me, dto);
  }

  // Before :id, so "preview" isn't read as an id
  @Post('campaigns/preview')
  @HttpCode(HttpStatus.OK)
  preview(@Body() dto: SaveCampaignDto) {
    return this.admin.preview(dto);
  }

  @Get('campaigns/:id')
  campaign(@Param('id') id: string) {
    return this.admin.campaign(id);
  }

  @Patch('campaigns/:id')
  update(@Param('id') id: string, @Body() dto: SaveCampaignDto) {
    return this.admin.updateCampaign(id, dto);
  }

  @Delete('campaigns/:id')
  delete(@Param('id') id: string) {
    return this.admin.deleteCampaign(id);
  }

  @Post('campaigns/:id/test')
  @HttpCode(HttpStatus.OK)
  test(
    @CurrentUser() me: CurrentActor,
    @Param('id') id: string,
    @Body() dto: TestCampaignDto,
  ) {
    return this.admin.test(me, id, dto.email);
  }

  @Post('campaigns/:id/send')
  @HttpCode(HttpStatus.OK)
  send(
    @CurrentUser() me: CurrentActor,
    @Param('id') id: string,
    @Body() dto: SendCampaignDto,
  ) {
    return this.admin.send(me, id, dto);
  }

  @Post('campaigns/:id/duplicate')
  duplicate(@CurrentUser() me: CurrentActor, @Param('id') id: string) {
    return this.admin.duplicateCampaign(me, id);
  }

  @Post('campaigns/:id/:action')
  @HttpCode(HttpStatus.OK)
  state(@Param('id') id: string, @Param('action') action: string) {
    if (!['unschedule', 'pause', 'resume', 'cancel'].includes(action))
      return this.admin.campaign(id);
    return this.admin.setState(
      id,
      action as 'unschedule' | 'pause' | 'resume' | 'cancel',
    );
  }

  /* dishes & automations */

  @Get('dishes')
  dishes() {
    return this.admin.dishOptions();
  }

  @Get('automations')
  automations() {
    return this.admin.automations();
  }

  @Patch('automations')
  saveAutomations(@Body() dto: AutomationsDto) {
    return this.admin.saveAutomations(dto);
  }

  @Get('automations/sale-preview')
  salePreview() {
    return this.admin.salePreview();
  }
}
