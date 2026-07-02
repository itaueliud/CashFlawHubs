const { describe, it, expect } = require('vitest');
const { normalizeProviderAlert, buildProviderStatus } = require('../src/services/jobProviderService');

describe('job provider helpers', () => {
  it('normalizes saved alerts with a default country and trimmed keywords', () => {
    const alert = normalizeProviderAlert({
      skill: '  React  ',
      country: 'KE',
      keywords: ['remote', '  ui  ', ''],
    });

    expect(alert.skill).toBe('React');
    expect(alert.country).toBe('KE');
    expect(alert.keywords).toEqual(['remote', 'ui']);
  });

  it('marks providers as unconfigured when API keys are absent', () => {
    const status = buildProviderStatus({
      theirStackConfigured: false,
      loopcvConfigured: false,
    });

    expect(status.theirStack.status).toBe('unconfigured');
    expect(status.loopcv.status).toBe('unconfigured');
    expect(status.theirStack.message).toContain('fallback');
  });
});
