import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { CurrentActor } from 'decorators/current-user.decorator';
import { formError, isDuplicateKey } from 'lib/form-errors';
import {
  DAYS,
  hoursIssues,
  sortShifts,
  type OpeningHours,
} from 'lib/opening-hours';
import {
  Settings,
  SETTINGS_ID,
  type SettingsDocument,
} from 'src/schemas/settings.schema';
import type { OpeningHoursDto } from './dto/opening-hours.dto';

export type AdminOpeningHours = {
  hours: OpeningHours | null;
  version: string | null;
  updatedAt: Date | null;
  updatedBy: { id: string; name: string } | null;
};

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Settings.name)
    private readonly settingsModel: Model<SettingsDocument>,
  ) {}

  async publicOpeningHours(): Promise<{ hours: OpeningHours | null }> {
    const row = await this.settingsModel
      .findById(SETTINGS_ID, { openingHours: 1 })
      .lean();
    return { hours: row?.openingHours ?? null };
  }

  async adminOpeningHours(): Promise<AdminOpeningHours> {
    const row = await this.settingsModel
      .findById(SETTINGS_ID, {
        openingHours: 1,
        openingHoursUpdatedAt: 1,
        openingHoursUpdatedBy: 1,
      })
      .lean();
    return {
      hours: row?.openingHours ?? null,
      version: row?.openingHoursUpdatedAt?.toISOString() ?? null,
      updatedAt: row?.openingHoursUpdatedAt ?? null,
      updatedBy: row?.openingHoursUpdatedBy ?? null,
    };
  }

  async saveOpeningHours(
    dto: OpeningHoursDto,
    version: string | null | undefined,
    actor: CurrentActor,
  ): Promise<AdminOpeningHours> {
    const hours = normalize(dto);
    const issues = hoursIssues(hours);
    if (Object.keys(issues).length) throw formError(issues);

    const unchanged = version
      ? { openingHoursUpdatedAt: new Date(version) }
      : { openingHoursUpdatedAt: { $exists: false } };
    const now = new Date();
    try {
      const row = await this.settingsModel
        .findOneAndUpdate(
          { _id: SETTINGS_ID, ...unchanged },
          {
            $set: {
              openingHours: hours,
              openingHoursUpdatedAt: now,
              openingHoursUpdatedBy: { id: actor.id, name: actor.name },
            },
          },
          {
            new: true,
            upsert: true,
            projection: {
              openingHours: 1,
              openingHoursUpdatedAt: 1,
              openingHoursUpdatedBy: 1,
            },
          },
        )
        .lean();
      return {
        hours: row?.openingHours ?? hours,
        version: now.toISOString(),
        updatedAt: now,
        updatedBy: row?.openingHoursUpdatedBy ?? null,
      };
    } catch (error) {
      if (isDuplicateKey(error)) throw changedMeanwhile();
      throw error;
    }
  }
}

function normalize(dto: OpeningHoursDto): OpeningHours {
  return {
    timezone: dto.timezone,
    weekly: DAYS.map((day, i) => {
      const found =
        dto.weekly[i]?.day === day
          ? dto.weekly[i]
          : dto.weekly.find((w) => w.day === day);
      return {
        day,
        shifts: sortShifts(
          (found?.shifts ?? []).map(({ open, close }) => ({ open, close })),
        ),
      };
    }),
    exceptions: dto.exceptions
      .map((e) => ({
        date: e.date,
        label: e.label.trim(),
        shifts: sortShifts(
          e.shifts.map(({ open, close }) => ({ open, close })),
        ),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

const changedMeanwhile = () =>
  new ConflictException(
    'Someone else changed the opening hours while you were editing. Reload to see their version.',
  );
