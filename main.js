
/*
TABLE OF CONTENTS:
==================

Section 0   .......................................   LEGv8 specifications
Section 1   .........................   jQuery and querySelector variables
Section 2   .............................   codechange, textarea scrolling
Section 3   .............................   Supporting classes and methods
Section 4   .............................................   LEGv8 assembly
Section 5   ...................................   LEGv8 running supporting
Section 6   ..............................................   LEGv8 running
 */

// +---------------------------------+ //
// | SECTION 0: LEGv8 SPECIFICATIONS | //
// +---------------------------------+ //

/*

little endian, 1 MB memory
memory slots &0x0 through &0xF are always 0

 */

let pc = 16;
let n = 0;
let v = 0;
let z = 0;
let c = 0;
let registers = Array(32);
let mem = Array(1048576);
let activeMemory = Array(1048576);

// +---------------------------------------------+ //
// | SECTION 1: JQUERY & QUERYSELECTOR VARIABLES | //
// +---------------------------------------------+ //

let line_nums = $('#line-numbers');
let code_input = $('#code');

let error_output = $('#errors');
let register_output = $('#registers');
let memory_output = $('#memory');

let controls = document.querySelector('#controls');

let about_to_run = document.querySelector('#current');
let pc_output = document.querySelector('#pc');
let n_flag = document.querySelector('#n');
let v_flag = document.querySelector('#v');
let z_flag = document.querySelector('#z');
let c_flag = document.querySelector('#c');

let step_button = document.querySelector('#step');
let run_button = document.querySelector('#run');

function line_template(badge, value) {
    return `<li class="list-group-item d-flex justify-content-between align-items-center"><span class="badge badge-primary">${badge}</span> ${value}</li>`;
}

function outputRegisters() {
    register_output.empty();
    for (let register in registers) {
        if (register < 27) {
            register_output.append(line_template(`X${register}`, registers[register].toHexString()));
        } else if (parseInt(register) === 28) {
            register_output.append(line_template(`SP`, registers[register].toHexString()));
        } else if (parseInt(register) === 29) {
            register_output.append(line_template(`FP`, registers[register].toHexString()));
        } else if (parseInt(register) === 30) {
            register_output.append(line_template(`LR`, registers[register].toHexString()));
        }
    }
}

function outputMemory() {
    memory_output.empty();
    for (let m = 0; m < 1048576; ++m) {
        if (activeMemory[m]) {
            let val = byteToNum(mem[m]).toString(16);
            val = "00".substr(val.length) + val;
            memory_output.append(line_template(`&0x${m.toString(16)}`, `0x${val}`));
        }
    }
}

function outputFlags() {
    pc_output.innerHTML = `PC = 0x${pc.toString(16)}`;
    n_flag.style = `color: ${n === 1 ? "black" : "lightgray"}`;
    v_flag.style = `color: ${v === 1 ? "black" : "lightgray"}`;
    z_flag.style = `color: ${z === 1 ? "black" : "lightgray"}`;
    c_flag.style = `color: ${c === 1 ? "black" : "lightgray"}`;
}

function outputCurrentInstruction() {
    let instr = new Int32();
    instr.setBits(0, mem[pc + 3]);
    instr.setBits(8, mem[pc + 2]);
    instr.setBits(16, mem[pc + 1]);
    instr.setBits(24, mem[pc]);

    let op = decodeOperation(instr);

    let regNumToName = (x) => {
        if (x === 28) {
            return "SP";
        } else if (x === 29) {
            return "FP";
        } else if (x === 30) {
            return "LR";
        } else if (x === 31) {
            return "XZR";
        } else {
            return `X${x}`;
        }
    };

    switch (op.instr) {
        case "ADD":
        case "ADDS":
        case "SUB":
        case "SUBS":
        case "AND":
        case "ORR":
        case "EOR":
            about_to_run.innerHTML = `${op.instr} ${regNumToName(op.Xd)}, ${regNumToName(op.Xn)}, ${regNumToName(op.Xm)}`
            break;
        case "ADDI":
        case "ADDIS":
        case "SUBI":
        case "SUBIS":
        case "ANDI":
        case "ORRI":
        case "EORI":
            about_to_run.innerHTML = `${op.instr} ${regNumToName(op.Xd)}, ${regNumToName(op.Xn)}, #${op.uimm12}`;
            break;
        case "LSL":
        case "LSR":
            about_to_run.innerHTML = `${op.instr} ${regNumToName(op.Xd)}, ${regNumToName(op.Xn)}, #${op.shamt}`;
            break;
        case "LDUR":
        case "LDURSW":
        case "LDURH":
        case "LDURB":
        case "STUR":
        case "STURW":
        case "STURH":
        case "STURB":
            about_to_run.innerHTML = `${op.instr} ${regNumToName(op.Xt)}, [${regNumToName(op.Xn)}, #${op.simm9}]`;
            break;
        case "MOVZ":
        case "MOVK":
            about_to_run.innerHTML = `${op.instr} ${regNumToName(op.Xd)}, #${op.uimm16}, LSL ${op.lsln * 16}`;
            break;
        case "BR":
            about_to_run.innerHTML = `BR ${regNumToName(op.Xt)}`;
            break;
        case "B":
        case "BL":
            about_to_run.innerHTML = `${op.instr} ${op.simm26 * 4}`;
            break;
        case "B.cond":
            about_to_run.innerHTML = `B.${op.cond} ${op.simm19 * 4}`;
            break;
        case "CBZ":
        case "CBNZ":
        case "ADR":
            about_to_run.innerHTML = `${op.instr} ${regNumToName(op.Xt)}, ${op.simm19 * 4}`;
            break;
        case "HLT":
            about_to_run.innerHTML = "HLT";
            break;
        default:
            about_to_run.innerHTML = "Oops, I couldn't figure that out!";
    }
}

