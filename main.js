
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
let registers = Array(31);
let mem = Array(1048576);
let activeMemory = Array(1048576);

for (let i = 0; i < 1048576; ++i) {
    mem[i] = [0,0,0,0,0,0,0,0];
    activeMemory[i] = false;
}

// +---------------------------------------------+ //
// | SECTION 1: JQUERY & QUERYSELECTOR VARIABLES | //
// +---------------------------------------------+ //

let line_nums = $('#line-numbers');
let code_input = $('#code');

let error_output = $('#errors');
let register_output = $('#registers');
let memory_output = $('#memory');

let controls = document.querySelector('#controls');

let pc_output = document.querySelector('#pc')
let n_flag = document.querySelector('#n');
let v_flag = document.querySelector('#v');
let z_flag = document.querySelector('#z');
let c_flag = document.querySelector('#c');

function line_template(badge, value) {
    return `<li class="list-group-item d-flex justify-content-between align-items-center"><span class="badge badge-primary">${badge}</span> ${value}</li>`;
}

function outputRegisters() {
    register_output.empty();
    for (let register in registers) {
        register_output.append(line_template(`X${register}`, registers[register]));
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

let labels = {};

function assemble() {
    let pendingLabels = [];
    let currentPC = 16;
    let code = code_input.val().split('\n');
    let line_num = 1;

    for (let line of code) { // labels loop

        let label = null;
        let instruction = null;
        // does it have a label
        if (line.match(/^[A-Za-z]+:/)) {
            label = line.substr(0, line.indexOf(':'));
            instruction = line.substr(line.indexOf(':') + 1).trim();
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
        if (line.indexOf(';') != -1) {
            line = line.substr(0, line.indexOf(';'));
        }

        line.replace(/\t/, " ");

        let instruction = null;
        // does it have a label
        if (line.match(/^[A-Za-z]+:/)) {
            instruction = line.substr(line.indexOf(':') + 1).trim();
        } else {
            instruction = line.trim();
        }

        console.log(instruction);

        // we have an instruction, decode it
        let split = instruction.split(/[ ,\[\]]+/);
        let op = split[0];

        let instrData = op.match(/B.*/) ? opcodes["B.COND"] : opcodes[op];

        if (instrData == null) {
            throw SyntaxError(line_num);
        }

        // assembly => machine code (32 bits)

        let mc = new Int32();

        switch (instrData.type) {
            case 'R':
                if (op === "BR") {
                    // BR Xt
                    if (split.length < 2) {
                        throw SyntaxError(line_num);
                    }
                    let t = binaryPad(regNameToNum(split[1]), 5);
                    mc = rTypeInstruction(instrData.opcode, t, "11111", "00000");
                } else if (op === "LSL" || op === "LSR") {
                    // LSL/LSR Xd Xn #uimm6
                    // split = LSL/LSR | Xd | Xn | #uimm6
                    if (split.length < 4) {
                        throw SyntaxError(line_num);
                    }
                    let d = binaryPad(regNameToNum(split[1]), 5);
                    let n = binaryPad(regNameToNum(split[2]), 5);
                    let shamt = uimm(split[3], 6);

                    mc = rTypeInstruction(instrData.opcode, n, "00000", d, shamt);
                } else {
                    // INSTR Xd Xn Xm
                    // split = INSTR | Xd | Xn | Xm
                    if (split.length < 4) {
                        throw SyntaxError(line_num);
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
                    throw SyntaxError(line_num);
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
                    throw SyntaxError(line_num);
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
                    throw SyntaxError(line_num);
                }
                let imm = simm(Math.floor(labels[split[1]] / 4), 26);

                mc = bTypeInstruction(instrData.opcode, imm);
            }
            break;
            case 'CB':
            {
                if (op.match(/B.*/)) {
                    // B.COND label
                    if (split.length < 2) {
                        throw SyntaxError(line_num);
                    }
                    let cond = op.substr(2);
                    let condCode = "0" + condCodes[cond];

                    let imm = simm(Math.floor(labels[split[1]] / 4), 19);

                    mc = cbTypeInstruction(instrData.opcode, imm, condCode);
                } else if (op === "ADR") {
                    // ADR Xd, label
                    if (split.length < 3) {
                        throw SyntaxError(line_num);
                    }
                    let label = split[2];
                    let diff = (labels[label] - currentPC) / 4;
                    let immhi = binaryPad(diff, 19);
                    let d = binaryPad(regNameToNum(split[1]),5);

                    mc = cbTypeInstruction(instrData.opcode, immhi, d);
                } else {
                    // CBZ/CBNZ Xt, label
                    if (split.length < 3) {
                        throw SyntaxError(line_num);
                    }
                    let t = binaryPad(regNameToNum(split[1]), 5);
                    let imm = simm(Math.floor(labels[split[2]] / 4), 19);

                    mc = cbTypeInstruction(instrData.opcode, imm, t);
                }
            }
            break;
            case 'IM':
            {
                // MOVZ/MOVK Xd #uimm16 LSL N
                // split = MOVZ/MOVK | Xd | #uimm16 | LSL | N
                if (split.length < 3) {
                    throw SyntaxError(line_num);
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
                        throw SyntaxError(line_num);
                }
                mc = iwTypeInstruction(opcode, shift, imm, d);
            }
            break;
            case 'HLT':
                mc.setBits(0, instrData.opcode);
                break;
            case 'DIR':
                if (op === "%") {
                    // do nothing
                    break;
                }
                break;
        }
        console.log(mc.toHexString());

        // load into memory

        if (op === "%") {
            currentPC += parseInt(split[1]);
            for (let i = 0; i < parseInt(split[1]); ++i) {
                mem[currentPC + i] = [0,0,0,0,0,0,0,0];
                activeMemory[currentPC + i] = true;
            }
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
    try {
        assemble();
        outputMemory();
    } catch (e) {
        error_output.append(`<p style="color: red">Error: syntax error on line ${e.message}</p>`)
    }
}

// +-------------------------------------+ //
// | SECTION 4: LEGv8 RUNNING SUPPORTING | //
// +-------------------------------------+ //

function decodeSimm(simm) {
    let regularPart = simm.substr(1);
    let result = parseInt(regularPart, 2) - Math.pow(2, regularPart.length);
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
                        uimm12: parseInt(bin_str.substr(10, 12), 12),
                        Xn: parseInt(bin_str.substr(22, 5), 2),
                        Xd: parseInt(bin_str.substr(27, 5), 2)
                    };
                case "D":
                    return {
                        instr: instruction,
                        simm9: decodeSimm(bin_str.substr(11, 9)),
                        Xn: parseInt(bin_str.substr(22, 5), 2),
                        Xt: parseInt(bin_str.substr(27, 5), 2)
                    }
                case "B":

            }
            return {};
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



    outputFlags();
    outputMemory();
    outputRegisters();
}
