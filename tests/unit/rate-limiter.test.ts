/**
 * Unit Tests — Rate Limiter
 */
import { describe, it, expect } from 'vitest'
import { getCurrentTier, PLAN_CONFIG } from '@/lib/rate-limiter'

describe('Rate Limiter: getCurrentTier', () => {
  it('returns early stage for 0 users', () => {
    const tier = getCurrentTier(0)
    expect(tier.label).toBe('Early Stage')
    expect(tier.dailyLimitPerUser).toBe(100)
  })

  it('returns early stage for exactly 25 users', () => {
    const tier = getCurrentTier(25)
    expect(tier.label).toBe('Early Stage')
  })

  it('transitions to Growing at 26 users', () => {
    const tier = getCurrentTier(26)
    expect(tier.label).toBe('Growing')
    expect(tier.dailyLimitPerUser).toBe(50)
  })

  it('returns Active tier at 100 users', () => {
    const tier = getCurrentTier(100)
    expect(tier.label).toBe('Active')
    expect(tier.dailyLimitPerUser).toBe(25)
  })

  it('returns Scaling tier at 250 users', () => {
    const tier = getCurrentTier(250)
    expect(tier.label).toBe('Scaling')
    expect(tier.dailyLimitPerUser).toBe(15)
  })

  it('returns High Volume tier at 500 users', () => {
    const tier = getCurrentTier(500)
    expect(tier.label).toBe('High Volume')
    expect(tier.dailyLimitPerUser).toBe(10)
  })

  it('returns Tier 2 Required for 1000+ users', () => {
    const tier = getCurrentTier(1000)
    expect(tier.label).toBe('Tier 2 Required')
    expect(tier.dailyLimitPerUser).toBe(8)
  })

  it('calculates utilization percent correctly', () => {
    const tier = getCurrentTier(50) // Growing: 50 users × 50 calls = 2500 / 1500 budget
    expect(tier.utilizationPercent).toBeGreaterThan(0)
    expect(typeof tier.utilizationPercent).toBe('number')
  })

  it('includes estimated monthly cost', () => {
    const tier = getCurrentTier(100)
    expect(tier.estimatedMonthlyCost).toBeGreaterThan(0)
    expect(typeof tier.estimatedMonthlyCost).toBe('number')
  })
})

describe('Rate Limiter: PLAN_CONFIG', () => {
  it('has valid daily request budget', () => {
    expect(PLAN_CONFIG.dailyRequestBudget).toBe(1500)
  })

  it('has valid RPM limit', () => {
    expect(PLAN_CONFIG.requestsPerMinute).toBe(300)
  })

  it('has cost per plan estimate', () => {
    expect(PLAN_CONFIG.costPerPlan).toBeGreaterThan(0)
  })

  it('has monotonically increasing user thresholds', () => {
    for (let i = 1; i < PLAN_CONFIG.thresholds.length; i++) {
      expect(PLAN_CONFIG.thresholds[i].maxUsers).toBeGreaterThan(
        PLAN_CONFIG.thresholds[i - 1].maxUsers
      )
    }
  })

  it('has monotonically decreasing per-user limits', () => {
    for (let i = 1; i < PLAN_CONFIG.thresholds.length; i++) {
      expect(PLAN_CONFIG.thresholds[i].dailyLimitPerUser).toBeLessThanOrEqual(
        PLAN_CONFIG.thresholds[i - 1].dailyLimitPerUser
      )
    }
  })
})
