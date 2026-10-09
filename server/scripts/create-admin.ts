import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import type { Model } from 'mongoose';
import { AppModule } from 'src/app.module';
import { User, type UserDocument } from 'src/schemas/user.schema';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Usage: npm run create-admin -- owner@restaurant.com');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    const users = app.get<Model<UserDocument>>(getModelToken(User.name));
    const existing = await users.findOne({ email });

    if (existing) {
      await users.updateOne(
        { _id: existing._id },
        { $set: { role: 'admin', isActive: true }, $inc: { tokenVersion: 1 } },
      );
      console.log(`✔ ${email} is now an admin.`);
      return;
    }

    const password = randomBytes(12).toString('base64url');
    const username = `admin-${randomBytes(3).toString('hex')}`;
    await users.create({
      firstName: 'Restaurant',
      lastName: 'Admin',
      username,
      email,
      password: await bcrypt.hash(password, 12),
      role: 'admin',
    });

    console.log(`✔ Admin account created
    email:    ${email}
    username: ${username}
    password: ${password}

  Sign in and change the password and name right away. This password is not stored anywhere else.`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(
    '✖ Could not create the admin:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
