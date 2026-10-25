// Branding & design: a member saves their brand, starts a design from a
// template, and opens the saved design rendered in THEIR brand (name, colors,
// fonts). Designs stay private to their owner.
import { api, expectText } from "./_helpers.mjs";

export async function task({ base, newMember }) {
  const member = await newMember();
  const saved = await api(member, "POST", `${base}/api/branding`, {
    brandName: "Prove Bakery",
    tagline: "Fresh every morning",
    primaryColor: "#aa3300",
    secondaryColor: "#552200",
    fontHeading: "Lato",
    fontBody: "Georgia"
  });
  if (saved.branding?.brandName !== "Prove Bakery") throw new Error("saving branding did not return it");
  const reread = (await api(member, "GET", `${base}/api/branding`)).branding;
  if (reread.primaryColor !== "#aa3300" || reread.fontHeading !== "Lato") throw new Error(`branding did not persist: ${JSON.stringify(reread)}`);
  await expectText(member, `${base}/branding`, "Fresh every morning", "the branding page previews the saved brand");

  const { design } = await api(member, "POST", `${base}/api/branding/designs`, { title: "Spring Flyer", templateId: "flyer-modern" });
  if (!design?.id || design.width !== 816 || design.category !== "flyer") throw new Error(`design did not take the template: ${JSON.stringify(design)}`);
  await expectText(member, `${base}/branding/templates`, "Spring Flyer", "the saved design is listed");

  // Opening the design shows it in the member's brand.
  await expectText(member, `${base}/branding/designs/${design.id}`, "Prove Bakery", "the saved design renders with the brand");
  const canvas = member.locator('[data-testid="design-canvas"]');
  if (!(await canvas.count())) throw new Error("the design page has no canvas");
  const html = await canvas.evaluate((el) => el.outerHTML);
  if (!/170,\s*51,\s*0|#aa3300/i.test(html) || !html.includes("Lato") || !html.includes("Fresh every morning")) {
    throw new Error(`the design canvas does not use the brand: ${html.slice(0, 300)}`);
  }

  // Private to its owner.
  const other = await newMember();
  const peek = await other.request.get(`${base}/api/branding/designs/${design.id}`);
  if (peek.status() !== 404) throw new Error(`another member reading the design got ${peek.status()}`);
  const peekPage = await other.goto(`${base}/branding/designs/${design.id}`);
  if (peekPage.status() !== 404) throw new Error(`another member opening the design page got ${peekPage.status()}`);
  const theirs = (await api(other, "GET", `${base}/api/branding/designs`)).designs;
  if (theirs?.some((d) => d.id === design.id)) throw new Error("another member's list includes this design");
}
