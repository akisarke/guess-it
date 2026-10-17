ALTER TABLE "EmailVerificationToken" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "EmailVerificationToken" FROM anon, authenticated;
