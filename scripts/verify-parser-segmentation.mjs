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
      "Community & Financial Support",
      `
        <p><strong>Paint discount for survivors</strong></p>
        <p>Reach out to your Neighborhood Captain for negotiated paint discounts.</p>
        <p><a href="https://example.test/electric"><strong>All-Electric Incentives, Rebates & Grant</strong></a></p>
        <p>You could get help paying for heat pumps, batteries, and induction stoves.</p>
        <ul>
          <li><p><a href="https://example.test/calehp">California Electric Homes Program</a></p></li>
          <li><p><a href="https://example.test/rise">RISE Homes Program</a></p></li>
        </ul>
      `,
    ),
  );

  const section = onlySection(parsed);
  assert.equal(section.items.length, 3);
  assert.match(section.items[0].text, /Paint discount/);
  assert.match(section.items[1].text, /Neighborhood Captain/);
  assert.match(section.items[2].text, /All-Electric Incentives/);
  assert.match(section.items[2].text, /RISE Homes Program/);
  assert.equal(section.items[2].bodyHtml.match(/<ul>/g)?.length, 1);
}

{
  const parsed = parseNewsletterHtml(
    issueWithSection(
      "Surveys",
      `
        <p><a href="https://example.test/laist"><strong>How LAist tells stories about LA</strong></a></p>
        <p><a href="https://example.test/up"><strong>United Policyholders survey</strong></a></p>
        <ul></ul>
      `,
    ),
  );

  const section = onlySection(parsed);
  assert.equal(section.items.length, 2);
  assert.match(section.items[0].text, /LAist/);
  assert.match(section.items[1].text, /United Policyholders/);
  assert.doesNotMatch(section.items[0].bodyHtml, /<ul><\/ul>/);
  assert.doesNotMatch(section.items[1].bodyHtml, /<ul><\/ul>/);
}

