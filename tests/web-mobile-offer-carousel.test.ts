import test from 'node:test';
import assert from 'node:assert/strict';
import { createMobileOfferCarousel } from '../apps/web-preview/public/mobile-offer-carousel.mjs';

const offers = (...ids: string[]) => ids.map(id => ({ id }));

test('starts at the first visible offer and exposes boundaries', () => {
  const carousel = createMobileOfferCarousel();

  assert.deepEqual(carousel.update(offers('a', 'b', 'c')), {
    activeId: 'a',
    index: 0,
    total: 3,
    hasPrevious: false,
    hasNext: true,
  });
});

test('preserves the active offer while it remains visible and resets otherwise', () => {
  const carousel = createMobileOfferCarousel();
  carousel.update(offers('a', 'b', 'c'));
  carousel.select(1);

  assert.equal(carousel.update(offers('c', 'b', 'd')).activeId, 'b');
  assert.equal(carousel.update(offers('x', 'y')).activeId, 'x');
});

test('moves within boundaries and supports empty or single sets', () => {
  const carousel = createMobileOfferCarousel();

  assert.deepEqual(carousel.update([]), {
    activeId: null,
    index: 0,
    total: 0,
    hasPrevious: false,
    hasNext: false,
  });

  carousel.update(offers('a', 'b'));
  assert.equal(carousel.move(1).activeId, 'b');
  assert.equal(carousel.move(1).activeId, 'b');
  assert.equal(carousel.move(-1).activeId, 'a');
  assert.deepEqual(carousel.update(offers('only')), {
    activeId: 'only',
    index: 0,
    total: 1,
    hasPrevious: false,
    hasNext: false,
  });
});

test('identifies an unchanged ordered offer sequence', () => {
  const carousel = createMobileOfferCarousel();

  assert.equal(carousel.matches([]), true);
  carousel.update(offers('a', 'b', 'c'));
  assert.equal(carousel.matches(offers('a', 'b', 'c')), true);
  assert.equal(carousel.matches(offers('b', 'a', 'c')), false);
  assert.equal(carousel.matches(offers('a', 'b')), false);
});
