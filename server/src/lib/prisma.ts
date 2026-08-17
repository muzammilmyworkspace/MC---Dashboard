import { PrismaClient } from "@prisma/client";
import { isProd } from "../env.js";

export const prisma = new PrismaClient({
  log: isProd ? ["error"] : ["warn", "error"],
});

export async function connectDb() {
  await prisma.$connect();
}

export async function disconnectDb() {
  await prisma.$disconnect();
}
