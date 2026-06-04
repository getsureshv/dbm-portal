import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { PrismaService } from '../../common/prisma.service';
import { JurisdictionsService } from '../jurisdictions/jurisdictions.service';

/**
 * Unit tests for the jurisdiction-aware chat helpers.
 *
 * We don't exercise the streaming Anthropic path here — those are integration-
 * level. These tests cover the two pure helpers that decide whether to fetch
 * jurisdiction data and which scope tag to use.
 */
describe('ChatService — jurisdiction-aware helpers', () => {
  let service: ChatService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: PrismaService, useValue: {} },
        { provide: JurisdictionsService, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(ChatService);
  });

  describe('detectJurisdictionIntent', () => {
    const positives = [
      'show me the code rules for this project',
      'What permits do I need?',
      'Are there recent permits nearby?',
      'Will my deck comply with building code?',
      'Do I need a permit for an ADU?',
      'GFCI requirements in my kitchen?',
      'What about rapid shutdown for solar?',
      'wind load for the roof?',
      'Which IRC sections apply?',
      'is it legal to skip the inspection?',
      'what jurisdiction am I in',
      'setback rules in Houston',
    ];
    for (const msg of positives) {
      it(`fires on: "${msg}"`, () => {
        expect(service.detectJurisdictionIntent(msg)).toBe(true);
      });
    }

    const negatives = [
      'I want a modern kitchen with quartz counters',
      'my budget is around 80k',
      'when can we start?',
      'show me some inspiration photos',
      'the dimensions are 12x15',
      '',
    ];
    for (const msg of negatives) {
      it(`stays quiet on: "${msg}"`, () => {
        expect(service.detectJurisdictionIntent(msg)).toBe(false);
      });
    }
  });

  describe('inferScopeTag', () => {
    it('detects deck from project type', () => {
      expect(service.inferScopeTag('deck addition', null, '')).toBe('deck');
    });
    it('detects ADU from scope description', () => {
      expect(
        service.inferScopeTag(
          'RESIDENTIAL',
          'Build a 600 sqft accessory dwelling unit in the backyard',
          '',
        ),
      ).toBe('adu');
    });
    it('detects kitchen from user message', () => {
      expect(
        service.inferScopeTag('RESIDENTIAL', null, 'Range hood code for my kitchen?'),
      ).toBe('kitchen');
    });
    it('detects solar from any source', () => {
      expect(service.inferScopeTag('RESIDENTIAL', 'rooftop pv array', '')).toBe('solar');
    });
    it('returns null when nothing matches', () => {
      expect(service.inferScopeTag('RESIDENTIAL', 'general remodel', 'hi')).toBe(null);
    });
    it('prefers earlier checks (deck before kitchen) when both keywords appear', () => {
      // user mentions deck adjacent to kitchen — deck wins in our priority
      expect(
        service.inferScopeTag('RESIDENTIAL', 'deck off the kitchen', ''),
      ).toBe('deck');
    });
  });
});

/**
 * Separate suite for buildJurisdictionContext fallback wiring — specifically
 * that the "unsupported ZIP" message now lists supported cities dynamically
 * from JurisdictionsService.list() instead of a hardcoded string.
 */
describe('ChatService.buildJurisdictionContext — dynamic fallback list', () => {
  let service: ChatService;
  let listMock: jest.Mock;
  let resolveMock: jest.Mock;

  beforeEach(async () => {
    listMock = jest.fn();
    resolveMock = jest.fn().mockResolvedValue(null); // force unsupported path
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: PrismaService, useValue: {} },
        {
          provide: JurisdictionsService,
          useValue: { list: listMock, resolveAddress: resolveMock },
        },
      ],
    }).compile();
    service = moduleRef.get(ChatService);
  });

  it('lists supported cities dynamically with country code', async () => {
    listMock.mockResolvedValueOnce([
      { name: 'City of Dallas', state: 'TX', countryCode: 'US' },
      { name: 'Town of Flower Mound', state: 'TX', countryCode: 'US' },
      { name: 'City of Houston', state: 'TX', countryCode: 'US' },
    ]);
    const out = await service.buildJurisdictionContext(
      '99999',
      'RESIDENTIAL',
      null,
      'do I need a permit?',
    );
    expect(out).not.toBeNull();
    expect(out).toContain('City of Dallas (TX, US)');
    expect(out).toContain('Town of Flower Mound (TX, US)');
    expect(out).toContain('City of Houston (TX, US)');
    // sanity: should NOT contain the old hardcoded list verbatim
    expect(out).not.toContain('Dallas TX, Flower Mound TX, Houston TX');
  });

  it('falls back to a safe message if list() throws', async () => {
    listMock.mockRejectedValueOnce(new Error('db down'));
    const out = await service.buildJurisdictionContext(
      '99999',
      'RESIDENTIAL',
      null,
      'permits?',
    );
    expect(out).toContain('unable to enumerate supported jurisdictions');
  });

  it('handles empty jurisdiction list gracefully', async () => {
    listMock.mockResolvedValueOnce([]);
    const out = await service.buildJurisdictionContext(
      '99999',
      'RESIDENTIAL',
      null,
      'permits?',
    );
    expect(out).toContain('no jurisdictions configured');
  });
});
