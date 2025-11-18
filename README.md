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

<!-- ### Special channels for music: BPM, envelopes/articulation, feed-through timing

(I typed this up as though I was going to implement it and then didn't. Oops! Here's to more free time...)

As Syd is intended to create not only sound effects, but music, there are special invalid  values placed at the beginning that will tell Syd that the input channel timing array means something else.

1. If the first element of the channel array is undefined and the rest are positive or undefined, this means the channel array is a tempo-based array. Instead of seconds for the time value and any other arbitrary value for the value, the time becomes beats and the output value becomes BPM, and the beats time value is relative to the current BPM. The "output" of this channel is then the beat count.

    Example:

    ```js
    [
        , // undefined to put it in tempo mode
        -24, 120, // steady at 120 BPM for 24 beats
        4, 130, // linearly poco accelerando over 4 beats
        -3.75, 60, // suddent molto ritardando, 60 BPM, for 3.75 beats
        -.25, 3, // basically a fermata (hold last 16th node at 3 BPM)
        -32, 120 // a tempo for the rest of the song
    ]
    ```

2. If the first element is a negative number (which would normally make no sense -- how could something last for negative time), it instead means that the channel is relative to the output of channel -(N-1). So for example, you could list the "conductor" channel first (at index 0) which controls the tempo and BPM, and song data channels could be relative to this (using beat count rather than wall time for timing); they would all start with -1 meaning channel 0.

<!-- 3. If the first three elements begin with undefined and a negative number, this means that it is a "envelope" or resetting per-note channel. The negative number means the same thing as in case 2 (which channel to use as a gate input), and the third value is the behavior parameter which is a number or undefined:
    * undefined or 0: modulation is disabled; timer resets when input goes to zero
    * 1: modulation is disabled; timer resets when input changes
    * 2: modulation value **adds** to the output value; timer resets when input goes to zero
    * 3: modulation **multiplies** output; timer resets when input changes
    * 4: modulation **multiplies** output; timer resets when input goes to zero
    * 5: modulation **multiplies** output; timer resets when input goes to zero or changes

    The behavior of the timer is controlled by the input as follows
    * At the start, the internal timer is set to 0.
    * The internal timer remains 0 and the t=0 value is outputted until the input changes away from 0 (only if behavior = 0, 3, 4, or 5).
    * When the input changes and triggers a reset, the internal timer starts and the value is output (with modulation, if enabled).
    * When the shaper reaches a time slice with a negative time value, the internal timer stops and the value specified by that slice is "held" (before modulation).
    * When the input value goes to 0 again the timer continues to the end of the sequence and then resets to 0 again and stops.

    For example, here is how to create an ADSR envelope channel:

    ```js
    [
        , -3, , // make it an articulation channel using channel 3 as a gate
        .05, , 1, // attack time = 50 ms
        .1, , .9, // decay time = 100 ms, systain volume = 90%
        -1, , .9, // sustain (volume here should be the same as decay slice to prevent a step change)
        .2 // release time = 200 ms
    ]
    ```
TODO: the envelope channel header conflicts with the negative duration BPM thing

--

## Other ideas that haven't been well thought out

* Optimize things, so that the "gain node" and "switch node" things are automatically recognized and the internal stack machine operation format can automatically skip updating the state of nodes that are known to not contribute to the final sample.
    * This may be harder than it looks because some nodes need to be continuously updated (which?)

* Add "instrument instancing" where a sequence of instructions can be repeated for an array of values
    * The note data input track would produce these
    * Need to figure out how to create and destroy node templates and stuff
    * Need to figure out how to define the transition type and how the already-initialized instruments can be reused
        * "Normal" - strike each new note separately
        * "Slide" / "Slide in pattern" - nonzero pitch bend slide time, configurable max step distance, it just finds the closest note pairs in the transition and automatically extends the notes and then adds pitch slide instructions
        * "Interrupt" - reset effects envelopes except for ADSR, insert zero-length pitch slides
        * "Continue" - completely merges the notes and gate signals etc

* Implement a generalized FM instrument macro (also once I figure out how BeepBox does it).

* Have a node that converts MIDI note number into frequency
    * This would kind of fix it to 12-EDO because it would need extremely ugly decimals for microtonal that is not a multiple of 12
        * Auto-fraction may fix this, the fractions might work out nice. Or not.

* Make the "compressed JSON" parser able to parse fractions like 1/16 so people can more easily hand-write stuff without having to break out a calculator (also `.0625` is a tad longer than `1/16` and gets worse as the fraction gets smaller). Maybe also have the stringifier detect likely fractions and do this too. [Relevant StackOverflow question](https://stackoverflow.com/questions/26643695/converting-a-floating-point-decimal-value-to-a-fraction)

* Make Syd capable of streaming output (being able to play some sound before all samples are generated). Need to figure out how to reify buildSamples' internal state.

* Be able to specify more than one channel value in the same array. This would be conducive to, say, encoding an entire track of a song (note pitch, articulation, dynamics, "muting" a horn, etc.) with the values at the same timestep right next to each other in the array, and the lengths are re-used, so stuff stays in sync.
    * This would mean that the single channel outputs an array, so the input reference needs to specify which index (possibly using the first number)
        * It could just be a macro that outputs things
        * Either that or the outputs of the channel have to be named

* Maybe also make a ZzFXM importer and renderer.

* Some more kinds of math nodes.
    * A selector node that takes N+1 inputs and uses the first % N to select which input (this could be used with a clock and integrator combination to do the arpeggiation thing from BeepBox)
    * Greater-than, less-than, etc

* Maybe also have possible values going around be arrays of numbers
    * Have a node that can tell the length
    * This would simplify the BeepBox arpeggiation if the pitch channel output can output an array

* :smiley: :smiley: :smiley: Make [a BeepBox fork](https://github.com/dragoncoder047/dragonbox) that uses Syd as a backend and lets people edit the instrument graph visually, and then export to some compressed-JSON string that can be sent to a dedicated renderer
    * DragonBox is not there yet.
 -->