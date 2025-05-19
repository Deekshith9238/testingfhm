-- Add email verification fields
ALTER TABLE users
ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN verification_token TEXT,
ADD COLUMN verification_token_expires TIMESTAMP; 