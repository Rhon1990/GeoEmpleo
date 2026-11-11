export function createMobileOfferCarousel() {
  let ids = [];
  let activeId = null;

  const snapshot = () => {
    const index = Math.max(0, ids.indexOf(activeId));
    const total = ids.length;
    return {
      activeId: total ? ids[index] : null,
      index,
      total,
      hasPrevious: index > 0,
      hasNext: index < total - 1,
    };
  };

  const select = index => {
    if (ids.length) activeId = ids[Math.max(0, Math.min(index, ids.length - 1))];
    return snapshot();
  };

  return {
    matches(offers) {
      return ids.length === offers.length && offers.every((offer, index) => offer.id === ids[index]);
    },
    update(offers) {
      ids = offers.map(offer => offer.id);
      if (!ids.includes(activeId)) activeId = ids[0] ?? null;
      return snapshot();
    },
    select,
    move(delta) {
      return select(snapshot().index + delta);
    },
    snapshot,
  };
}
