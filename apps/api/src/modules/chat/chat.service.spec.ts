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
