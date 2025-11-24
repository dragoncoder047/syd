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

* make all connections using channels? and remove "return value" of nodes (just leave garbage on stack, but graph designates which output channel(s) it goes to)
* write unit tests for constant nodes and stuff (compilation, unification/simplification)
* lemon's text channel idea
  * formant filter?
  * need text-to-phoneme algorithm
* visual instrument editor UI has "node builder" classes that return a graph fragment
  * they have a rectangle area with ports on left and right
  * port libavoid algorithm to javascript <https://people.eng.unimelb.edu.au/pstuckey/papers/gd09.pdf>
    * idea for spaced routing: each internal node of visibility graph records how many links can fit through the gap; the node can be reused only for that many different connectors (outer nodes have infinite space and infinite capacity)
    * how to add 45 degree segments?
    * then at end just for each internal node used multiple times, find all of the paths, go to one end and sort them by the opposing coordinate of the endpoints, and then distribute them around the center of the gap
  * add a "rubber wire" force-directed floppy simulation mode
