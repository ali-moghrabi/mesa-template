import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model, type Types } from 'mongoose';
import { mediaUrl } from 'lib/media-url';
import { MAX_GALLERY_PHOTOS, type GalleryAlbum } from 'lib/gallery';
import { MediaService } from 'src/features/media/media.service';
import {
  GalleryPhoto,
  type GalleryPhotoDocument,
} from 'src/schemas/gallery-photo.schema';
import type {
  AddGalleryPhotosDto,
  BulkChangesDto,
  UpdateGalleryPhotoDto,
} from './dto/gallery.dto';

export type AdminGalleryPhoto = {
  id: string;
  url: string;
  imageBlur?: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  album: GalleryAlbum;
  isVisible: boolean;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: Date;
};

export type PublicGalleryPhoto = Omit<
  AdminGalleryPhoto,
  'isVisible' | 'sortOrder' | 'createdAt'
>;

type Row = GalleryPhoto & { _id: Types.ObjectId };

const toAdmin = (row: Row): AdminGalleryPhoto => ({
  id: String(row._id),
  url: mediaUrl(row.image) ?? '',
  imageBlur: row.imageBlur,
  width: row.width,
  height: row.height,
  alt: row.alt ?? '',
  caption: row.caption ?? '',
  album: row.album,
  isVisible: row.isVisible !== false,
  isFeatured: row.isFeatured === true,
  sortOrder: row.sortOrder,
  createdAt: row.createdAt,
});

@Injectable()
export class GalleryService {
  private readonly logger = new Logger(GalleryService.name);

  constructor(
    @InjectModel(GalleryPhoto.name)
    private readonly photoModel: Model<GalleryPhotoDocument>,
    private readonly media: MediaService,
  ) {}

  async list(): Promise<AdminGalleryPhoto[]> {
    const rows = await this.photoModel
      .find()
      .sort({ sortOrder: 1, _id: 1 })
      .lean<Row[]>();
    return rows.map(toAdmin);
  }

  async publicList(): Promise<PublicGalleryPhoto[]> {
    const rows = await this.photoModel
      .find({ isVisible: true })
      .sort({ sortOrder: 1, _id: 1 })
      .lean<Row[]>();
    return rows.map((row) => {
      const p = toAdmin(row);
      return {
        id: p.id,
        url: p.url,
        imageBlur: p.imageBlur,
        width: p.width,
        height: p.height,
        alt: p.alt,
        caption: p.caption,
        album: p.album,
        isFeatured: p.isFeatured,
      };
    });
  }

  async add(
    dto: AddGalleryPhotosDto,
  ): Promise<{ added: AdminGalleryPhoto[]; failed: number }> {
    const existing = await this.photoModel.countDocuments();
    if (existing + dto.photos.length > MAX_GALLERY_PHOTOS) {
      throw new BadRequestException(
        `A gallery holds up to ${MAX_GALLERY_PHOTOS} photos. Delete a few old ones first.`,
      );
    }

    const kept: {
      photo: (typeof dto.photos)[number];
      key: string;
      blur?: string;
    }[] = [];
    for (const photo of dto.photos) {
      try {
        const stored = await this.media.keepMenuImage(photo.image);
        kept.push({ photo, key: stored.key, blur: stored.blurDataURL });
      } catch (error) {
        this.logger.warn(
          `Gallery photo ${photo.image} skipped: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (kept.length === 0)
      throw new BadRequestException(
        'The upload expired. Add the photos again.',
      );

    await this.photoModel.updateMany({}, { $inc: { sortOrder: kept.length } });
    const created = await this.photoModel.insertMany(
      kept.map(({ photo, key, blur }, i) => ({
        image: key,
        imageBlur: blur,
        width: photo.width,
        height: photo.height,
        alt: photo.alt ?? '',
        album: photo.album ?? 'general',
        sortOrder: i,
      })),
    );

    void Promise.all(
      kept.map(({ photo }) => this.media.deleteQuietly(photo.image)),
    );

    return {
      added: created.map((doc) => toAdmin(doc.toObject() as Row)),
      failed: dto.photos.length - kept.length,
    };
  }

  async update(
    id: string,
    dto: UpdateGalleryPhotoDto,
  ): Promise<AdminGalleryPhoto> {
    if (!isValidObjectId(id))
      throw new NotFoundException('This photo no longer exists');
    const row = await this.photoModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true })
      .lean<Row>();
    if (!row) throw new NotFoundException('This photo no longer exists');
    return toAdmin(row);
  }

  async bulkUpdate(
    ids: string[],
    set: BulkChangesDto,
  ): Promise<{ updated: number }> {
    const changes = Object.fromEntries(
      Object.entries(set).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(changes).length === 0)
      throw new BadRequestException('Nothing to change');
    const { modifiedCount } = await this.photoModel.updateMany(
      { _id: { $in: ids } },
      { $set: changes },
      { runValidators: true },
    );
    return { updated: modifiedCount };
  }

  async reorder(ids: string[]): Promise<{ ok: true }> {
    const total = await this.photoModel.countDocuments();
    const found = await this.photoModel.countDocuments({ _id: { $in: ids } });
    if (found !== ids.length || total !== ids.length) {
      throw new ConflictException(
        'The gallery changed while you were sorting it. Reload and try again.',
      );
    }
    await this.photoModel.bulkWrite(
      ids.map((id, i) => ({
        updateOne: { filter: { _id: id }, update: { $set: { sortOrder: i } } },
      })),
    );
    return { ok: true };
  }

  async remove(
    ids: string[],
  ): Promise<{ deleted: number; filesDeleted: number }> {
    const rows = await this.photoModel
      .find({ _id: { $in: ids } }, { image: 1 })
      .lean<Row[]>();
    if (rows.length === 0)
      throw new NotFoundException('These photos no longer exist');
    const { deletedCount } = await this.photoModel.deleteMany({
      _id: { $in: rows.map((r) => r._id) },
    });
    const filesDeleted = await this.media.deleteManyQuietly(
      rows.map((r) => r.image),
    );
    return { deleted: deletedCount, filesDeleted };
  }
}
