/**
 * Tests for social crawler interception in index.js.
 *
 * Covers:
 *   - isSocialCrawler() UA detection
 *   - buildCrawlerHtml() OG tag generation
 *   - handleCrawlerInterception() route matching and HTML output
 *   - Human browser pass-through (non-crawler returns null)
 */
import { describe, it, expect } from 'vitest';
import { isSocialCrawler, buildCrawlerHtml, handleCrawlerInterception } from '../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url, ua = '') {
  return new Request(url, {
    headers: ua ? { 'User-Agent': ua } : {},
  });
}

const QUIZ_URL = 'https://custard.chriskaschner.com/quiz.html?archetype=cool-front&flavor=Mint%20Cookie';
const RADAR_URL = 'https://custard.chriskaschner.com/radar.html?flavor=Turtle';
const INDEX_URL = 'https://custard.chriskaschner.com/index.html?flavor=Turtle';
const API_URL = 'https://custard.chriskaschner.com/api/flavors?slug=mt-horeb';

// Common social crawler UA strings
const CRAWLER_UAS = [
  'facebookexternalhit/1.1',
  'Twitterbot/1.0',
  'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
  'WhatsApp/2.23.2 A',
  'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  'Discordbot/2.0 (+https://discordapp.com)',
  'TelegramBot (like TwitterBot)',
  'python-requests/2.31.0',
  'curl/7.88.1',
];

// Human browser UA strings
const HUMAN_UAS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
];

// ---------------------------------------------------------------------------
// isSocialCrawler()
// ---------------------------------------------------------------------------

