import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";

export type IntakePayload = {
  preferredName?: unknown;
  email?: unknown;
  storyTitle?: unknown;
  categoryOrStruggle?: unknown;
  hopeOutcome?: unknown;
  storyBody?: unknown;
  mayReview?: unknown;
  mayContact?: unknown;
  mayPrepareEncouragement?: unknown;
};

export type StoryIntakeMode = "preview_mock" | "preview_controlled_persistence";

type ValidatedStoryIntake = {
  preferredName: string;
  email: string;
  storyTitle: string;
  categoryOrStruggle: string;
  hopeOutcome: string;
  storyBody: string;
  mayReview: boolean;
  mayContact: boolean;
  mayPrepareEncouragement: boolean;
};

type StoryIntakeOptions = {
  env?: NodeJS.ProcessEnv;
  now?: Date;
  reference?: string;
  sql?: ReturnType<typeof neon>;
};

type StoryIntakeResponseBody = {
  ok: boolean;
  mode: StoryIntakeMode;
  stored: boolean;
  reference?: string;
  reviewStatus?: string;
  received?: {
    preferredName: string | null;
    storyTitle: string | null;
    categoryOrStruggle: string | null;
    hopeOutcome: string | null;
    mayContact: boolean;
  };
  code?: string;
  message: string;
};

type StoryIntakeResult = {
  status: number;
  body: StoryIntakeResponseBody;
};

const maxStoryLength = 5000;

export async function submitStoryIntake(payload: IntakePayload, options: StoryIntakeOptions = {}): Promise<StoryIntakeResult> {
  const env = options.env || process.env;
  const mode = getStoryIntakeMode(env);
  const validated = validateStoryIntakePayload(payload, mode);

  if (!validated.ok) {
    return {
      status: 400,
      body: validated.body
    };
  }

  const reference = options.reference || createPreviewReference();

  if (mode === "preview_mock") {
    return {
      status: 200,
      body: buildSuccessBody({
        mode,
        stored: false,
        reference,
        reviewStatus: "not_started",
        intake: validated.intake,
        message:
          "Preview submission received. Nothing was written to Neon, no email was sent, and no production workflow was touched."
      })
    };
  }

  const configCheck = controlledPersistenceConfig(env);

  if (!configCheck.ok) {
    return {
      status: 503,
      body: {
        ok: false,
        mode,
        stored: false,
        code: configCheck.code,
        message: configCheck.message
      }
    };
  }

  try {
    const persisted = await persistControlledPreviewSubmission({
      intake: validated.intake,
      reference,
      privacyCopyVersion: configCheck.privacyCopyVersion,
      databaseUrl: configCheck.databaseUrl,
      sql: options.sql,
      now: options.now || new Date()
    });

    return {
      status: 200,
      body: buildSuccessBody({
        mode,
        stored: true,
        reference: persisted.reference,
        reviewStatus: persisted.reviewStatus,
        intake: validated.intake,
        message:
          "Controlled preview submission stored for private review. Production remains blocked and no public story was created."
      })
    };
  } catch {
    return {
      status: 503,
      body: {
        ok: false,
        mode,
        stored: false,
        code: "preview_persistence_failed",
        message:
          "Controlled preview persistence is temporarily unavailable. No story was stored and no production workflow was touched."
      }
    };
  }
}

export function getStoryIntakeCapability(env: NodeJS.ProcessEnv = process.env) {
  const mode = getStoryIntakeMode(env);
  const config = controlledPersistenceConfig(env);

  return {
    ok: true,
    mode,
    stored: false,
    accepts: ["POST"],
    production: "blocked",
    storage:
      mode === "preview_mock"
        ? "disabled"
        : config.ok
          ? "preview_controlled_persistence_available"
          : "preview_controlled_persistence_blocked",
    reviewStatus: mode === "preview_mock" ? "not_started" : "new",
    guardrails: {
      mockModeDefault: true,
      productionDeployBlocked: true,
      paidResourcesBlocked: true,
      migrationsReviewGated: true,
      secretsNotReturned: true,
      privateStoryDataNotReturned: true
    }
  };
}

