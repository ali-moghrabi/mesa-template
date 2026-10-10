import { BadRequestException, ConflictException } from '@nestjs/common';
import { Error as MongooseError } from 'mongoose';

export function formError(
  errors: Record<string, string>,
  message = 'Please fix the highlighted fields',
) {
  return new BadRequestException({ statusCode: 400, message, errors });
}

export function fieldConflict(field: string, message: string) {
  return new ConflictException({
    statusCode: 409,
    message,
    errors: { [field]: message },
  });
}

export function toFormError(error: unknown): unknown {
  if (!(error instanceof MongooseError.ValidationError)) return error;
  const errors: Record<string, string> = {};
  for (const [path, issue] of Object.entries(error.errors))
    errors[path] = issue.message;
  return formError(errors);
}

export const isDuplicateKey = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: number }).code === 11000;
