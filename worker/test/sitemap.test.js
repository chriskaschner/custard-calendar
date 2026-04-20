import { describe, it, expect } from 'vitest';
import { handleSitemap, handleRobotsTxt } from '../src/sitemap.js';
import { LAUNCH_SLUGS } from '../src/route-store-page.js';

const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

describe('handleSitemap', () => {
  it('returns status 200', () => {
    const res = handleSitemap(corsHeaders);
    expect(res.status).toBe(200);
  });

  it('returns Content-Type application/xml; charset=utf-8', () => {
    const res = handleSitemap(corsHeaders);
    expect(res.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
  });

  it('body starts with xml declaration and contains urlset root element', async () => {
    const res = handleSitemap(corsHeaders);
    const body = await res.text();
    expect(body).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(body).toContain('</urlset>');
  });

  it('contains a url element for each LAUNCH_SLUGS entry (17 URLs)', async () => {
    const res = handleSitemap(corsHeaders);
    const body = await res.text();
    const urlMatches = body.match(/<url>/g);
    expect(urlMatches).not.toBeNull();
    expect(urlMatches.length).toBe(LAUNCH_SLUGS.size);
    expect(LAUNCH_SLUGS.size).toBe(17);
  });

  it('each URL follows pattern https://custard.chriskaschner.com/store/wi/{city}/{slug}/', async () => {
    const res = handleSitemap(corsHeaders);
    const body = await res.text();
    const locMatches = [...body.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
    expect(locMatches.length).toBe(17);
    for (const loc of locMatches) {
      expect(loc).toMatch(/^https:\/\/custard\.chriskaschner\.com\/store\/wi\/[a-z0-9-]+\/[a-z0-9-]+\/$/);
    }
  });

  it('each URL element contains a lastmod element with YYYY-MM-DD date', async () => {
    const res = handleSitemap(corsHeaders);
    const body = await res.text();
    const lastmodMatches = [...body.matchAll(/<lastmod>(.*?)<\/lastmod>/g)].map(m => m[1]);
    expect(lastmodMatches.length).toBe(17);
    for (const date of lastmodMatches) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('returns Cache-Control public max-age=86400', () => {
    const res = handleSitemap(corsHeaders);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });
});

describe('handleRobotsTxt', () => {
  it('returns status 200', () => {
    const res = handleRobotsTxt(corsHeaders);
    expect(res.status).toBe(200);
  });

  it('returns Content-Type text/plain; charset=utf-8', () => {
    const res = handleRobotsTxt(corsHeaders);
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
  });

  it('body contains "Allow: /store/" directive', async () => {
    const res = handleRobotsTxt(corsHeaders);
    const body = await res.text();
    expect(body).toContain('Allow: /store/');
  });

  it('body contains "Sitemap: https://custard.chriskaschner.com/sitemap.xml"', async () => {
    const res = handleRobotsTxt(corsHeaders);
    const body = await res.text();
    expect(body).toContain('Sitemap: https://custard.chriskaschner.com/sitemap.xml');
  });
});
