import { cos, sin } from "../math";
import { FilterCoefficients } from "./iir";

export function freqz(coefficients: FilterCoefficients, w: number): [mag: number, phase: number] {
    var real = cos(w), imag = sin(w);
    const realZ1 = real;
    const imagZ1 = -imag;
    let realNum: number = coefficients.b0 + coefficients.b1 * realZ1;
    let imagNum: number = coefficients.b1 * imagZ1;
    let realDenom: number = 1 + coefficients.a1 * realZ1;
    let imagDenom: number = coefficients.a1 * imagZ1;
    let realZ: number = realZ1;
    let imagZ: number = imagZ1;
    // this block was inside the loop for 2+ order filters, but since I only
    // use 2nd order filters the loop can be removed
    const realTemp: number = realZ * realZ1 - imagZ * imagZ1;
    const imagTemp: number = realZ * imagZ1 + imagZ * realZ1;
    realZ = realTemp;
    imagZ = imagTemp;
    realNum += coefficients.b2 * realZ;
    imagNum += coefficients.b2 * imagZ;
    realDenom += coefficients.a2 * realZ;
    imagDenom += coefficients.a2 * imagZ;

    const denom = realDenom * realDenom + imagDenom * imagDenom;
    const realResult = realNum * realDenom + imagNum * imagDenom;
    const imagResult = imagNum * realDenom - realNum * imagDenom;

    return [
        Math.hypot(realResult, imagResult) / denom,
        Math.atan2(imagResult, realResult),
    ]
}
