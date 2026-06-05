-- Add SOCRATA to JurisdictionVendor enum (generic, config-driven Socrata adapter).
ALTER TYPE "JurisdictionVendor" ADD VALUE IF NOT EXISTS 'SOCRATA';
