export enum AutomatedValueMethod {
    LINEAR,
    EXPONENTIAL,
    STEP
}

export class AutomatedValue {
    delta: number = 0;
    value: number = 0;
    target: number = 0;
    timeLeft: number = 0;
    constructor(
        initial: number,
        public mode: AutomatedValueMethod,
    ) {
        this.value = initial;
    }
    goto(newValue: number, dt: number, time: number) {
        switch (this.mode) {
            case AutomatedValueMethod.LINEAR:
                this.delta = dt * (newValue - this.value) / time;
                break;
            case AutomatedValueMethod.EXPONENTIAL:
                if ((this.value * newValue) <= 0) {
                    throw new Error("cannot cross 0 when in exponential mode");
                }
                this.delta = Math.pow(newValue / this.value, dt / time);
        }
        this.target = newValue;
        this.timeLeft = time;
        if (!time) {
            this.value = newValue;
        }
    }
    /** HOT CODE */
    update(dt: number) {
        this.timeLeft -= dt;
        if (this.timeLeft < 0) {
            this.timeLeft = 0;
            return this.value = this.target;
        }
        switch (this.mode) {
            case AutomatedValueMethod.LINEAR: return this.value += this.delta;
            case AutomatedValueMethod.EXPONENTIAL: return this.value *= this.delta;
        }
    }
}
