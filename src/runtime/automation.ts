export enum AutomatedValueMethod {
    LINEAR,
    EXPONENTIAL,
    STEP
}

export class AutomatedValue {
    d = 0;
    t = 0;
    m = 0;
    constructor(
        public c: number,
        public a: AutomatedValueMethod,
    ) {
    }
    goto(newValue: number, dt: number, time: number) {
        switch (this.a) {
            case AutomatedValueMethod.LINEAR:
                this.d = dt * (newValue - this.c) / time;
                break;
            case AutomatedValueMethod.EXPONENTIAL:
                if ((this.c * newValue) <= 0) {
                    throw new Error("cannot cross 0 when in exponential mode");
                }
                this.d = Math.pow(newValue / this.c, dt / time);
        }
        this.t = newValue;
        this.m = time;
        if (!time) {
            this.c = newValue;
        }
    }
    /** HOT CODE */
    update(dt: number) {
        this.m -= dt;
        if (this.m < 0) {
            this.m = 0;
            return this.c = this.t;
        }
        switch (this.a) {
            case AutomatedValueMethod.LINEAR: return this.c += this.d;
            case AutomatedValueMethod.EXPONENTIAL: return this.c *= this.d;
        }
    }
}
