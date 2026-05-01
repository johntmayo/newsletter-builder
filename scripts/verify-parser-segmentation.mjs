import assert from "node:assert/strict";
import { parseNewsletterHtml } from "../lib/parseNewsletterHtml.js";

function issueWithSection(sectionHeading, sectionHtml) {
  return `
    <html>
      <body>
        <h1>Neighborhood Captain Newsletter</h1>
        <h2 style="color: #168930">Thursday, April 30, 2026</h2>
        <p>Next Issue: May 14 • Content Deadline: May 12</p>
        <h2 style="color: #d35400"><strong>${sectionHeading}</strong></h2>
        ${sectionHtml}
      </body>
    </html>
  `;
}

function onlySection(parsed) {
  assert.equal(parsed.sections.length, 1);
  return parsed.sections[0];
}

{
  const parsed = parseNewsletterHtml(
    issueWithSection(
      "Community & Financial Support",
      `
        <p>
          <a href="https://example.test/sce">SoCal Edison Wildfire Recovery Compensation Program</a> | DEADLINE November 30, 2026
          <br><br>
          <a href="https://example.test/step">The Step Up Fund</a> is giving $2,500 to fire survivors who face eviction.
          <br><br>
          <strong>Union Station Housing Assistance</strong> helps Eaton Fire survivors covering security deposits and rent.
        </p>
      `,
    ),
  );

  const section = onlySection(parsed);
  assert.equal(section.items.length, 3);
  assert.match(section.items[0].text, /SoCal Edison/);
  assert.match(section.items[1].text, /Step Up Fund/);
  assert.match(section.items[2].text, /Union Station Housing Assistance/);
  assert.equal(section.items[0].links.length, 1);
  assert.equal(section.items[1].links.length, 1);
  assert.equal(section.items[2].links.length, 0);
  assert.equal(section.items[0].id, "s1i1");
  assert.equal(section.items[2].id, "s1i3");
}

{
  const parsed = parseNewsletterHtml(
    issueWithSection(
      "Events",
      `
        <p><strong>Altadena Walk Club</strong></p>
        <p>An easy 30-minute roundtrip walk with neighbors and then refreshments.</p>
        <ul>
          <li>Sunday, April 19 @ 9:30am</li>
          <li>Unincorporated Coffee - 3045 Lincoln Ave</li>
        </ul>
      `,
    ),
  );

  const section = onlySection(parsed);
  assert.equal(section.items.length, 1);
  assert.match(section.items[0].text, /Altadena Walk Club/);
  assert.match(section.items[0].text, /Unincorporated Coffee/);
  assert.match(section.items[0].bodyHtml, /<ul>/);
}

{
  const parsed = parseNewsletterHtml(
    issueWithSection(
      "Events",
      `
        <p><strong>Fire Stories Project |</strong> <a href="https://example.test/register"><strong>Register</strong></a></p>
        <p>Attend a moving performance at Boston Court Pasadena exploring personal narratives and resilience.</p>
        <ul>
          <li><p>Saturday, May 2 at 1:00 pm</p></li>
        </ul>
        <ul>
          <li><p>Sunday, May 3 at 1:00 pm and 3:30 pm</p></li>
        </ul>
      `,
    ),
  );

  const section = onlySection(parsed);
  assert.equal(section.items.length, 1);
  assert.match(section.items[0].text, /Fire Stories Project/);
  assert.match(section.items[0].text, /Saturday, May 2/);
  assert.match(section.items[0].text, /Sunday, May 3/);
  assert.equal(section.items[0].bodyHtml.match(/<ul>/g)?.length, 2);
}

{
  const parsed = parseNewsletterHtml(
    issueWithSection(
      "Ongoing Support",
      `
        <p>
          Prior resource stays independent.
          <br><br>
          <strong>New resource with details below</strong>
        </p>
        <ul>
          <li>Call 555-0100</li>
        </ul>
      `,
    ),
  );

  const section = onlySection(parsed);
  assert.equal(section.items.length, 2);
  assert.match(section.items[0].text, /Prior resource/);
  assert.doesNotMatch(section.items[0].text, /Call 555-0100/);
  assert.match(section.items[1].text, /New resource/);
  assert.match(section.items[1].text, /Call 555-0100/);
}

{
  const parsed = parseNewsletterHtml(
    issueWithSection(
      "Community & Financial Support",
      `
        <p>
          <br>
          <a href="https://www.thestepfund.org/"><strong>The </strong><strong>Step Up Fund</strong></a><strong> is giving $2,500 to fire survivors who face eviction.</strong>
          <br><br>
        </p>
      `,
    ),
  );

  const section = onlySection(parsed);
  assert.equal(section.items.length, 1);
  assert.match(section.items[0].text, /The Step Up Fund is giving/);
  assert.equal(section.items[0].links.length, 1);
  assert.doesNotMatch(section.items[0].bodyHtml, /<p>\s*<br/i);
  assert.doesNotMatch(section.items[0].bodyHtml, /<br\s*\/?>\s*<\/p>/i);
}

{
  const parsed = parseNewsletterHtml(
    issueWithSection(
      "Recovery Updates",
      `
        <ul>
          <li>
            <p>
              <strong>INSURANCE</strong><br>
              A delegation of fire survivors organized by EFSN secured three major wins.
              <a href="https://example.test/penalty">Penalty deferment form<br><br></a>
              <br><br>
            </p>
          </li>
        </ul>
      `,
    ),
  );

  const section = onlySection(parsed);
  assert.equal(section.items.length, 1);
  assert.match(section.items[0].text, /INSURANCE/);
  assert.doesNotMatch(section.items[0].bodyHtml, /<br\s*\/?>\s*<\/p>/i);
  assert.doesNotMatch(section.items[0].bodyHtml, /<br\s*\/?>\s*<\/a>/i);
}

console.log("Parser segmentation verification passed.");
