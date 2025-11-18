# Syd

<!-- markdownlint-disable single-h1 heading-increment no-trailing-punctuation -->

Syd is a simple, versatile, and opinionated Javascript/Typescript library for playing a wide range of 8-bit videogame style sound effects and music.

Syd is inspired by [BeepBox][], [ZzFX][], and [ZzFXM][], and but is not related to any of those, isn't compatible, and is most certainly larger than ZzFXM (you wouldn't want to use Syd in a js13k game even though it is small. It's not *that* small compared to ZzFXM.)

[ZzFX]: https://github.com/KilledByAPixel/ZzFX
[ZzFXM]: https://github.com/keithclark/ZzFXM
[BeepBox]: https://github.com/johnnesky/beepbox

## General topology

To be able to create the maximum variety of sound effects, Syd implements a highly configurable audio pipeline, which can create many different sound effects.

## Notation of Graph

yeah lol i'm still working on v2

---

# Everything below this line is unimplemented and will be moved above it once it's added

so I joined the [beepbox modding discord server](https://discord.com/invite/Tc997TstJb) and i guess if you have any questions about this repository you can ask them there

## consider these TODO items

lol I have no idea what I'm doing

* make mod/automation channels globally named
* add a 3rd mod channel kind that gets fed the samples from one instrument through an envelope detector and maps the envelope to a range
* visual instrument editor UI has "node builder" classes that return a graph fragment
  * they have a rectangle area with ports on left and right
  * Use external js library for routing edges and layouting
* importer for beepbox instruments & themes
  * script to pull instruments from JukeBox and themes from AbyssBox
  * base theme from styles.ts and ColorConfig values
