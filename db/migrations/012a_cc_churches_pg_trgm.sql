-- NOT APPLIED. Do not run this file against production from the app.
--
-- Name, church name, and city search on the directory list uses pg_trgm.
-- Run this before 012j, 012k, and 012l. It is not CREATE INDEX CONCURRENTLY.
-- If the extension is already installed, this does nothing.

create extension if not exists pg_trgm;
