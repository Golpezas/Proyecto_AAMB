(function exposeRiftboundPopupName(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BreakSuiteRiftboundPopupName = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildRiftboundPopupName() {
  const unleashedChampions = Object.freeze([
    'Jhin',
    'Rengar',
    'Pyke',
    'Vi',
    'Lillia',
    'Master Yi',
    'Vex',
    'Ivern',
    'Diana',
    'LeBlanc',
    "Kha'Zix",
    'Poppy'
  ]);

  function normalized(value) {
    return String(value || '')
      .trim()
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }

  const canonicalByName = new Map(unleashedChampions.map(name => [normalized(name), name]));

  function championName(card = {}) {
    const game = normalized(card.game_code || card.game || card.catalog_game);
    const set = normalized(card.set_code || card.set || card.card_set);
    if (game !== 'RIFTBOUND' || !set.startsWith('UNL')) return '';

    const shortName = String(card.name || '').split(',')[0].trim();
    return canonicalByName.get(normalized(shortName)) || '';
  }

  function mappedSpotName(card = {}) {
    const bundle = card && typeof card.spot_bundle === 'object' ? card.spot_bundle : null;
    const kind = normalized(bundle?.kind);
    if (!bundle || (!kind.startsWith('VENDETTA-')
      && !kind.startsWith('SPIRITFORGED-EXPANDED-')
      && !kind.startsWith('SPIRITFORGED-BOARD-4-')
      && !kind.startsWith('SPIRITFORGED-BOARD-10-')
      && !kind.startsWith('UNLEASHED-EXPANDED-'))) return '';
    return String(bundle.label || '').trim();
  }

  function bundleCaption(bundle = {}) {
    const kind = normalized(bundle.kind);
    if (kind === 'SPIRITFORGED-EXPANDED-CHAMPION') return 'SPIRITFORGED CHAMPION SPOT';
    if (kind === 'SPIRITFORGED-EXPANDED-FIZZ-PREMONITION') return 'FIZZ + PREMONITION SPOT';
    if (kind === 'SPIRITFORGED-EXPANDED-NAMED-BUNDLE') return 'SPIRITFORGED COMBINED SPOT';
    if (kind === 'SPIRITFORGED-EXPANDED-NAMED-SINGLE') return 'SPIRITFORGED SOLO SPOT';
    if (kind === 'SPIRITFORGED-EXPANDED-SEAL') return 'SPIRITFORGED SEAL SPOT';
    if (kind === 'SPIRITFORGED-EXPANDED-RUNE-COLOR') return 'RUNE + RARE/EPIC SPOT';
    if (kind.startsWith('SPIRITFORGED-EXPANDED-')) return 'SPIRITFORGED BOARD 6 SPOT';
    if (kind.startsWith('SPIRITFORGED-BOARD-4-')) return 'SPIRITFORGED BOARD 4 SPOT';
    if (kind.startsWith('SPIRITFORGED-BOARD-10-')) return 'SPIRITFORGED PURE COLOR';
    if (kind === 'VENDETTA-COLOR') return 'VENDETTA SP + RUNE SPOT';
    if (kind === 'VENDETTA-COMBINATION') return 'VENDETTA COMBINED SPOT';
    if (kind === 'VENDETTA-BOARD-9-SINGLE-ANCHOR') return 'VENDETTA BOARD 9 SPOT';
    if (kind.startsWith('UNLEASHED-EXPANDED-')) return 'UNLEASHED BOARD 7 SPOT';
    if (kind === 'COMBO-VISUAL') return 'VISUAL COMBO SPOT';
    if (kind === 'UNLEASHED-COLOR-BREAK') return 'UNLEASHED COLOR SPOT';
    if (kind === 'COLOR') return 'COLOR CHASE SPOT';
    return 'SIGNATURE + CHAMPION';
  }

  return Object.freeze({ bundleCaption, championName, mappedSpotName, unleashedChampions });
});