{
  const parsed = parseNewsletterHtml(
    issueWithSection(
      "Events",
      `
        <p><strong>LitFest in the Dena | </strong><a href="https://example.test/schedule"><strong>Full Schedule</strong><br></a>Celebrate local literature and storytelling at this free annual festival.</p>
        <ul>
          <li><p>Friday, May 1 and Saturday, May 2<br><br></p></li>
        </ul>
      `,
    ),
  );

  const section = onlySection(parsed);
  assert.equal(section.items.length, 1);
  assert.match(section.items[0].bodyHtml, /Full Schedule<\/strong><br\s*\/?><\/a>Celebrate/);
  assert.doesNotMatch(section.items[0].bodyHtml, /Schedule<\/strong><\/a>Celebrate/);
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

{
  const parsed = parseNewsletterHtml(
    issueWithSection(
      "Recovery Updates",
      `
        <ul>
          <li>
            <p>
              <strong>TREES FOR ALTADENA</strong><br>
              <strong>Altadena Green </strong>has put together a <a href="https://example.test/trees"><strong>list of recommended trees</strong></a> for Altadena. If you have an existing tree that needs watering, sign<a href="https://example.test/watering"><strong> up for free tree watering support</strong></a> from <strong>Amigos de los Rios</strong>.
            </p>
          </li>
          <li>
            <p>
              <strong>Altadena Heritage </strong><a href="https://example.test/poppy"><strong>Golden Poppy 2026 Special Effort Awards</strong></a><strong> Nominations close on May 3</strong><br>
              For properties at various stages of rebuilding.
            </p>
          </li>
        </ul>
      `,
    ),
  );

  const section = onlySection(parsed);
  assert.equal(section.items.length, 2);
  assert.match(section.items[0].bodyHtml, /Altadena Green <\/strong>has/);
  assert.match(section.items[0].bodyHtml, /sign<a [^>]+><strong> up for free tree watering support/);
  assert.match(section.items[1].bodyHtml, /Altadena Heritage <\/strong><a/);
  assert.match(section.items[1].bodyHtml, /<\/a><strong> Nominations close on May 3/);
}

{
  const parsed = parseNewsletterHtml(
    issueWithSection(
      "Ongoing Support",
      `
        <p>
          <strong>Submit post-remediation home test results to EFRU's </strong><a href="https://example.test/map"><strong>contamination map</strong></a><strong>.</strong><br>
          <a href="https://example.test/habitat"><strong>San Gabriel Valley Habitat</strong></a><strong> for Humanity is seeking retired builders, contractors, and skilled tradespeople</strong> who can volunteer their time and expertise to support home rebuilds: <a href="https://example.test/volunteer">Volunteer Application<br></a><br>
        </p>
      `,
    ),
  );

  const section = onlySection(parsed);
  assert.equal(section.items.length, 2);
  assert.match(section.items[0].text, /EFRU's contamination map/);
  assert.doesNotMatch(section.items[0].text, /San Gabriel Valley Habitat/);
  assert.match(section.items[1].text, /San Gabriel Valley Habitat/);
  assert.match(section.items[1].text, /Volunteer Application/);
}

{
  const parsed = parseNewsletterHtml(
    issueWithSection(
      "Recovery Updates",
      `
        <p>
          <strong>INSURANCE</strong><br>
          A delegation of fire survivors organized by EFSN fought for a suite of insurance reform bills.
        </p>
      `,
    ),
  );

  const section = onlySection(parsed);
  assert.equal(section.items.length, 1);
  assert.match(section.items[0].text, /INSURANCE A delegation/);
}

{
  const parsed = parseNewsletterHtml(
    issueWithSection(
      "Links",
      `
        <p><a href="https://example.test/library">Altadena Library eConnect</a></p>
        <h3><a href="https://example.test/sidecca"><strong>SIDECCA</strong></a> RE-RE-RE-OPENS THIS SATURDAY!</h3>
        <p>Free Sidecca mural tote bag for first 100 people</p>
        <p>Saturday, May 9 @ 10-5 pm (2455 N Lake)</p>
      `,
    ),
  );

  const section = onlySection(parsed);
  assert.equal(section.items.length, 4);
  assert.match(section.items[1].text, /SIDECCA RE-RE-RE-OPENS THIS SATURDAY!/);
}

{
  const parsed = parseNewsletterHtml(
    issueWithSection(
      "Recovery Updates",
      `
        <ul>
          <li><strong>Lincoln Water Avenue Company Update</strong></li>
          <ul>
            <li><p>Water rates will increase 18% in 2026.</p></li>
            <li><p>Standby fees based on meter size will be reinstated in 2026.</p></li>
            <li><p>More info can be found in their <a href="https://example.test/notice">notification</a>.</p></li>
          </ul>
        </ul>
      `,
    ),
  );

  const section = onlySection(parsed);
  assert.equal(section.items.length, 1);
  assert.match(section.items[0].text, /Lincoln Water Avenue Company Update/);
  assert.match(section.items[0].text, /Water rates will increase 18%/);
  assert.match(section.items[0].text, /Standby fees/);
  assert.match(section.items[0].text, /notification/);
  assert.match(section.items[0].bodyHtml, /<ul>/);
  assert.equal(section.items[0].links.length, 1);
}

{
  const parsed = parseNewsletterHtml(
    issueWithSection(
      "Recovery Updates",
      `
        <ul>
          <li>
            <strong>The Los Angeles County Sheriff's Department Altadena Station has a free Construction Check Program,</strong> to provide regular courtesy checks.
          </li>
          <ul>
            <li>Email: <a href="mailto:altadenahomecheck@lasd.org">altadenahomecheck@lasd.org</a> with your name, address, and a valid callback number.</li>
          </ul>
        </ul>
      `,
    ),
  );

  const section = onlySection(parsed);
  assert.equal(section.items.length, 1);
  assert.match(section.items[0].text, /Construction Check Program/);
  assert.match(section.items[0].text, /altadenahomecheck@lasd\.org/);
  assert.match(section.items[0].bodyHtml, /mailto:altadenahomecheck@lasd\.org/);
}

console.log("Parser segmentation verification passed.");