describe('isSocialCrawler', () => {
  it.each(CRAWLER_UAS)('detects crawler UA: %s', (ua) => {
    const req = makeRequest('https://example.com/', ua);
    expect(isSocialCrawler(req)).toBe(true);
  });

  it.each(HUMAN_UAS)('returns false for human UA: %s', (ua) => {
    const req = makeRequest('https://example.com/', ua);
    expect(isSocialCrawler(req)).toBe(false);
  });

  it('returns false when User-Agent header is absent', () => {
    const req = new Request('https://example.com/');
    expect(isSocialCrawler(req)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildCrawlerHtml()
// ---------------------------------------------------------------------------

describe('buildCrawlerHtml', () => {
  const params = {
    title: 'Cool Front: Mint Cookie — Custard Personality Engine',
    description: 'Your custard personality match is Mint Cookie.',
    imageUrl: 'https://custard.chriskaschner.com/og/quiz/cool-front/Mint%20Cookie.png',
    canonicalUrl: 'https://custard.chriskaschner.com/quiz.html?archetype=cool-front&flavor=Mint+Cookie',
  };

  it('includes og:title', () => {
    const html = buildCrawlerHtml(params);
    expect(html).toContain('og:title');
    expect(html).toContain('Cool Front: Mint Cookie');
  });

  it('includes og:image with the PNG URL', () => {
    const html = buildCrawlerHtml(params);
    expect(html).toContain('og:image');
    expect(html).toContain(params.imageUrl);
  });

  it('includes og:description', () => {
    const html = buildCrawlerHtml(params);
    expect(html).toContain('og:description');
    expect(html).toContain('Your custard personality match');
  });

  it('includes twitter:card = summary_large_image', () => {
    const html = buildCrawlerHtml(params);
    expect(html).toContain('twitter:card');
    expect(html).toContain('summary_large_image');
  });

  it('includes og:image width and height 1200x630', () => {
    const html = buildCrawlerHtml(params);
    expect(html).toContain('og:image:width');
    expect(html).toContain('1200');
    expect(html).toContain('og:image:height');
    expect(html).toContain('630');
  });

  it('includes canonical link', () => {
    const html = buildCrawlerHtml(params);
    expect(html).toContain('canonical');
    // canonicalUrl is HTML-escaped in href attribute
    expect(html).toContain('quiz.html');
  });

  it('escapes HTML special characters in title', () => {
    const html = buildCrawlerHtml({
      ...params,
      title: 'Reese\'s & Friends <fun>',
    });
    expect(html).not.toContain('<fun>');
    expect(html).toContain('&amp;');
  });

  it('returns a valid HTML string starting with <!DOCTYPE html>', () => {
    const html = buildCrawlerHtml(params);
    expect(html.trim()).toMatch(/^<!DOCTYPE html>/);
  });
});

// ---------------------------------------------------------------------------
// handleCrawlerInterception()
// ---------------------------------------------------------------------------

describe('handleCrawlerInterception', () => {
  // -- Human browsers get null (pass-through) --

  it.each(HUMAN_UAS)('returns null for human browser UA: %s', (ua) => {
    const req = makeRequest(QUIZ_URL, ua);
    const url = new URL(QUIZ_URL);
    expect(handleCrawlerInterception(req, url)).toBeNull();
  });

  it('returns null for crawler hitting an API path (no share params)', () => {
    const req = makeRequest(API_URL, 'facebookexternalhit/1.1');
    const url = new URL(API_URL);
    expect(handleCrawlerInterception(req, url)).toBeNull();
  });

  it('returns null for crawler hitting /quiz.html without archetype param', () => {
    const urlStr = 'https://custard.chriskaschner.com/quiz.html';
    const req = makeRequest(urlStr, 'Twitterbot/1.0');
    const url = new URL(urlStr);
    expect(handleCrawlerInterception(req, url)).toBeNull();
  });

  it('returns null for crawler hitting /quiz.html with only archetype (no flavor)', () => {
    const urlStr = 'https://custard.chriskaschner.com/quiz.html?archetype=cool-front';
    const req = makeRequest(urlStr, 'Twitterbot/1.0');
    const url = new URL(urlStr);
    expect(handleCrawlerInterception(req, url)).toBeNull();
  });

  it('returns null for crawler hitting /radar.html without flavor param', () => {
    const urlStr = 'https://custard.chriskaschner.com/radar.html';
    const req = makeRequest(urlStr, 'facebookexternalhit/1.1');
    const url = new URL(urlStr);
    expect(handleCrawlerInterception(req, url)).toBeNull();
  });

  // -- Quiz URL interception --

  it('returns HTML for crawler requesting quiz.html?archetype=X&flavor=Y', async () => {
    const req = makeRequest(QUIZ_URL, 'facebookexternalhit/1.1');
    const url = new URL(QUIZ_URL);
    const res = handleCrawlerInterception(req, url);
    expect(res).not.toBeNull();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/text\/html/);
  });

  it('quiz interception: og:image points to /og/quiz/{archetype}/{flavor}.png', async () => {
    const req = makeRequest(QUIZ_URL, 'Twitterbot/1.0');
    const url = new URL(QUIZ_URL);
    const res = handleCrawlerInterception(req, url);
    const html = await res.text();
    expect(html).toContain('/og/quiz/cool-front/');
    expect(html).toContain('.png');
  });

  it('quiz interception: og:title mentions archetype and flavor', async () => {
    const req = makeRequest(QUIZ_URL, 'Twitterbot/1.0');
    const url = new URL(QUIZ_URL);
    const res = handleCrawlerInterception(req, url);
    const html = await res.text();
    // Archetype "cool-front" should appear as "Cool Front"
    expect(html).toContain('Cool Front');
    expect(html).toContain('Mint');
  });

  it('quiz interception: response header X-Crawler-Intercepted = quiz', () => {
    const req = makeRequest(QUIZ_URL, 'LinkedInBot/1.0');
    const url = new URL(QUIZ_URL);
    const res = handleCrawlerInterception(req, url);
    expect(res.headers.get('X-Crawler-Intercepted')).toBe('quiz');
  });

  it('quiz interception: sets Cache-Control', () => {
    const req = makeRequest(QUIZ_URL, 'Twitterbot/1.0');
    const url = new URL(QUIZ_URL);
    const res = handleCrawlerInterception(req, url);
    expect(res.headers.get('Cache-Control')).toBeTruthy();
  });

  // -- Radar flavor URL interception --

  it('returns HTML for crawler requesting radar.html?flavor=X', async () => {
    const req = makeRequest(RADAR_URL, 'facebookexternalhit/1.1');
    const url = new URL(RADAR_URL);
    const res = handleCrawlerInterception(req, url);
    expect(res).not.toBeNull();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/text\/html/);
  });

  it('radar interception: og:image points to /og/flavor/{flavor}.png', async () => {
    const req = makeRequest(RADAR_URL, 'Twitterbot/1.0');
    const url = new URL(RADAR_URL);
    const res = handleCrawlerInterception(req, url);
    const html = await res.text();
    expect(html).toContain('/og/flavor/');
    expect(html).toContain('.png');
    expect(html).toContain('Turtle');
  });

  it('radar interception: response header X-Crawler-Intercepted = flavor', () => {
    const req = makeRequest(RADAR_URL, 'Twitterbot/1.0');
    const url = new URL(RADAR_URL);
    const res = handleCrawlerInterception(req, url);
    expect(res.headers.get('X-Crawler-Intercepted')).toBe('flavor');
  });

  // -- index.html flavor URL interception --

  it('returns HTML for crawler requesting index.html?flavor=X', async () => {
    const req = makeRequest(INDEX_URL, 'facebookexternalhit/1.1');
    const url = new URL(INDEX_URL);
    const res = handleCrawlerInterception(req, url);
    expect(res).not.toBeNull();
    expect(res.status).toBe(200);
  });

  it('index interception: og:image points to /og/flavor/{flavor}.png', async () => {
    const req = makeRequest(INDEX_URL, 'Discordbot/2.0');
    const url = new URL(INDEX_URL);
    const res = handleCrawlerInterception(req, url);
    const html = await res.text();
    expect(html).toContain('/og/flavor/');
    expect(html).toContain('Turtle');
  });

  // -- Edge cases --

  it('handles flavors with spaces and special characters in URL', async () => {
    const urlStr = 'https://custard.chriskaschner.com/radar.html?flavor=Mint%20Cookie';
    const req = makeRequest(urlStr, 'Twitterbot/1.0');
    const url = new URL(urlStr);
    const res = handleCrawlerInterception(req, url);
    expect(res).not.toBeNull();
    const html = await res.text();
    expect(html).toContain('Mint');
  });
});
