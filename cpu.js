'use strict';

const sysFont = [
    0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
    0x20, 0x60, 0x20, 0x20, 0x70, // 1
    0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
    0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
    0x90, 0x90, 0xF0, 0x10, 0x10, // 4
    0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
    0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
    0xF0, 0x10, 0x20, 0x40, 0x40, // 7
    0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
    0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
    0xF0, 0x90, 0xF0, 0x90, 0x90, // A
    0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
    0xF0, 0x80, 0x80, 0x80, 0xF0, // C
    0xE0, 0x90, 0x90, 0x90, 0xE0, // D
    0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
    0xF0, 0x80, 0xF0, 0x80, 0x80  // F
]

class CPU {
    constructor(IO) {
        this.memory = new Uint8Array(4096);
        this.memory.set(sysFont);
        this.reg = new Uint8Array(16);
        this.stack = new Uint16Array(16);
        this.pc = 0x200;
        this.I = 0;
        this.dt = 0;
        this.st = 0;
        this.sp = 0;
        this.keys = new Array(16);
        this.display = new Array(64 * 64);
        this.IO = IO;
        IO.onKey(this.giveKey.bind(this));
        IO.onTick(this.tick.bind(this));
        this.reset();
    }

    reset() {
        this.display.fill(0);
        this.memory.fill(0,0x200,0x1000);
        this.reg.fill(0);
        this.stack.fill(0);
        this.pc = 0x200;
        this.I = 0;
        this.dt = 0;
        this.st = 0;
        this.sp = 0;
        this.keys.fill(false);
        this.awaitingKey = false;
        this.cls();
    }

    loadROM(bytes) {
        this.reset();
        var b = new Uint8Array(bytes);
        this.memory.set(b,0x200);
    }

    tick () {
        if (this.dt > 0) this.dt --;
        if (this.st > 0) this.st --;
    }
    cls () {
        this.display.fill(0);
        this.IO.cls();
    }

    updateDisplay() {
        this.IO.display(this.display);
    }

    giveKey (key, state) {
        // this prevents key repetition.
        if(this.keys[key] == state) return;
        this.keys[key] = state;
        if(state && this.awaitingKey) {
            this.reg[this.keyReg] = key;
            this.awaitingKey = false;
        }
    }

    keyState (key) {
        return this.keys[key];
    }

