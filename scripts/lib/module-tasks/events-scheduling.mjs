// Events: an organizer publishes an event, a member sees it and registers, and
// the organizer sees the registration count. The job is "people RSVP".
import { api, expectText } from "./_helpers.mjs";

export async function task({ page, base, newMember }) {
  const start = new Date(Date.now() + 7 * 86400000).toISOString();
  const created = await api(page, "POST", `${base}/api/scheduling/events`, {
    title: "Prove Picnic",
    description: "Bring a dish.",
    startDate: start,
    location: "Fellowship Hall",
    capacity: 10,
    registrationRequired: true,
    isPublished: true
  });
  const id = created.event?.id;
  if (!id) throw new Error("create event returned no id");

  const member = await newMember();
  await expectText(member, `${base}/scheduling`, "Prove Picnic", "a member sees the published event");
  await api(member, "POST", `${base}/api/scheduling/events/${id}/register`, { partySize: 2 });
  await expectText(member, `${base}/scheduling/${id}`, "You are registered", "the member sees they're registered");

  const detail = await api(page, "GET", `${base}/api/scheduling/events/${id}`);
  if (Number(detail.event?.registrationCount) < 1) throw new Error(`organizer sees ${detail.event?.registrationCount} registrations`);
}
