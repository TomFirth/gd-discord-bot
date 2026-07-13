import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractGameIdeas, buildIdeaEmbed, buildIdeaPrompt, parseLlmEnhancement, loadGoogleCredentials } from '../src/commands/idea.js';

test('extractGameIdeas parses standard heading-based documents', () => {
  const document = {
    body: {
      content: [
        {
          paragraph: {
            paragraphStyle: { namedStyleType: 'HEADING_3' },
            elements: [{ textRun: { content: 'Stealth Bakery' } }],
          },
        },
        {
          paragraph: {
            paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
            elements: [{ textRun: { content: 'You run a bakery that sells pastries to thieves.' } }],
          },
        },
        {
          paragraph: {
            paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
            elements: [{ textRun: { content: 'Every customer is also a suspect.' } }],
          },
        },
      ],
    },
  };

  const ideas = extractGameIdeas(document);

  assert.equal(ideas.length, 1);
  assert.equal(ideas[0].title, 'Stealth Bakery');
  assert.match(ideas[0].description, /thieves/);
});

test('extractGameIdeas parses tabbed documents', () => {
  const document = {
    tabs: [
      {
        title: 'Moonlight Mail',
        content: [
          {
            paragraph: {
              paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
              elements: [{ textRun: { content: 'A courier game where every delivery changes time.' } }],
            },
          },
        ],
      },
    ],
  };

  const ideas = extractGameIdeas(document);

  assert.equal(ideas.length, 1);
  assert.equal(ideas[0].title, 'Moonlight Mail');
  assert.match(ideas[0].description, /delivery changes time/);
});

test('loadGoogleCredentials reads service-account credentials from a json file', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'gd-bot-'));
  const credentialsPath = path.join(tempDir, 'credentials.json');

  writeFileSync(credentialsPath, JSON.stringify({
    type: 'service_account',
    client_email: 'bot@example.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
  }));

  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;

  try {
    const credentials = loadGoogleCredentials();
    assert.equal(credentials.client_email, 'bot@example.com');
    assert.match(credentials.private_key, /BEGIN PRIVATE KEY/);
  } finally {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('buildIdeaPrompt asks the model for a structured enhancement', () => {
  const prompt = buildIdeaPrompt({
    title: 'Pocket Heist',
    description: 'A stealth game about stealing from dreams.',
  });

  assert.match(prompt, /Pocket Heist/);
  assert.match(prompt, /stealing from dreams/);
  assert.match(prompt, /valid JSON only/);
});

test('parseLlmEnhancement parses JSON responses from the local model', () => {
  const enhancement = parseLlmEnhancement('{"mvp":"Prototype a single-room heist","mechanic":"Rewind one mistake","twist":"The vault is alive","artStyle":"Comic-book noir","platform":"PC"}');

  assert.equal(enhancement.mvp, 'Prototype a single-room heist');
  assert.equal(enhancement.platform, 'PC');
});

test('buildIdeaEmbed includes proposal fields and a platform suggestion', () => {
  const embed = buildIdeaEmbed({
    title: 'Pocket Heist',
    description: 'A stealth game about stealing from dreams.',
  }, {
    mvp: 'Prototype a single-room heist',
    mechanic: 'Rewind one mistake',
    twist: 'The vault is alive',
    artStyle: 'Comic-book noir',
    platform: 'PC',
  });

  assert.equal(embed.data.title, 'Random game idea: Pocket Heist');
  assert.ok(embed.data.fields.some((field) => field.name === 'MVP / Prototype'));
  assert.ok(embed.data.fields.some((field) => field.name === 'Platform'));
});
