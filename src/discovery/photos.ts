/** Fixed photographs, revealed only after discovery. Paths respect static-host base URLs. */
const PHOTOS: Record<string, string> = {
  "lantern-wisteria": "lantern-wisteria.webp",
  "rebar-ivy": "rebar-ivy.webp",
  "shutter-fern": "shutter-fern.webp",
  "sun-lotus": "sun-lotus.webp",
  "choir-moss": "choir-moss.webp",
  "hookbill": "hookbill.webp",
  "lantern-moth": "lantern-moth.webp",
  "drainback": "drainback.webp",
  "vault-mantis": "vault-mantis.webp",
  "art-vending-machine": "art-vending-machine.webp",
  "art-menu-board": "art-menu-board.webp",
  "art-torii": "art-torii.webp",
  "art-statue": "art-statue.webp",
  "origin-predecessor": "origin-predecessor.webp",
  "loc-shrine-street": "loc-shrine-street.webp",
  "loc-noodle-shop": "loc-noodle-shop.webp",
  "loc-overpass": "loc-overpass.webp",
  "loc-shrine": "loc-shrine.webp",
  "temple-cedar": "temple-cedar.webp",
  "scroll-cap": "scroll-cap.webp",
  "censer-puffball": "censer-puffball.webp",
  "gilded-carp": "gilded-carp.webp",
  "tithe-ant": "tithe-ant.webp",
  "moss-tanuki": "moss-tanuki.webp",
  "loc-stair-lane": "loc-stair-lane.webp",
  "loc-temple-gate": "loc-temple-gate.webp",
  "loc-temple-courtyard": "loc-temple-courtyard.webp",
  "loc-main-hall": "loc-main-hall.webp",
  "loc-pagoda": "loc-pagoda.webp",
  "loc-koi-pond": "loc-koi-pond.webp",
  "art-stone-lantern": "art-stone-lantern.webp",
  "art-temple-bell": "art-temple-bell.webp",
  "art-offering-box": "art-offering-box.webp",
  "art-scroll-shelf": "art-scroll-shelf.webp",
  "art-wish-wall": "art-wish-wall.webp",
  "origin-mark": "origin-mark.webp",
};

export function logbookPhoto(id: string, discovered: boolean): string | undefined {
  const file = PHOTOS[id];
  return discovered && file ? `${import.meta.env.BASE_URL}logbook/${file}` : undefined;
}
