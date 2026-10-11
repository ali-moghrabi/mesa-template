import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { GALLERY_ALBUMS, type GalleryAlbum } from 'lib/gallery';

export type GalleryPhotoDocument = HydratedDocument<GalleryPhoto>;

@Schema({ collection: 'gallery_photos', timestamps: true })
export class GalleryPhoto {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true })
  image!: string;

  @Prop({ type: String })
  imageBlur?: string;

  @Prop({ type: Number, required: true })
  width!: number;

  @Prop({ type: Number, required: true })
  height!: number;

  @Prop({ type: String, default: '', trim: true, maxlength: 160 })
  alt!: string;

  @Prop({ type: String, default: '', trim: true, maxlength: 200 })
  caption!: string;

  @Prop({ type: String, enum: GALLERY_ALBUMS, default: 'general', index: true })
  album!: GalleryAlbum;

  @Prop({ type: Boolean, default: true })
  isVisible!: boolean;

  @Prop({ type: Boolean, default: false })
  isFeatured!: boolean;

  @Prop({ type: Number, default: 0 })
  sortOrder!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const GalleryPhotoSchema = SchemaFactory.createForClass(GalleryPhoto);
GalleryPhotoSchema.index({ sortOrder: 1, _id: 1 });
