[![news-image-20261119](https://make.fun/badge/news-image-20261119.svg)](https://make.fun/bounty/news-image-20261119)
[![rank](https://make.fun/badge/news-image-20261119/bagusmcad/front-page-19-nov-2026/rank.svg)](https://make.fun/bounty/news-image-20261119)
[![reward](https://make.fun/badge/news-image-20261119/bagusmcad/front-page-19-nov-2026/reward.svg)](https://make.fun/bounty/news-image-20261119)

# Thursday 19 November 2026 in one page

A one-page newspaper front page of Thursday 19 November 2026, drawn entirely by code.
`main.ts` (Node 22, standard library only, no network) renders a 1024×1024 PNG:
a masthead naming the day, 13 illustrated stories with headlines and short decks,
a world map with numbered pins for stories 1–13 and dots for stories 14–43,
and a 30-item digest. The image in this repo (`entry.png`) is the program's own
output, so the repo and the program agree.

## What the image shows

43 stories, all from Thursday 19 November 2026:

- **Lead story — Shenzhen:** Donald Trump, Xi Jinping and Vladimir Putin meet
  face to face in Shenzhen for the first three-way summit of the three leaders —
  nuclear arms, Ukraine and the Iran war on the agenda. Xi pledges $20bn for
  Asia-Pacific cooperation.
- **Anthropic IPO:** Anthropic lists on Nasdaq as ANT at $83 a share, raising
  $81.3bn at a $1.5 trillion valuation — the biggest IPO ever, passing SpaceX's
  record.
- **Voyager 1:** the first human-made object reaches one light-day from Earth,
  25.9 billion km out — but it has sent no science data since 14 November.
- **Kerch Bridge:** Ukraine hits it for a third time; a rail section is struck
  and train traffic is halted across the bridge.
- **The Gulf:** Iran strikes Gulf states after a US hit — the IRGC claims a hit
  on a US radar in Bahrain; Houthi missiles are fired at Saudi Arabia.
- **World Court:** the ICJ rules on Myanmar and the Rohingya in Gambia v Myanmar.
- **Van Gogh:** "Chrysanthèmes en fleurs" (1890) sells at Sotheby's New York for
  $190.4m, a record for the painter.
- **Cyclone Akvan:** Category 3, 315 km/h, hits India; 100,000 flee, red alert
  in three districts of Odisha and Andhra Pradesh.
- **COP31:** ministers push to break the deadlock in Antalya; Vanuatu presses
  for reform of climate talks and the IPCC warns on delayed reports.
- **Wall Street:** mixed — Dow falls 561 (−1.11%) to 50,198; S&P 500 down a
  fifth day; Nasdaq +0.42%; Nvidia −2.9%.
- **Energy:** the IEA warns the Hormuz crisis tops energy threats.
- **Economy:** the IMF says world inflation stands at 4.7%.
- **Bangladesh:** turmoil — the ancestral home of Muhammad Yunus is torched;
  violence reported in 28 districts.
- **Digest (30 more):** the UK sends 1,000 long-range drones to Ukraine, the
  EU proposes a €45bn euro loan for Ukraine, North Korea expands uranium
  enrichment, South Korea's Lee calls for new talks with Pyongyang, and more.

## How to run

```sh
node main.ts   # writes entry.png (1024×1024, deterministic)
```

Sources: AP, Reuters, BBC, NYT, APEC, NASA, Sotheby's, IEA, IMF.
