-- Six roles were removed from the app: LVH Captain, Membership Committee (GARAM),
-- and the Education Slot, Feature Presentation, Events & BBB and Training
-- coordinators. LVH Captains move to LVH Team (a subset of what they had), so
-- the LVH desk keeps working; the other roles' assignments are removed.
-- Each change is written to the audit log.
INSERT INTO "audit_log" ("id", "action", "entity", "entity_id", "before", "after", "reason")
SELECT gen_random_uuid()::text, 'role.migrate', 'role_assignment', "id",
       jsonb_build_object('role', "role", 'memberId', "member_id", 'termId', "term_id"),
       CASE WHEN "role" = 'lvh_captain' THEN jsonb_build_object('role', 'lvh') ELSE NULL END,
       'Role removed from the app'
FROM "role_assignment"
WHERE "role" IN ('lvh_captain', 'membership_committee', 'education_coordinator', 'feature_presentation_coordinator', 'events_coordinator', 'training_coordinator');--> statement-breakpoint
INSERT INTO "role_assignment" ("id", "term_id", "member_id", "role")
SELECT gen_random_uuid()::text, "term_id", "member_id", 'lvh'
FROM "role_assignment"
WHERE "role" = 'lvh_captain'
ON CONFLICT ("term_id", "member_id", "role") DO NOTHING;--> statement-breakpoint
DELETE FROM "role_assignment"
WHERE "role" IN ('lvh_captain', 'membership_committee', 'education_coordinator', 'feature_presentation_coordinator', 'events_coordinator', 'training_coordinator');
