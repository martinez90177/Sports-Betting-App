// Wide team logos, and how to draw them at a readable size.
//
// ESPN's logos are square images, and most fill them. A handful are wide and
// short -- the Pelicans' wings are 35% of the image tall, the Jets' wordmark
// 29% -- so drawn into a square box they shrink to a sliver while every other
// crest in the row looks normal. Measured once from the images themselves
// (visible height as a share of the image, 2026-11-18); anything 60% or taller
// draws normally.
const WIDE = {
  nba: { LAL: 56, NOP: 35, OKC: 53 },
  nfl: { WAS: 51, GB: 59, SF: 54, SEA: 41, CAR: 49, NYJ: 29, NE: 44, BAL: 44, LAC: 41, DEN: 54 },
  wnba: { DAL: 57, TOR: 46 },
  mlb: {},
};

// For a crest asked to be `size` tall: how wide its box should be, and how big
// to draw the image inside it, so the visible logo is about as tall as a
// normal one. The image overflows the box only by its own transparent
// padding, which is what gets clipped.
export function logoFit(sport, abbr, size) {
  const h = (WIDE[sport] || {})[String(abbr || "").toUpperCase()];
  if (!h) return { width: size, height: size, image: size };
  // Aim for the logo to stand ~62% of the box tall, scaling the image up to
  // 1.7x at most so the box never grows more than ~1.6x wide.
  const f = Math.min(1.7, Math.max(1, 62 / h));
  const image = Math.round(size * f);
  return { width: Math.round(image * 0.94), height: size, image };
}
