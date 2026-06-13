import { NextResponse } from "next/server";

type IntakePayload = {
  preferredName?: unknown;
  email?: unknown;
  storyTitle?: unknown;
  storyBody?: unknown;
  mayReview?: unknown;
  mayContact?: unknown;
  mayPrepareEncouragement?: unknown;
};

const maxStoryLength = 5000;

export async function POST(request: Request) {
  let payload: IntakePayload;

  try {
    payload = await request.json();
  } catch {
    return failure("The story could not be read. Please try again.", 400);
  }

  const storyBody = cleanText(payload.storyBody);
  const preferredName = cleanText(payload.preferredName);
  const email = cleanText(payload.email);
  const storyTitle = cleanText(payload.storyTitle);
  const mayReview = payload.mayReview === true;
  const mayContact = payload.mayContact === true;
  const mayPrepareEncouragement = payload.mayPrepareEncouragement === true;

  if (storyBody.length < 40) {
    return failure("Share a little more of the story so the team has enough context.", 400);
  }

  if (storyBody.length > maxStoryLength) {
    return failure(`Please keep the story under ${maxStoryLength} characters for this preview.`, 400);
  }

  if (!mayReview || !mayPrepareEncouragement) {
    return failure("Please confirm the review and encouragement consent choices before submitting.", 400);
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return failure("Enter a valid email address or leave it blank.", 400);
  }

  const reference = createPreviewReference();

  return NextResponse.json(
    {
      ok: true,
      mode: "preview_mock",
      stored: false,
      reference,
      received: {
        preferredName: preferredName || null,
        storyTitle: storyTitle || null,
        mayContact
      },
      message:
        "Preview submission received. Nothing was written to Neon, no email was sent, and no production workflow was touched."
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      mode: "preview_mock",
      accepts: ["POST"],
      production: "blocked",
      storage: "disabled"
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function createPreviewReference() {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SOH-LITE-PREVIEW-${suffix}`;
}

function failure(message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      mode: "preview_mock",
      stored: false,
      message
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
