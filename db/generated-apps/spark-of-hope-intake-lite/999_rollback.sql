-- Destructive rollback for Spark of Hope Intake Lite review schema.
-- Use only in a disposable preview/local database after approval. Production
-- rollback remains blocked until a release gate records owner approval,
-- backup/restore expectations, and data preservation rules.

drop table if exists soh_lite_deletion_requests cascade;
drop table if exists soh_lite_export_requests cascade;
drop table if exists soh_lite_audit_events cascade;
drop table if exists soh_lite_status_events cascade;
drop table if exists soh_lite_response_assignments cascade;
drop table if exists soh_lite_encouragement_responses cascade;
drop table if exists soh_lite_story_reviews cascade;
drop table if exists soh_lite_review_assignments cascade;
drop table if exists soh_lite_story_consents cascade;
drop table if exists soh_lite_story_contacts cascade;
drop table if exists soh_lite_story_submissions cascade;
drop table if exists soh_lite_membership_roles cascade;
drop table if exists soh_lite_role_permissions cascade;
drop table if exists soh_lite_permissions cascade;
drop table if exists soh_lite_roles cascade;
drop table if exists soh_lite_memberships cascade;
drop table if exists soh_lite_users cascade;
drop table if exists soh_lite_organizations cascade;