function validateStoryIntakePayload(payload: IntakePayload, mode: StoryIntakeMode) {
  const storyBody = cleanText(payload.storyBody);
  const preferredName = cleanText(payload.preferredName);
  const email = cleanText(payload.email);
  const storyTitle = cleanText(payload.storyTitle);
  const categoryOrStruggle = cleanText(payload.categoryOrStruggle);
  const hopeOutcome = cleanText(payload.hopeOutcome);
  const mayReview = payload.mayReview === true;
  const mayContact = payload.mayContact === true;
  const mayPrepareEncouragement = payload.mayPrepareEncouragement === true;

  if (storyBody.length < 40) {
    return failure("Share a little more of the story so the team has enough context.", 400, mode);
  }

  if (storyBody.length > maxStoryLength) {
    return failure(`Please keep the story under ${maxStoryLength} characters for this preview.`, 400, mode);
  }

  if (!mayReview || !mayPrepareEncouragement) {
    return failure("Please confirm the review and encouragement consent choices before submitting.", 400, mode);
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return failure("Enter a valid email address or leave it blank.", 400, mode);
  }

  return {
    ok: true as const,
    intake: {
      preferredName,
      email,
      storyTitle,
      categoryOrStruggle,
      hopeOutcome,
      storyBody,
      mayReview,
      mayContact,
      mayPrepareEncouragement
    }
  };
}

async function persistControlledPreviewSubmission({
  intake,
  reference,
  privacyCopyVersion,
  databaseUrl,
  sql: injectedSql,
  now
}: {
  intake: ValidatedStoryIntake;
  reference: string;
  privacyCopyVersion: string;
  databaseUrl: string;
  sql?: ReturnType<typeof neon>;
  now: Date;
}) {
  const sql = injectedSql || neon(databaseUrl);
  const hasContact = Boolean(intake.preferredName || intake.email);
  const safeMetadata = buildSafeAuditMetadata({
    reference,
    hasContact,
    mayContact: intake.mayContact,
    mayPrepareEncouragement: intake.mayPrepareEncouragement,
    privacyCopyVersion
  });

  const rows = await sql`
    with inserted_submission as (
      insert into soh_lite_story_submissions (
        public_reference,
        title,
        story_body,
        source,
        review_status,
        privacy_status,
        submitted_at,
        created_at,
        updated_at
      )
      values (
        ${reference},
        ${intake.storyTitle || null},
        ${intake.storyBody},
        'public_form',
        'new',
        'private',
        ${now.toISOString()},
        ${now.toISOString()},
        ${now.toISOString()}
      )
      returning id, public_reference, review_status, privacy_status
    ),
    inserted_contact as (
      insert into soh_lite_story_contacts (
        story_submission_id,
        preferred_name,
        email,
        preferred_contact_method,
        safe_to_contact,
        created_at,
        updated_at
      )
      select
        id,
        ${intake.preferredName || null},
        ${intake.email || null},
        ${intake.email && intake.mayContact ? "email" : "none"},
        ${intake.mayContact},
        ${now.toISOString()},
        ${now.toISOString()}
      from inserted_submission
      where ${hasContact}
      returning id
    ),
    inserted_consent as (
      insert into soh_lite_story_consents (
        story_submission_id,
        privacy_copy_version,
        may_review,
        may_contact,
        may_prepare_encouragement,
        may_share_beyond_pilot,
        consented_at
      )
      select
        id,
        ${privacyCopyVersion},
        ${intake.mayReview},
        ${intake.mayContact},
        ${intake.mayPrepareEncouragement},
        false,
        ${now.toISOString()}
      from inserted_submission
      returning id
    ),
    inserted_status_event as (
      insert into soh_lite_status_events (
        entity_type,
        entity_id,
        from_status,
        to_status,
        reason_code,
        safe_summary,
        created_at
      )
      select
        'story_submission',
        id,
        null,
        'new',
        'public_preview_submission',
        'Story submitted through controlled preview intake.',
        ${now.toISOString()}
      from inserted_submission
      returning id
    ),
    inserted_audit_event as (
      insert into soh_lite_audit_events (
        action,
        target_type,
        target_id,
        risk_level,
        safe_metadata,
        created_at
      )
      select
        'story.preview_submit',
        'story_submission',
        id,
        'low',
        cast(${JSON.stringify(safeMetadata)} as jsonb),
        ${now.toISOString()}
      from inserted_submission
      returning id
    )
    select
      public_reference as "reference",
      review_status as "reviewStatus",
      privacy_status as "privacyStatus"
    from inserted_submission
  `;

  const resultRows = rows as Array<{ reference?: unknown; reviewStatus?: unknown; privacyStatus?: unknown }>;
  const row = resultRows[0];

  if (!row?.reference) {
    throw new Error("Controlled preview persistence did not return a story reference.");
  }

  return {
    reference: String(row.reference),
    reviewStatus: String(row.reviewStatus || "new"),
    privacyStatus: String(row.privacyStatus || "private")
  };
}

