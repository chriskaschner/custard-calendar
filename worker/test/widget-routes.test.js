import { describe, expect, it } from 'vitest';
import {
  handleWidgetScript,
  handleWidgetVersion,
  WIDGET_VERSION,
  WIDGET_UPDATED,
} from '../src/widget-routes.js';
import { getExpensiveReadLimitConfig } from '../src/index.js';

const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

describe('handleWidgetScript', () => {
  it('returns status 200', async () => {
    const res = handleWidgetScript(corsHeaders);
    expect(res.status).toBe(200);
  });

  it('returns Content-Type: text/javascript; charset=utf-8', async () => {
    const res = handleWidgetScript(corsHeaders);
    expect(res.headers.get('Content-Type')).toBe('text/javascript; charset=utf-8');
  });

  it('returns Cache-Control: public, max-age=86400', async () => {
    const res = handleWidgetScript(corsHeaders);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });

  it('response body contains "Custard Today" header comment', async () => {
    const res = handleWidgetScript(corsHeaders);
    const body = await res.text();
    expect(body).toContain('Custard Today');
  });

  it('response body is non-trivial (length > 1000)', async () => {
    const res = handleWidgetScript(corsHeaders);
    const body = await res.text();
    expect(body.length).toBeGreaterThan(1000);
  });

  it('returns CORS headers', async () => {
    const res = handleWidgetScript(corsHeaders);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('handleWidgetVersion', () => {
  it('returns status 200', async () => {
    const res = handleWidgetVersion(corsHeaders);
    expect(res.status).toBe(200);
  });

  it('returns Content-Type: application/json', async () => {
    const res = handleWidgetVersion(corsHeaders);
    expect(res.headers.get('Content-Type')).toContain('application/json');
  });

  it('returns Cache-Control: public, max-age=3600', async () => {
    const res = handleWidgetVersion(corsHeaders);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
  });

  it('response body parses as JSON with version string field', async () => {
    const res = handleWidgetVersion(corsHeaders);
    const json = await res.json();
    expect(typeof json.version).toBe('string');
    expect(json.version).toBeTruthy();
  });

  it('response body includes updated date field', async () => {
    const res = handleWidgetVersion(corsHeaders);
    const json = await res.json();
    expect(typeof json.updated).toBe('string');
    expect(json.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('version matches WIDGET_VERSION export', async () => {
    const res = handleWidgetVersion(corsHeaders);
    const json = await res.json();
    expect(json.version).toBe(WIDGET_VERSION);
  });

  it('updated matches WIDGET_UPDATED export', async () => {
    const res = handleWidgetVersion(corsHeaders);
    const json = await res.json();
    expect(json.updated).toBe(WIDGET_UPDATED);
  });
});

describe('rate-limit config for widget endpoints', () => {
  it('rate-limit config exists for /api/widget/script path', () => {
    const config = getExpensiveReadLimitConfig('/api/widget/script', 'GET');
    expect(config).not.toBeNull();
    expect(config.prefix).toBe('rl:widget:script');
    expect(config.limit).toBe(60);
  });

  it('rate-limit config exists for /api/widget/version path', () => {
    const config = getExpensiveReadLimitConfig('/api/widget/version', 'GET');
    expect(config).not.toBeNull();
    expect(config.prefix).toBe('rl:widget:version');
    expect(config.limit).toBe(120);
  });

  it('rate-limit config returns null for non-GET methods on widget/script', () => {
    const config = getExpensiveReadLimitConfig('/api/widget/script', 'POST');
    expect(config).toBeNull();
  });
});