    step () {
        if(this.awaitingKey) return;
        const instr = (this.memory[this.pc] << 8) | (this.memory[this.pc+1]);
        
        //console.log(`${this.pc}: ${instr.toString(16)}`);
        const x = (instr >> 8) & 0xF;
        const y = (instr >> 4) & 0xF;
        const addr = instr & 0xFFF;
        const byte = instr & 0xFF;
        const nybble = instr & 0xF;
        let incr = true;
        switch (instr >> 12) {
            case 0x0:
                switch (instr & 0xFF) {
                    case 0xE0: // CLS
                        this.cls ();
                        break;
                    case 0xEE: // RET
                        if(this.sp == 0) throw "Stack underflow"
                        this.pc = this.stack[--this.sp];
                        break;
                    default: throw `Unhandled instruction ${instr.toString(16)}`
                }
                break;
            case 0x1: // JP addr
                this.pc = addr;
                incr = false;
                break;
            case 0x2: // CALL addr
                if(this.sp == 15) throw "Stack overflow"
                this.stack[this.sp++] = this.pc;
                this.pc = addr;
                incr = false;
                break;
            case 0x3: // SE Vx, byte
                if(this.reg[x] == byte) {
                    this.pc += 2;
                }
                break;
            case 0x4: // SNE Vx, byte
                if(this.reg[x] != byte) {
                    this.pc += 2;
                }
                break;
            case 0x5: // SE Vx, Vy
                if(this.reg[x] == this.reg[y]) {
                    this.pc += 2;
                }
                break;
            case 0x6: // LD Vx, byte
                this.reg[x] = byte;
                break;
            case 0x7: // ADD Vx, byte
                this.reg[x] += byte;
                break;
            case 0x8: // arithmetic instrs
                switch (instr & 0xF) {
                    case 0x0: // LD Vx, Vy
                        this.reg[x] = this.reg[y];
                        break;
                    case 0x1: // OR Vx, Vy
                        this.reg[x] |= this.reg[y];
                        break;
                    case 0x2: // AND Vx, Vy
                        this.reg[x] &= this.reg[y];
                        break;
                    case 0x3: // XOR Vx, Vy
                        this.reg[x] ^= this.reg[y];
                        break;
                    case 0x4: // ADD Vx, Vy
                    {
                        const result = this.reg[x] + this.reg[y];
                        this.reg[0xF] = result > 0xFF ? 1 : 0;
                        this.reg[x] = result;
                    }
                        break;
                    case 0x5: // SUB Vx, Vy
                    {
                        const result = this.reg[x] - this.reg[y];
                        this.reg[0xF] = this.reg[x] > this.reg[y] ? 1 : 0;
                        this.reg[x] = result;
                    }
                        break;
                    case 0x6: // SHR Vx, Vy
                        this.reg[0xF] = this.reg[x] & 1;
                        this.reg[x] >>= 1;
                        break;
                    case 0x7: // SUBN Vx, Vy
                    {
                        const result = this.reg[y] - this.reg[x];
                        this.reg[0xF] = this.reg[x] < this.reg[y] ? 1 : 0;
                        this.reg[x] = result;
                    }
                        break;
                    case 0xE: // SHL Vx, Vy
                        this.reg[0xF] = this.reg[x] & 0x80 == 0x80 ? 1 : 0;
                        this.reg[x] <<= 1;
                        break;
                    default: throw `Unhandled instruction ${instr.toString(16)}`
                }
                break;
            case 0x9: // SNE Vx, Vy
                if(this.reg[x] != this.reg[y]) {
                    this.pc += 2;
                }
                break;
            case 0xA: // LD I, addr
                this.I = addr;
                break;
            case 0xB: // JP V0, addr
                this.pc = addr + this.reg[0];
                incr = false;
                break;
            case 0xC: // RND Vx, byte
                const rand = (Math.random() * 256) & 0xFF;
                this.reg[x] = rand & byte;
                break;
            case 0xD: // DRW Vx, Vy, nybble
                // blit via XOR
                const _x = this.reg[x]
                this.reg[0xF] = 0;
                for(let i = 0; i < nybble; i++) {
                    const bits = this.memory[this.I+i];
                    for(let j = 0; j < 8; j++) {
                        const loc = j + (i + this.reg[y]) * 64 + this.reg[x];
                        const old = this.display[loc];
                        const pix = (bits >> (7-j)) & 1;
                        if (old && pix) {
                            this.reg[0xF] = 1;
                        }
                        this.display[loc] = old ^ pix;
                    }
                }
                break;
            case 0xE:
                switch (instr & 0xFF) {
                    case 0x9E: // SKP Vx
                        if(this.keyState(this.reg[x])) {
                            this.pc += 2;
                        }
                        break;
                    case 0xA1: // SKNP Vx
                        if(!this.keyState(this.reg[x])) {
                            this.pc += 2;
                        }
                        break;
                    default: throw `Unhandled instruction ${instr.toString(16)}`
                }
                break;
            case 0xF:
                switch (instr & 0xFF) {
                    case 0x07: // LD Vx, DT
                        this.reg[x] = this.dt;
                        break;
                    case 0x0A: // LD Vx, K
                        this.awaitingKey = true;
                        this.keyReg = x;
                        break;
                    case 0x15: // LD DT, Vx
                        this.dt = this.reg[x];
                        break;
                    case 0x18: // LD ST, Vx
                        this.st = this.reg[x];
                        break;
                    case 0x1E: // ADD I, Vx
                        this.I += this.reg[x];
                        break;
                    case 0x29: // LD I, Vx
                        this.I = this.reg[x] * 5;
                        break;
                    case 0x33: // LD B, Vx
                        let val = this.reg[x];
                        this.memory[this.I+2] = val % 10; val /= 10;
                        this.memory[this.I+1] = val % 10; val /= 10;
                        this.memory[this.I] = val;
                        break;
                    case 0x55: // LD [I], Vx
                        for(let i = 0; i <= x; i++) {
                            this.memory[i+this.I] = this.reg[i];
                        }
                        break;
                    case 0x65: // LD Vx, [I]
                        for(let i = 0; i <= x; i++) {
                            this.reg[i] = this.memory[i+this.I];
                        }
                        break;
                    default: throw `Unhandled instruction ${instr.toString(16)}`
                }
                break;
            default: throw `Unhandled instruction ${instr.toString(16)}`
        }
        if (incr) {
            this.pc += 2;
        }
    }
}