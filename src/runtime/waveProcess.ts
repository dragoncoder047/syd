export function samplesToIntegral(wave: Float32Array): Float32Array {
    const integral = new Float32Array(wave.length + 1);
    integral.set(wave);
    const len = wave.length;
    var i: number;
    // remove DC offset to prevent blowup
    var average = 0; for (i = 0; i < len; i++) average += integral[i]!; average /= len;
    for (i = 0; i < len; i++) integral[i]! -= average;
    // do integral
    var a = 0, p = 0; for (i = 0; i < len; i++) { a += p; p = integral[i]!; integral[i] = a; }
    return integral;
}

// this function only exists to document the math
export function lengthToBasePitch(numSamplesInChipWave: number, masterDt: number): number {
    // masterSampleRate is typically 48 kHz.
    // if you play back a wavetable with N samples at 1:1 samples, the perceived
    // frequency is 48kHz / N or a multiple of it and the wavetable logic handles
    // denormalizing it to the right frequency.
    // The math below is equivalent. numSamples * dt is the length in seconds of one loop at 1:1 samplerate.
    return 1 / (numSamplesInChipWave * masterDt);
}
