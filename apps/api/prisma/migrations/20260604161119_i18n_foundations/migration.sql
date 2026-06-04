-- CreateEnum
CREATE TYPE "MeasurementSystem" AS ENUM ('IMPERIAL', 'METRIC');

-- DropIndex
DROP INDEX "jurisdictions_state_idx";

-- AlterTable
ALTER TABLE "jurisdictions" ADD COLUMN     "country_code" CHAR(2) NOT NULL DEFAULT 'US',
ADD COLUMN     "default_currency" CHAR(3) NOT NULL DEFAULT 'USD',
ADD COLUMN     "measurement_system" "MeasurementSystem" NOT NULL DEFAULT 'IMPERIAL',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Chicago';

-- AlterTable
ALTER TABLE "permits" ADD COLUMN     "valuation_currency" CHAR(3);

-- CreateIndex
CREATE INDEX "jurisdictions_country_code_state_idx" ON "jurisdictions"("country_code", "state");