// +--------------------------------------------+ //
// | SECTION 2: CODECHANGE & TEXTAREA SCROLLING | //
// +--------------------------------------------+ //

function codechange() {
    console.log('change');
    line_nums.empty();
    let sz = code_input.val().split('\n').length;
    for (let i = 1; i <= sz; ++i) {
        line_nums.append(`${i}<br/>`);
    }
    line_nums.append(`<br>`);
}

code_input.on('scroll', function () {
    line_nums.scrollTop($(this).scrollTop());
});
line_nums.on('scroll', function () {
    code_input.scrollTop($(this).scrollTop());
});

// +-----------------------------------------+ //
// | SECTION 3: SUPPORTING CLASSES & METHODS | //
// +-----------------------------------------+ //

function byteToNum(byte) {
    let num = 0;
    let value = 128;
    for (let bit of byte) {
        num += bit * value;
        value /= 2;
    }
    return num;
}

class Int {
    constructor(numBytes) {
        this.byteArr = Array(numBytes);
        for (let byte of Array(numBytes).keys()) {
            this.byteArr[byte] = [0,0,0,0,0,0,0,0];
        }
    }

    get bytes() {
        return this.byteArr;
    }

    setByte(idx, value) {
        let bin = value.toString(2);
        bin = "00000000".substr(bin.length) + bin;
        console.log(bin);
        for (let i of Array(8).keys()) {
            this.byteArr[idx][i] = (bin[i] === '1' ? 1 : 0);
        }
    }

    setBits(startIdx, new_bits) {
        if (startIdx + new_bits.length > this.byteArr.length * 8) {
            throw RangeError;
        }
        for (let i = 0; i < new_bits.length; ++i) {
            let new_bit = new_bits[i];
            if (new_bit === "1") {new_bit = 1;}
            else if (new_bit === "0") {new_bit = 0;}
            this.byteArr[Math.floor((startIdx + i) / 8)][(startIdx + i) % 8] = new_bit;
        }
    }

    toNumber(signed) {
        let mult = BigInt(1);
        let result = BigInt(0);
        for (let i = 0; i < this.byteArr.length * 8; ++i) {
            let byteIdx = this.byteArr.length - Math.floor(i / 8) - 1;
            let bitIdx = 7 - (i % 8);
            result += mult * BigInt(this.byteArr[byteIdx][bitIdx]);
            mult *= 2n;
            if (signed && i == this.byteArr.length * 8 - 2) {
                mult *= -1n;
            }
        }
        return result;
    }

    toBinaryString() {
        let binary = "";
        for (let byte of this.bytes) {
            byte.forEach(x => binary += `${x}`);
        }
        return binary;
    }

    toHexString() {
        let hex = "0x";
        for (let byte of this.bytes) {
            let bytevalue = byteToNum(byte).toString(16);
            if (bytevalue.length === 1) bytevalue = "0" + bytevalue;
            hex += bytevalue;
        }
        return hex;
    }
}

class Int32 extends Int {
    constructor() {
        super(4);
    }
}

class Int64 extends Int {
    constructor() {
        super(8);
    }
}

// +-------------------+ //
// | sort of an ALU :) | //
// +-------------------+ //

function bigIntToInt64(bi) {
    let result = new Int64();
    for (let i = 7; i >= 0; --i) {
        result.setByte(i, Number(bi % 256n));
        bi /= 256n;
    }
    return {
        result: result,
        carry: bi
    };
}

// 64 bit add w/ carry

function addWithCarry(a, b, carry) {
    console.log(`${a.toNumber(false)}, ${b.toNumber(false)}`);
    console.log(`${a.toNumber(true)}, ${b.toNumber(true)}`);
    let unsigned_sum = a.toNumber(false) + b.toNumber(false) + BigInt(carry);
    let signed_sum = a.toNumber(true) + b.toNumber(true) + BigInt(carry);
    console.log(unsigned_sum);
    console.log(signed_sum);
    let result64 = bigIntToInt64(unsigned_sum);
    let resultStr = `${result64.carry}${result64.result.toBinaryString()}`;
    console.log(resultStr);
    let result = new Int64();
    result.setBits(0, resultStr.substr(1, 64));
    console.log(result.toBinaryString());
    return {
        sum: result,
        n: (resultStr[1] === '1') ? 1 : 0,
        z: (unsigned_sum === 0n) ? 1 : 0,
        c: (result.toNumber(false) !== unsigned_sum) ? 1 : 0,
        v: (result.toNumber(true) !== signed_sum) ? 1 : 0
    };
}

function logAnd(a, b) {
    let result = new Int64();
    for (let i = 0; i < 64; ++i) {
        result.bytes[Math.floor(i / 8)][i % 8] =
            Math.floor((a.bytes[Math.floor(i / 8)][i % 8] +
                            b.bytes[Math.floor(i / 8)][i % 8]) / 2);
    }
    return result;
}

function logOr(a, b) {
    let result = new Int64();
    for (let i = 0; i < 64; ++i) {
        result.bytes[Math.floor(i / 8)][i % 8] =
            Math.ceil((a.bytes[Math.floor(i / 8)][i % 8] +
                b.bytes[Math.floor(i / 8)][i % 8]) / 2);
    }
    return result;
}

function logXor(a, b) {
    let result = new Int64();
    for (let i = 0; i < 64; ++i) {
        result.bytes[Math.floor(i / 8)][i % 8] = (a.bytes[Math.floor(i / 8)][i % 8] +
                b.bytes[Math.floor(i / 8)][i % 8]) % 2;
    }
    return result;
}

