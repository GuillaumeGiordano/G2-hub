-- Console accounts created before the e-mailed invitations (DECISIONS.md §30) are in use: they
-- are not « invited ». From now on `emailVerified` turns true when an e-mailed link is used.
UPDATE "user" SET "emailVerified" = true WHERE "emailVerified" = false;
