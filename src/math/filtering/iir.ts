import { cos, sin, sqrt, tan } from "../math";

export class FilterCoefficients {
    a1: number;
    a2: number;
    b0: number;
    b1: number;
    b2: number;
    constructor(a0: number, a1: number, a2: number, b0: number, b1: number, b2: number) {
        this.a1 = a1 / a0;
        this.a2 = a2 / a0;
        this.b0 = b0 / a0;
        this.b1 = b1 / a0;
        this.b2 = b2 / a0;
    }
}

// Most of these calculations are taken from beepbox synth/filtering.ts
// I copied the comments too.

export function lowpass1stOrder(w: number) {
    // The output of this filter is nearly identical to the 1st order
    // Butterworth low-pass above, except if the cutoff is set to Nyquist/3,
    // then the output is the same as the input, and if the cutoff is higher
    // than that, then the output actually resonates at high frequencies
    // instead of attenuating.
    // I'm guessing this filter was converted from analog to digital using
    // the "matched z-transform" method instead of the "bilinear transform"
    // method. The difference is that the bilinear transform warps
    // frequencies so that the lowpass response of zero at analogue ∞hz maps
    // to the digital Nyquist frequency, whereas the matched z-transform
    // preserves the frequency of the filter response but also adds the
    // reflected response from above the Nyquist frequency.
    const g = 2 * sin(w / 2);
    return new FilterCoefficients(0, g - 1, 0, g, 0, 0);
}

export function highShelf1stOrder(w: number, gain: number): FilterCoefficients {
    // I had trouble figuring this one out because I couldn't find any
    // online algorithms that I understood. There are 3 degrees of freedom
    // and I could narrow down a couple of them based on the desired gain at
    // DC and nyquist, but getting the cutoff frequency correct took a
    // little bit of trial and error in my attempts to interpret page 53 of
    // this chapter: http://www.music.mcgill.ca/~ich/classes/FiltersChap2.pdf
    // Obviously I don't fully understand the bilinear transform yet!
    const t = tan(w / 2);
    const sqrtGain = sqrt(gain);
    const g = (t * sqrtGain - 1) / (t * sqrtGain + 1);
    return new FilterCoefficients(1, g, 0, (1 + g + gain * (1 - g)) / 2, (1 + g - gain * (1 - g)) / 2, 0);
}

export function allPass1stOrderInvertPhaseAbove(w: number): FilterCoefficients {
    const g = (sin(w) - 1.0) / cos(w);
    return new FilterCoefficients(1, g, 0, g, 1, 0);
}

export function lowPass2ndOrderButterworth(w: number, q: number): FilterCoefficients {
    // This is Butterworth if peakLinearGain=1/√2 according to:
    // http://web.archive.org/web/20191213120120/https://crypto.stanford.edu/~blynn/sound/analog.html
    // An interesting property is that if peakLinearGain=1/16 then the
    // output resembles a first-order lowpass at a cutoff 4 octaves lower,
    // although it gets distorted near the nyquist.
    const alpha = sin(w) / (2 * q);
    const c = cos(w);
    return new FilterCoefficients(1 + alpha, -2 * c, 1 - alpha, (1 - c) / 2, (1 - c), (1 - c) / 2);
}

export function lowPass2ndOrderSimplified(w: number, q: number): FilterCoefficients {
    // This filter is adapted from the one in the SFXR source code:
    // https://www.drpetter.se/project_sfxr.html
    // The output is nearly identical to the resonant Butterworth low-pass
    // above, except it resonates too much when the cutoff approaches the
    // nyquist. If the resonance is set to zero and the cutoff is set to
    // nyquist/3, then the output is the same as the input.
    const g = 2 * sin(w / 2);
    const filterResonance = 1 - 1 / (2 * q);
    const feedback = filterResonance + filterResonance / (1 - g);
    return new FilterCoefficients(1, 2 * g + (g - 1) * g * feedback - 2, (g - 1) * (g - g * feedback - 1), g * g, 0, 0);
}

export function highPass2ndOrderButterworth(w: number, q: number): FilterCoefficients {
    const alpha = sin(w) / (2 * q);
    const c = cos(w);
    return new FilterCoefficients(1 + alpha, -1 * c, 1 - alpha, (1 + c) / 2, -(1 + c), (1 + c) / 2);
}

export function highShelf2ndOrder(w: number, gain: number, slope: number): FilterCoefficients {
    const A = sqrt(gain);
    const c = cos(w);
    const Aplus = A + 1;
    const Aminus = A - 1;
    const alpha = sin(w) / 2 * sqrt((Aplus / A) * (1 / slope - 1) + 2);
    const sqrtA2Alpha = 2 * sqrt(A) * alpha;
    return new FilterCoefficients(
        Aplus - Aminus * c + sqrtA2Alpha,
        2 * (Aminus - Aplus * c),
        Aplus - Aminus * c - sqrtA2Alpha,
        A * (Aplus + Aminus * c + sqrtA2Alpha),
        -2 * A * (Aminus + Aplus * c),
        A * (Aplus + Aminus * c - sqrtA2Alpha));
}

export function peak2ndOrder(w: number, gain: number, width: number): FilterCoefficients {
    const sqrtGain = sqrt(gain);
    const bandWidth = width * w / (sqrtGain >= 1 ? sqrtGain : 1 / sqrtGain);
    const alpha = tan(bandWidth / 2);
    return new FilterCoefficients(1 + alpha / sqrtGain, -2 * cos(w), 1 - alpha / sqrtGain, 1 + alpha / sqrtGain, -2 * cos(w), 1 - alpha * sqrtGain);
}