function logNot(a) {
    let result = new Int64();
    for (let i = 0; i < 64; ++i) {
        result.bytes[Math.floor(i / 8)][i % 8] =
            (a.bytes[Math.floor(i / 8)][i % 8] + 1) % 2;
    }
    return result;
}

function lsl(a, sh) {
    let result = new Int64();
    result.setBits(0, a.toBinaryString().substr(sh));
    return result;
}

function lsr(a, sh) {
    let result = new Int64();
    result.setBits(sh, a.toBinaryString().substr(0, 64 - sh));
    return result;
}

/// @param opcode: an 11-string of 0s and 1s
/// @param n, m, d: three binary strings that represent integers between 0-31 (inclusive)
/// @param samt: optional parameter for shift amount. Only used in LSL,LSR. In these instructions Rm = 0

// R type instruction:
// 00000000001111111111222222222233
// 01234567890123456789012345678901
// <--opcode-><-Rm><samt><-Rn><-Rd>

function rTypeInstruction(opcode, n, m, d, samt="000000") {
    let instr = new Int32();
    instr.setBits(0, opcode);
    instr.setBits(11, m);
    instr.setBits(16, samt);
    instr.setBits(22, n);
    instr.setBits(27, d);
    return instr;
}

/// @param opcode: a 10-string of 0s and 1s
/// @param imm: a binary string that represents an integer between 0-4095
/// @param n, d: two binary strings that are integers between 0-31 (inclusive)

// I type instruction:
// 00000000001111111111222222222233
// 01234567890123456789012345678901
// <-opcode-><---#imm---><-Rn><-Rd>

function iTypeInstruction(opcode, imm, n, d) {
    let instr = new Int32();
    instr.setBits(0, opcode);
    instr.setBits(10, imm);
    instr.setBits(22, n);
    instr.setBits(27, d);
    return instr;
}

/// @param opcode: a 11-string of 0s and 1s
/// @param addr: a 9-string of 0s and 1s
/// @param n, t: two binary strings that are integers between 0-31 (inclusive)
/// @param op2: optional parameter, defaults to "00"

// D type instruction
// 00000000001111111111222222222233
// 01234567890123456789012345678901
// <--opcode-><--addr->00<-Rn><-Rt>

function dTypeInstruction(opcode, addr, n, t, op2 = "00") {
    let instr = new Int32();
    instr.setBits(0, opcode);
    instr.setBits(11, addr);
    instr.setBits(20, op2);
    instr.setBits(22, n);
    instr.setBits(27, t);
    return instr;
}

/// @param opcode: a 6-string of 0s and 1s
/// @param addr: a 26-string of 0s and 1s, specifying the PC to jump to

// B type instruction
// 00000000001111111111222222222233
// 01234567890123456789012345678901
// opcode<---------uimm26--------->


function bTypeInstruction(opcode, addr) {
    let instr = new Int32();
    instr.setBits(0, opcode);
    instr.setBits(6, addr);
    return instr;
}

/// @param opcode: a 6-string of 0s and 1s
/// @param addr: a 26-string of 0s and 1s, specifying the PC to jump to

// CB type instruction
// 00000000001111111111222222222233
// 01234567890123456789012345678901
// <opcode><-----uimm19------><-Rd>

function cbTypeInstruction(opcode, addr, t) {
    let instr = new Int32();
    instr.setBits(0, opcode);
    instr.setBits(8, addr);
    instr.setBits(27, t);
    return instr;
}

/// @param opcode: a 9-string of 0s and 1s
/// @param shift: a 2-string of 0s and 1s
/// @param imm: a 16-string of 0s and 1s
/// @param d: a 5-string of 0s and 1s, specifying a register

// 00000000001111111111222222222233
// 01234567890123456789012345678901
// <-opcode>sh<-----addr-----><-Rd>

function iwTypeInstruction(opcode, shift, imm, d) {
    let instr = new Int32();
    instr.setBits(0, opcode);
    instr.setBits(9, shift);
    instr.setBits(11, imm);
    instr.setBits(27, d);
    return instr;
}

/// @param regName: a string either X0-X30, XZR, SP, FP, or LR.

function regNameToNum(regName) {
    if (regName.match(/X.*/)) {
        let num = regName.substr(1);
        if (num === "ZR") {
            return 31;
        }
        return parseInt(num);
    }
    switch (regName) {
        case "SP":
            return 28;
        case "FP":
            return 29;
        case "LR":
            return 30;
    }
    return -1;
}

/// @param num: a positive number to be converted to binary
/// @param len: the length of the binary string. Pad with 0s at beginning

function binaryPad(num, len) {
    let result = num.toString(2);
    result = "0".repeat(len).substr(result.length) + result;
    return result;
}

/// @param val: a string in the form /#?[0-9]+/
/// @param len: the length of the resulting binary string

function uimm(val, len) {
    if (val.charAt(0) === '#') {
        val = val.substr(1);
    }
    let num = parseInt(val);
    return binaryPad(num, len);
}

/// @param val: a string in the form /#?\-?[0-9]+/
/// @param val: the length of the resulting binary string

function simm(val, len) {
    if (val.charAt(0) === '#') {
        val = val.substr(1);
    }
    let num = parseInt(val);
    if (num >= 0) return binaryPad(num, len);
    let negnum = binaryPad(-num, len);
    let invnegnum = "";
    for (let i = 0; i < len; ++i) {
        invnegnum += (negnum.charAt(i) === '1' ? '0' : '1');
    }
    let final = "";
    let didadd = false;
    for (let i = len - 1; i >= 0; --i) {
        if (didadd) {
            final = invnegnum[i] + final;
        } else {
            if (invnegnum[i] === '0') {
                final = '1' + final;
                didadd = true;
            } else {
                final = '0' + final;
            }
        }
    }
    return final;
}