function buildSafeAuditMetadata({
  reference,
  hasContact,
  mayContact,
  mayPrepareEncouragement,
  privacyCopyVersion
}: {
  reference: string;
  hasContact: boolean;
  mayContact: boolean;
  mayPrepareEncouragement: boolean;
  privacyCopyVersion: string;
}) {
  return {
    mode: "preview_controlled_persistence",
    publicReference: reference,
    source: "public_form",
    reviewStatus: "new",
    privacyStatus: "private",
    contactProvided: hasContact,
    mayContact,
    mayPrepareEncouragement,
    privacyCopyVersion
  };
}

function controlledPersistenceConfig(env: NodeJS.ProcessEnv) {
  if (getStoryIntakeMode(env) !== "preview_controlled_persistence") {
    return {
      ok: false as const,
      code: "preview_persistence_disabled",
      message: "Controlled preview persistence is disabled."
    };
  }

  const databaseUrl = String(env.DATABASE_URL || env.POSTGRES_URL || "").trim();
  const privacyCopyVersion = String(env.SOH_LITE_PRIVACY_COPY_VERSION || "").trim();

  if (!databaseUrl) {
    return {
      ok: false as const,
      code: "preview_database_not_configured",
      message: "Controlled preview persistence is blocked until a review-approved preview database is configured."
    };
  }

  if (!privacyCopyVersion) {
    return {
      ok: false as const,
      code: "privacy_copy_version_missing",
      message: "Controlled preview persistence is blocked until the privacy copy version is configured."
    };
  }

  return {
    ok: true as const,
    databaseUrl,
    privacyCopyVersion
  };
}

function getStoryIntakeMode(env: NodeJS.ProcessEnv): StoryIntakeMode {
  const rawMode = String(env.SOH_LITE_PERSISTENCE_MODE || "").trim().toLowerCase();
  return rawMode === "preview" || rawMode === "controlled_preview" || rawMode === "preview_controlled_persistence"
    ? "preview_controlled_persistence"
    : "preview_mock";
}

function buildSuccessBody({
  mode,
  stored,
  reference,
  reviewStatus,
  intake,
  message
}: {
  mode: StoryIntakeMode;
  stored: boolean;
  reference: string;
  reviewStatus: string;
  intake: ValidatedStoryIntake;
  message: string;
}) {
  return {
    ok: true,
    mode,
    stored,
    reference,
    reviewStatus,
    received: {
      preferredName: intake.preferredName || null,
      storyTitle: intake.storyTitle || null,
      categoryOrStruggle: intake.categoryOrStruggle || null,
      hopeOutcome: intake.hopeOutcome || null,
      mayContact: intake.mayContact
    },
    message
  };
}

function failure(message: string, status: number, mode: StoryIntakeMode) {
  return {
    ok: false as const,
    status,
    body: {
      ok: false,
      mode,
      stored: false,
      message
    }
  };
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function createPreviewReference() {
  return `SOH-LITE-PREVIEW-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}