let opcodes, condCodes;
let opcodeToInstruction = {};
$.getJSON("./opcodes.json", (json) => {
    console.log('loaded up ready to go');
    opcodes = json;
    for (let instr in opcodes) {
        if (!opcodes.hasOwnProperty(instr)) {
            continue;
        }
        if (opcodes[instr]["type"] === "DIR") {
            continue;
        }
        if (opcodeToInstruction[opcodes[instr]["opcode"].length] == null) {
            opcodeToInstruction[opcodes[instr]["opcode"].length] = {};
        }
        opcodeToInstruction[opcodes[instr]["opcode"].length][opcodes[instr]["opcode"]] = instr;
    }
});
$.getJSON("./condcodes.json", (json) => {condCodes = json;});

// +---------------------------+ //
// | SECTION 4: LEGv8 ASSEMBLY | //
// +---------------------------+ //

let running = true;

let labels = {};

function assemble() {
    let pendingLabels = [];
    let currentPC = 16;
    let code = code_input.val().split('\n');
    let line_num = 1;

    for (let line of code) { // labels loop
        line.replace(/\t/, " ");
        let label = null;
        let instruction = null;
        // does it have a label
        if (line.match(/^[A-Za-z0-9]+\s/)) {
            label = line.substr(0, line.indexOf(' '));
            if (label.endsWith(':')) {
                label = label.substr(0, label.length - 1);
            }
            instruction = line.substr(line.indexOf(' ') + 1).trim();
        } else {
            instruction = line.trim();
        }

        if (instruction === "") {
            if (label != null) {
                pendingLabels.push(label);
                continue;
            }
        }

        let split = instruction.split(/[ ,\[\]]+/);
        let op = split[0];

        // set up all the labels

        for (let l of pendingLabels) {
            if (labels[l] != null) {
                throw SyntaxError(line_num);
            }
            labels[l] = currentPC;
        }

        pendingLabels = [];

        if (label != null) {
            labels[label] = currentPC;
        }
        if (op === "%") {
            currentPC += parseInt(split[1]);
        } else {
            currentPC += 4;
        }
    } // end labels loop

    currentPC = 16;

    for (let line of code) {
        // remove any comments
        if (line.indexOf(';') !== -1) {
            line = line.substr(0, line.indexOf(';'));
        }

        line.replace(/\t/, " ");

        let instruction = null;
        // does it have a label
        if (line.match(/^[A-Za-z0-9]+:?\s/)) {
            instruction = line.substr(line.indexOf(' ') + 1).trim();
        } else {
            instruction = line.trim();
        }

        console.log(instruction);

        // we have an instruction, decode it
        let split = instruction.split(/[ ,\[\]]+/);
        let op = split[0];

        // handle pseudoinstructions

        if (op === "MOV") {
            // MOV Xd Xn or MOV Xd #uimm12
            if (split[2].charAt(0) === 'X') {
                // MOV Xd Xn
                // ORR Xd XZR Xn
                op = "ORR";
                split = ["ORR", split[1], "XZR", split[2]];
            } else {
                op = "ORRI";
                split = ["ORRI", split[1], "XZR", split[2]];
            }
        } else if (op === "CMP") {
            // CMP Xn Xm
            op = "SUBS";
            split = ["SUBS", "XZR", split[1], split[2]];
        }

        let instrData = op.match(/B\..*/) ? opcodes["B.cond"] : opcodes[op];

        if (instrData == null) {
            console.log("no instrData");
            console.log(op);
            throw SyntaxError(line_num.toString());
        }

        // assembly => machine code (32 bits)

        let mc = new Int32();

        switch (instrData.type) {
            case 'R':
                if (op === "BR") {
                    // BR Xt
                    if (split.length < 2) {
                        throw SyntaxError(line_num.toString());
                    }
                    let t = binaryPad(regNameToNum(split[1]), 5);
                    mc = rTypeInstruction(instrData.opcode, t, "11111", "00000");
                } else if (op === "LSL" || op === "LSR") {
                    // LSL/LSR Xd Xn #uimm6
                    // split = LSL/LSR | Xd | Xn | #uimm6
                    if (split.length < 4) {
                        throw SyntaxError(line_num.toString());
                    }
                    let d = binaryPad(regNameToNum(split[1]), 5);
                    let n = binaryPad(regNameToNum(split[2]), 5);
                    let shamt = uimm(split[3], 6);

                    mc = rTypeInstruction(instrData.opcode, n, "00000", d, shamt);
                } else {
                    // INSTR Xd Xn Xm
                    // split = INSTR | Xd | Xn | Xm
                    if (split.length < 4) {
                        throw SyntaxError(line_num.toString());
                    }
                    let d = binaryPad(regNameToNum(split[1]), 5);
                    let n = binaryPad(regNameToNum(split[2]), 5);
                    let m = binaryPad(regNameToNum(split[3]), 5);

                    mc = rTypeInstruction(instrData.opcode, n, m, d);
                }
                break;
            case 'I':
            {
                // INSTR Xd Xn #uimm12
                // split = INSTR | Xd | Xn | #uimm12
                if (split.length < 4) {
                    throw SyntaxError(line_num.toString());
                }
                let d = binaryPad(regNameToNum(split[1]), 5);
                let n = binaryPad(regNameToNum(split[2]), 5);
                let imm = uimm(split[3], 12);

                mc = iTypeInstruction(instrData.opcode, imm, n, d);
            }
                break;
            case 'D':
            {
                // INSTR Xt, [Xn, #simm9]
                // split = INSTR | Xt | Xn | #simm9
                if (split.length < 4) {
                    throw SyntaxError(line_num.toString());
                }
                let t = binaryPad(regNameToNum(split[1]), 5);
                let n = binaryPad(regNameToNum(split[2]), 5);
                let imm = simm(split[3], 9);

                mc = dTypeInstruction(instrData.opcode, imm, n, t);
            }
            break;
            case 'B':
            {
                // B/BL label
                // split = B/BL | label
                if (split.length < 2) {
                    throw SyntaxError(line_num.toString());
                }
                let imm;
                if (split[1].match(/#-?[0-9]+/)) {
                    imm = simm(split[1], 26);
                } else {
                    let diff = Math.floor((labels[split[1]] - currentPC) / 4);
                    imm = simm(`#${diff}`, 26);
                }

                mc = bTypeInstruction(instrData.opcode, imm);
            }
            break;
            case 'CB':
            {
                if (op.match(/B.*/)) {
                    // B.COND label
                    if (split.length < 2) {
                        throw SyntaxError(line_num.toString());
                    }
                    let cond = op.substr(2);
                    let condCode = "0" + condCodes[cond];

                    let imm;

                    if (split[1].match(/#-?[0-9]+/)) {
                        imm = simm(split[1], 19);
                    } else {
                        let diff = Math.floor((labels[split[1]] - currentPC) / 4);
                        imm = simm(`#${diff}`, 19);
                    }

                    mc = cbTypeInstruction(instrData.opcode, imm, condCode);
                } else if (op === "ADR") {
                    // ADR Xd, label
                    if (split.length < 3) {
                        throw SyntaxError(line_num.toString());
                    }
                    let label = split[2];
                    let diff = (labels[label] - currentPC) / 4;
                    let immhi = binaryPad(diff, 19);
                    let d = binaryPad(regNameToNum(split[1]),5);

                    mc = cbTypeInstruction(instrData.opcode, immhi, d);
                } else {
                    // CBZ/CBNZ Xt, label
                    if (split.length < 3) {
                        throw SyntaxError(line_num.toString());
                    }
                    let t = binaryPad(regNameToNum(split[1]), 5);
                    let imm;
                    if (split[2].match(/#-?[0-9]+/)) {
                        imm = simm(split[2], 19);
                    } else {
                        let diff = Math.floor((labels[split[2]] - currentPC) / 4);
                        imm = simm(`#${diff}`, 19);
                    }

                    mc = cbTypeInstruction(instrData.opcode, imm, t);
                }
            }
            break;
            case 'IM':
            {
                // MOVZ/MOVK Xd #uimm16 LSL N
                // split = MOVZ/MOVK | Xd | #uimm16 | LSL | N
                if (split.length < 3) {
                    throw SyntaxError(line_num.toString());
                }
                let opcode = instrData.opcode;
                let shift = "";
                let d = binaryPad(regNameToNum(split[1]), 5);
                let imm = uimm(split[2], 16);
                let n = split[4];
                switch(n) {
                    case null:
                    case "0":
                        shift = "00";
                        break;
                    case "16":
                        shift = "01";
                        break;
                    case "32":
                        shift = "10";
                        break;
                    case "48":
                        shift = "11";
                        break;
                    default:
                        throw SyntaxError(line_num.toString());
                }
                mc = iwTypeInstruction(opcode, shift, imm, d);
            }
            break;
            case 'HLT':
                mc.setBits(0, instrData.opcode);
                break;
            case 'DIR':
                if (op === "%" || op === "FILL" || op === "ALIGN") {
                    // do nothing
                    break;
                }
                break;
        }
        console.log(mc.toHexString());

        // load into memory

        if (op === "%") {
            for (let i = 0; i < parseInt(split[1]); ++i) {
                mem[currentPC + i] = [0,0,0,0,0,0,0,0];
                activeMemory[currentPC + i] = true;
            }
            currentPC += parseInt(split[1]);
            ++line_num;
            continue;
        } else if (op === "FILL") {
            let numValues = 0;
            let values = [];
            if (split.length >= 3) {
                // we have values
                numValues = split.length - 2;
                for (let i = 2; i < split.length; ++i) {
                    values.push(parseInt(split[i].substr(2, 2), 16));
                }
            }
            for (let i = 0; i < parseInt(split[1]); ++i) {
                mem[currentPC + i] = [0,0,0,0,0,0,0,0];
                activeMemory[currentPC + i] = true;
                if (numValues !== 0) {
                    let value = values[i % numValues].toString(2);
                    for (let j = 0; j < 8; ++j) {
                        mem[currentPC + i] = (value[j] === '1' ? 1 : 0);
                    }
                }
            }
            currentPC += parseInt(split[1]);
            ++line_num;
            continue;
        } else if (op === "ALIGN") {
            currentPC = Math.ceil(currentPC / 4) * 4;
            ++line_num;
            continue;
        }

        let mc_bytes = mc.bytes;

        mc_bytes.reverse();
        for (let i = 0; i < 4; ++i) {
            mem[currentPC + i] = mc_bytes[i];
            activeMemory[currentPC + i] = true;
        }

        currentPC += 4;

        ++line_num;
    }
}

function loadCode() {
    error_output.empty();
    controls.hidden = true;
    for (let i = 0; i < 31; ++i) {
        registers[i] = new Int64();
        if (i === 28) {
            registers[i].setBits(44, "11111111111111111111");
        }
    }

    for (let i = 0; i < 1048576; ++i) {
        mem[i] = [0,0,0,0,0,0,0,0];
        activeMemory[i] = false;
    }
    try {
        pc = 16;
        n = 0;
        z = 0;
        c = 0;
        v = 0;
        assemble();
        outputRegisters();
        outputMemory();
        outputFlags();
        outputCurrentInstruction();
        running = true;
        step_button.disabled = false;
        run_button.disabled = false;
    } catch (e) {
        error_output.append(`<p style="color: red">Error: syntax error on line ${e.message}</p>`);
        console.log(e);
    }
}

// +-------------------------------------+ //
// | SECTION 4: LEGv8 RUNNING SUPPORTING | //
// +-------------------------------------+ //

function decodeCond(condCode) {
    let val = parseInt(condCode, 2);
    switch (val) {
        case 0:
            return "EQ";
        case 1:
            return "NE";
        case 2:
            return "HS";
        case 3:
            return "LO";
        case 4:
            return "MI";
        case 5:
            return "PL";
        case 6:
            return "VS";
        case 7:
            return "VC";
        case 8:
            return "HI";
        case 9:
            return "LS";
        case 10:
            return "GE";
        case 11:
            return "LT";
        case 12:
            return "GT";
        case 13:
            return "LE";
        case 14:
            return "AL";
        case 15:
            return "NV";
    }
}

function decodeSimm(simm) {
    let regularPart = simm.substr(1);
    let result = parseInt(regularPart, 2) - Math.pow(2, regularPart.length) * (simm.charAt(0) === '1' ? 1 : 0);
    return result;
}

function decodeOperation(instr) {
    let bin_str = instr.toBinaryString();
    for (let len_str of Object.keys(opcodeToInstruction)) {
        let len = parseInt(len_str);
        let potential_opcode = bin_str.substr(0, len);
        if (opcodeToInstruction[len_str][potential_opcode] != null) {
            // we have opcode
            let opcode = potential_opcode;
            let instruction = opcodeToInstruction[len_str][potential_opcode];
            let type = opcodes[instruction].type;
            switch (type) {
                case "R":
                    return {
                        instr: instruction,
                        Xm: parseInt(bin_str.substr(11, 5), 2),
                        Xn: parseInt(bin_str.substr(22, 5), 2),
                        Xd: parseInt(bin_str.substr(27, 5), 2),
                        shamt: parseInt(bin_str.substr(16, 6), 2)
                    };
                case "I":
                    return {
                        instr: instruction,
                        uimm12: parseInt(bin_str.substr(10, 12), 2),
                        Xn: parseInt(bin_str.substr(22, 5), 2),
                        Xd: parseInt(bin_str.substr(27, 5), 2)
                    };
                case "D":
                    return {
                        instr: instruction,
                        simm9: decodeSimm(bin_str.substr(11, 9)),
                        Xn: parseInt(bin_str.substr(22, 5), 2),
                        Xt: parseInt(bin_str.substr(27, 5), 2)
                    };
                case "B":
                    return {
                        instr: instruction,
                        simm26: decodeSimm(bin_str.substr(6, 26))
                    };
                case "CB":
                    if (instruction === "B.cond") {
                        return {
                            instr: instruction,
                            simm19: decodeSimm(bin_str.substr(8, 19)),
                            cond: decodeCond(bin_str.substr(28, 4))
                        }
                    } else {
                        console.log(bin_str.substr(8, 19));
                        return {
                            instr: instruction,
                            simm19: decodeSimm(bin_str.substr(8, 19)),
                            Xt: parseInt(bin_str.substr(27, 5), 2)
                        };
                    }
                case "IM":
                    return {
                        instr: instruction,
                        lsln: parseInt(bin_str.substr(9, 2), 2) * 16,
                        uimm16: parseInt(bin_str.substr(11, 16), 2),
                        Xd: parseInt(bin_str.substr(27, 5), 2)
                    };
                case "HLT":
                    return {
                        instr: "HLT"
                    }
            }
        }
    }
    return {error: "ERROR"};
}

// +--------------------------+ //
// | SECTION 5: LEGv8 RUNNING | //
// +--------------------------+ //

function step() {

    // read 32-bit instruction from PC through PC + 3

    let instr = new Int32();
    instr.setBits(0, mem[pc + 3]);
    instr.setBits(8, mem[pc + 2]);
    instr.setBits(16, mem[pc + 1]);
    instr.setBits(24, mem[pc]);

    let op = decodeOperation(instr);

    switch (op.instr) {
        case "ADD":
        case "ADDS":
        {
            let sum = addWithCarry(registers[op.Xn], registers[op.Xm], 0);
            if (op.instr === "ADDS") {
                n = sum.n;
                z = sum.z;
                c = sum.c;
                v = sum.v;
            }
            registers[op.Xd] = sum.sum;
            pc += 4;
        }
        break;
        case "ADDI":
        case "ADDIS":
        {
            let uimm = binaryPad(op.uimm12, 12);
            let immInt64 = new Int64();
            immInt64.setBits(52, uimm);
            let sum = addWithCarry(registers[op.Xn], immInt64, 0);
            if (op.instr === "ADDIS") {
                n = sum.n;
                z = sum.z;
                c = sum.c;
                v = sum.v;
            }
            registers[op.Xd] = sum.sum;
            pc += 4;
        }
        break;
        case "SUB":
        case "SUBS":
        {
            let diff = addWithCarry(registers[op.Xn], logNot(registers[op.Xm]), 1);
            if (op.instr === "SUBS") {
                n = diff.n;
                z = diff.z;
                c = diff.c;
                v = diff.v;
            }
            registers[op.Xd] = diff.sum;
            pc += 4;
        }
        break;
        case "SUBI":
        case "SUBIS":
        {
            let uimm = binaryPad(op.uimm12, 12);
            let immInt64 = new Int64();
            immInt64.setBits(52, uimm);
            let sum = addWithCarry(registers[op.Xn], logNot(immInt64), 1);
            if (op.instr === "SUBIS") {
                n = sum.n;
                z = sum.z;
                c = sum.c;
                v = sum.v;
            }
            registers[op.Xd] = sum.sum;
            pc += 4;
        }
        break;

        case "AND":
        {
            registers[op.Xd] = logAnd(registers[op.Xn], registers[op.Xm]);
            pc += 4;
        }
        break;
        case "ANDI":
        {
            let uimm = binaryPad(op.uimm12, 12);
            let immInt64 = new Int64();
            immInt64.setBits(52, uimm);
            registers[op.Xd] = logAnd(registers[op.Xn], immInt64);
            pc += 4;
        }
        break;
        case "ORR":
        {
            registers[op.Xd] = logOr(registers[op.Xn], registers[op.Xm]);
            pc += 4;
        }
        break;
        case "ORRI":
        {
            let uimm = binaryPad(op.uimm12, 12);
            let immInt64 = new Int64();
            immInt64.setBits(52, uimm);
            registers[op.Xd] = logOr(registers[op.Xn], immInt64);
            pc += 4;
        }
        break;
        case "EOR":
        {
            registers[op.Xd] = logXor(registers[op.Xn], registers[op.Xm]);
            pc += 4;
        }
        break;
        case "EORI":
        {
            let uimm = binaryPad(op.uimm12, 12);
            let immInt64 = new Int64();
            immInt64.setBits(52, uimm);
            registers[op.Xd] = logXor(registers[op.Xn], immInt64);
            pc += 4;
        }
        break;
        case "LSL":
        {
            let shamt = op.shamt;
            registers[op.Xd] = lsl(registers[op.Xn], shamt);
            pc += 4;
        }
        break;
        case "LSR":
        {
            let shamt = op.shamt;
            registers[op.Xd] = lsr(registers[op.Xn], shamt);
            pc += 4;
        }
        break;

        case "MOVZ":
        case "MOVK":
        {
            let uimm = binaryPad(op.uimm16, 16);
            if (op.instr === "MOVZ") {
                registers[op.Xd] = new Int64();
            }
            registers[op.Xd].setBits((64 - op.lsln - 16), uimm);
            pc += 4;
        }
        break;

        case "ADR":
        {
            let adr = (op.simm19 * 4) + pc;
            registers[op.Xt].setBits(44, uimm(`#${adr}`, 20));
            pc += 4;
        }
        break;
        case "HLT":
        {
            running = false;
        }
        break;

        case "LDUR":
        {
            // load double word
            let loadFrom = Number(registers[op.Xn].toNumber(false)) + op.simm9;
            let bytesToLoad = 8; // double word
            for (let i = 0; i < bytesToLoad; ++i) {
                let byte = mem[loadFrom + i];
                for (let j = 0; j < 8; ++j) {
                    registers[op.Xt].setBits(56 - (8 * i) + j, `${byte[j]}`);
                }
            }
            pc += 4;
        }
        break;
        case "LDURSW":
        {
            // load sign extended word
            let loadFrom = Number(registers[op.Xn].toNumber(false)) + op.simm9;
            let bytesToLoad = 4; // single word
            for (let i = 0; i < bytesToLoad; ++i) {
                let byte = mem[loadFrom + i];
                for (let j = 0; j < 8; ++j) {
                    registers[op.Xt].setBits(56 - (8 * i) + j, `${byte[j]}`);
                }
            }
            let msb = registers[op.Xt].byteArr[4][0];
            for (let i = 0; i < 3; ++i) {
                for (let j = 0; j < 8; ++j) {
                    registers[op.Xt].byteArr[i][j] = msb;
                }
            }
            pc += 4;
        }
        break;
        case "LDURH":
        {
            // load half word
            let loadFrom = Number(registers[op.Xn].toNumber(false)) + op.simm9;
            let bytesToLoad = 2; // half word
            for (let i = 0; i < bytesToLoad; ++i) {
                let byte = mem[loadFrom + i];
                for (let j = 0; j < 8; ++j) {
                    registers[op.Xt].setBits(56 - (8 * i) + j, `${byte[j]}`);
                }
            }
            // zero extend
            for (let i = 0; i < 5; ++i) {
                for (let j = 0; j < 8; ++j) {
                    registers[op.Xt].byteArr[i][j] = 0;
                }
            }
            pc += 4;
        }
        break;
        case "LDURB":
        {
            // load byte
            let loadFrom = Number(registers[op.Xn].toNumber(false)) + op.simm9;
            let bytesToLoad = 1; // half word
            for (let i = 0; i < bytesToLoad; ++i) {
                let byte = mem[loadFrom + i];
                for (let j = 0; j < 8; ++j) {
                    registers[op.Xt].setBits(56 - (8 * i) + j, `${byte[j]}`);
                }
            }
            // zero extend
            for (let i = 0; i < 7; ++i) {
                for (let j = 0; j < 8; ++j) {
                    registers[op.Xt].byteArr[i][j] = 0;
                }
            }
            pc += 4;
        }
        break;

        case "STUR":
        {
            // store double word
            let storeTo = Number(registers[op.Xn].toNumber(false)) + op.simm9;
            let bytesToStore = 8;
            for (let i = 0; i < bytesToStore; ++i) {
                let destByte = storeTo + i;
                activeMemory[destByte] = true;
                let srcByteIdx = 7 - i;
                for (let j = 0; j < 8; ++j) {
                    mem[destByte][j] = registers[op.Xt].byteArr[srcByteIdx][j];
                }
            }
            pc += 4;
        }
        break;
        case "STURW":
        {
            // store word
            let storeTo = Number(registers[op.Xn].toNumber(false)) + op.simm9;
            let bytesToStore = 4;
            for (let i = 0; i < bytesToStore; ++i) {
                let destByte = storeTo + i;
                activeMemory[destByte] = true;
                let srcByteIdx = 7 - i;
                for (let j = 0; j < 8; ++j) {
                    mem[destByte][j] = registers[op.Xt].byteArr[srcByteIdx][j];
                }
            }
            pc += 4;
        }
            break;
        case "STURH":
        {
            // store half word
            let storeTo = Number(registers[op.Xn].toNumber(false)) + op.simm9;
            let bytesToStore = 2;
            for (let i = 0; i < bytesToStore; ++i) {
                let destByte = storeTo + i;
                activeMemory[destByte] = true;
                let srcByteIdx = 7 - i;
                for (let j = 0; j < 8; ++j) {
                    mem[destByte][j] = registers[op.Xt].byteArr[srcByteIdx][j];
                }
            }
            pc += 4;
        }
        break;
        case "STURB":
        {
            // store byte
            let storeTo = Number(registers[op.Xn].toNumber(false)) + op.simm9;
            let bytesToStore = 1;
            for (let i = 0; i < bytesToStore; ++i) {
                let destByte = storeTo + i;
                activeMemory[destByte] = true;
                let srcByteIdx = 7 - i;
                for (let j = 0; j < 8; ++j) {
                    mem[destByte][j] = registers[op.Xt].byteArr[srcByteIdx][j];
                }
            }
            pc += 4;
        }
        break;

        case "B":
        {
            // unconditional branch
            let deltaPC = op.simm26 * 4;
            pc += deltaPC;
        }
        break;
        case "BL":
        {
            // branch and link
            let deltaPC = op.simm26 * 4;
            let newPC = pc + deltaPC;
            // set LR
            registers[30] = pc + 4;
            pc = newPC;
        }
        break;
        case "BR":
        {
            // branch to register
            let Xt = op.Xn;
            pc = Number(registers[Xt].toNumber(false));
        }
        break;

        case "CBZ":
        {
            // conditional branch zero
            if (Number(registers[op.Xt].toNumber(false)) === 0) {
                // branch
                pc += op.simm19 * 4;
            } else {
                pc += 4;
            }
        }
        break;
        case "CBNZ":
        {
            // conditional branch not zero
            if (Number(registers[op.Xt].toNumber(false)) !== 0) {
                // branch
                pc += op.simm19 * 4;
            } else {
                pc += 4;
            }
        }
        break;

        case "B.cond":
        {
            // conditional branch based on flags
            let flag = op.cond;
            let newPC = pc + op.simm19 * 4;
            switch (flag) {
                case "EQ":
                    if (z === 1) {
                        pc = newPC;
                    } else {
                        pc += 4;
                    }
                    break;
                case "NE":
                    if (z !== 1) {
                        pc = newPC;
                    } else {
                        pc += 4;
                    }
                    break;
                case "HS":
                    if (c === 1) {
                        pc = newPC;
                    } else {
                        pc += 4;
                    }
                    break;
                case "LO":
                    if (c === 0) {
                        pc = newPC;
                    } else {
                        pc += 4;
                    }
                    break;
                case "MI":
                    if (n === 1) {
                        pc = newPC;
                    } else {
                        pc += 4;
                    }
                    break;
                case "PL":
                    if (n === 0) {
                        pc = newPC;
                    } else {
                        pc += 4;
                    }
                    break;
                case "VS":
                    break;
                case "VC":
                    break;
                case "HI":
                    if ((z === 0 && c === 1)) {
                        pc = newPC;
                    } else {
                        pc += 4;
                    }
                    break;
                case "LS":
                    if (!(z === 0 && c === 1)) {
                        pc = newPC;
                    } else {
                        pc += 4;
                    }
                    break;
                case "GE":
                    if (n === v) {
                        pc = newPC;
                    } else {
                        pc += 4;
                    }
                    break;
                case "LT":
                    if (n !== v) {
                        pc = newPC;
                    } else {
                        pc += 4;
                    }
                    break;
                case "GT":
                    if ((z === 0 && n === v)) {
                        pc = newPC;
                    } else {
                        pc += 4;
                    }
                    break;
                case "LE":
                    if (!(z === 0 && n === v)) {
                        pc = newPC;
                    } else {
                        pc += 4;
                    }
                    break;
                case "AL":
                case "NV":
                    pc = newPC;
                    break;
            }
        }
        break;
    }

    if (!running) {
        step_button.disabled = true;
        run_button.disabled = true;
    }

    registers[31] = new Int64();

    outputFlags();
    outputMemory();
    outputRegisters();
    outputCurrentInstruction();
}

let runningInterval = null;

function run() {
    if (runningInterval != null) {
        // cancel it
        clearInterval(runningInterval);
        runningInterval = null;
        run_button.innerHTML = "Run";
        return;
    }
    runningInterval = setInterval(() => {
        if (running) {
            step();
        } else {
            run_button.innerHTML = "Run";
            clearInterval(runningInterval);
            runningInterval = null;
        }
    });
    run_button.innerHTML = "Pause";
}
